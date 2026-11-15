import UIKit
import WebKit
import SafariServices

/// Die einzige Hauptansicht: eine Web-Ansicht mit youtube.com, ein Ersatzknopf und eine Fehlerseite.
/// Alles Sichtbare kommt von der Seite; das App-Menü ist ein Auswahlblatt (Menü-Knopf der Seite, Schütteln, Ersatzknopf).
final class BrowserViewController: UIViewController {

    static let homeURL = URL(string: "https://m.youtube.com/")!

    /// Diese Domänen (und ihre Unterdomänen) bleiben in der App; alles andere im Hauptrahmen geht an Safari.
    private static let allowedDomains = [
        "youtube.com",
        "youtu.be",
        "youtube-nocookie.com",
        "google.com",
        "google.de",
        "gstatic.com",
        "googleusercontent.com"
    ]

    private var webView: WKWebView?
    private var contentRuleList: WKContentRuleList?
    private var appliedAdblock = false
    private var appliedAirplayMode = false
    private var pendingURL: URL?
    private var failedURL: URL?
    private var cameFromLogin = false

    private var playerState = PlayerState()
    private var lastReportedAds = 0

    private var observations: [NSKeyValueObservation] = []
    private var statusStyle: UIStatusBarStyle = .default
    private let refreshControl = UIRefreshControl()
    private var refreshToken = 0
    private var buttonShowAllowed = true
    private var buttonToken = 0

    private let floatingButton = FloatingMenuButton()
    private let errorView = ErrorOverlayView()

    // MARK: - Lebenszyklus

    override var preferredStatusBarStyle: UIStatusBarStyle {
        return statusStyle
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        return .all
    }

    override var canBecomeFirstResponder: Bool {
        return true
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Theme.background

        errorView.isHidden = true
        errorView.translatesAutoresizingMaskIntoConstraints = false
        errorView.onRetry = { [weak self] in
            self?.retryAfterError()
        }
        view.addSubview(errorView)
        NSLayoutConstraint.activate([
            errorView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            errorView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            errorView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            errorView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor)
        ])

        floatingButton.addTarget(self, action: #selector(floatingButtonTapped), for: .touchUpInside)
        view.addSubview(floatingButton)

        refreshControl.addTarget(self, action: #selector(refreshTriggered), for: .valueChanged)

        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(appWillResignActive), name: UIApplication.willResignActiveNotification, object: nil)
        center.addObserver(self, selector: #selector(appDidBecomeActive), name: UIApplication.didBecomeActiveNotification, object: nil)

        AudioSessionManager.shared.onShouldResume = { [weak self] in
            self?.runScript("(function(){var v=document.querySelector('video');if(v&&v.paused&&!v.ended){v.play();}})();")
        }

        // Übertragen: die App liefert das aktuelle Video und hält es an, sobald es am Fernseher läuft.
        CastManager.shared.currentVideoProvider = { [weak self] completion in
            guard let self = self else {
                completion(nil)
                return
            }
            self.fetchCurrentVideo(completion)
        }
        CastManager.shared.onDidSendVideo = { [weak self] in
            self?.runScript("window.__flimmerfrei && window.__flimmerfrei.pause()")
        }

        updateChrome()
        updateFloatingButtonVisibility()

        // Sperrliste zuerst übersetzen, dann die Web-Ansicht bauen (schlägt es fehl, geht es ohne Liste weiter).
        ContentBlocker.load { [weak self] list in
            guard let self = self else { return }
            self.contentRuleList = list
            self.buildWebView()
        }
    }

    deinit {
        for observation in observations {
            observation.invalidate()
        }
        NotificationCenter.default.removeObserver(self)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        becomeFirstResponder()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        floatingButton.reposition(in: view)
    }

    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        coordinator.animate(alongsideTransition: { [weak self] _ in
            guard let self = self else { return }
            self.floatingButton.reposition(in: self.view)
        }, completion: nil)
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        updateChrome()
    }

    /// Schütteln öffnet das App-Menü.
    override func motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        super.motionEnded(motion, with: event)
        if motion == .motionShake {
            presentMenuSheet()
        }
    }

    private func buildWebView() {
        guard webView == nil else { return }
        let settings = AppSettings.shared
        appliedAdblock = settings.adblock
        appliedAirplayMode = settings.airplayMode

        let config = WebViewFactory.makeConfiguration(
            messageHandler: self,
            contentRuleList: settings.adblock ? contentRuleList : nil
        )
        let wv = WKWebView(frame: .zero, configuration: config)
        wv.translatesAutoresizingMaskIntoConstraints = false
        wv.navigationDelegate = self
        wv.uiDelegate = self
        wv.allowsBackForwardNavigationGestures = true
        wv.allowsLinkPreview = false
        wv.isOpaque = false
        wv.backgroundColor = UIColor.clear
        wv.scrollView.backgroundColor = UIColor.clear
        wv.scrollView.contentInsetAdjustmentBehavior = .never
        wv.scrollView.pinchGestureRecognizer?.isEnabled = false

        view.insertSubview(wv, at: 0)
        let guide = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            wv.topAnchor.constraint(equalTo: guide.topAnchor),
            wv.leadingAnchor.constraint(equalTo: guide.leadingAnchor),
            wv.trailingAnchor.constraint(equalTo: guide.trailingAnchor),
            wv.bottomAnchor.constraint(equalTo: guide.bottomAnchor)
        ])
        webView = wv

        // Farbe der Seite und Adresse beobachten (YouTube wechselt Seiten ohne Navigation).
        observations.append(wv.observe(\.themeColor, options: [.new]) { [weak self] _, _ in
            self?.updateChrome()
        })
        observations.append(wv.observe(\.underPageBackgroundColor, options: [.new]) { [weak self] _, _ in
            self?.updateChrome()
        })
        observations.append(wv.observe(\.url, options: [.new]) { [weak self] _, _ in
            self?.updateRefreshControl()
        })

        let start = pendingURL ?? BrowserViewController.homeURL
        pendingURL = nil
        wv.load(URLRequest(url: start))
        updateChrome()
        updateRefreshControl()
    }

    // MARK: - Erscheinungsbild

    /// Hintergrund und Statusleiste nehmen die Farbe der Seite an.
    private func updateChrome() {
        var pageColor: UIColor? = nil
        if let wv = webView {
            if let theme = wv.themeColor {
                pageColor = theme
            } else if let under = wv.underPageBackgroundColor {
                pageColor = under
            }
        }
        let base: UIColor = pageColor ?? Theme.background
        view.backgroundColor = base

        let resolved = base.resolvedColor(with: traitCollection)
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        var isDark = (traitCollection.userInterfaceStyle == .dark)
        if resolved.getRed(&red, green: &green, blue: &blue, alpha: &alpha) {
            isDark = (0.299 * red + 0.587 * green + 0.114 * blue) < 0.5
        }
        statusStyle = isDark ? .lightContent : .darkContent
        setNeedsStatusBarAppearanceUpdate()
    }

    /// Zoomen mit zwei Fingern aus (WebKit stellt den Erkenner gelegentlich zurück).
    private func disablePinch() {
        webView?.scrollView.pinchGestureRecognizer?.isEnabled = false
    }

    // MARK: - Ziehen zum Aktualisieren

    /// Nur auf YouTube-Seiten außer Player (/watch) und Shorts (/shorts).
    private func updateRefreshControl() {
        guard let wv = webView else { return }
        var allowed = false
        if let url = wv.url, BrowserViewController.isYouTubeHost(url) {
            let path = url.path
            allowed = !(path.hasPrefix("/watch") || path.hasPrefix("/shorts"))
        }
        if allowed {
            if wv.scrollView.refreshControl == nil {
                wv.scrollView.refreshControl = refreshControl
            }
        } else {
            if wv.scrollView.refreshControl != nil {
                refreshControl.endRefreshing()
                wv.scrollView.refreshControl = nil
            }
        }
    }

    @objc private func refreshTriggered() {
        refreshToken += 1
        let token = refreshToken
        reloadPage()
        // Spätestens nach 5 Sekunden beenden
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) { [weak self] in
            guard let self = self, self.refreshToken == token else { return }
            self.refreshControl.endRefreshing()
        }
    }

    private func endRefreshing() {
        refreshToken += 1
        refreshControl.endRefreshing()
    }

    // MARK: - Ersatzknopf

    /// Sichtbar, wenn die Seite ihren Menü-Knopf nicht hat (nach kurzer Verzögerung) oder die Einstellung es verlangt.
    private func updateFloatingButtonVisibility() {
        let show = AppSettings.shared.alwaysShowButton || (buttonShowAllowed && !playerState.menuButton)
        floatingButton.isHidden = !show
    }

    /// Nach jedem Seitenwechsel: Menü-Knopf der Seite zunächst als fehlend annehmen, Einblenden aber 1,5 s verzögern.
    private func pageDidCommit() {
        playerState.menuButton = false
        buttonShowAllowed = false
        buttonToken += 1
        let token = buttonToken
        updateFloatingButtonVisibility()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            guard let self = self, self.buttonToken == token else { return }
            self.buttonShowAllowed = true
            self.updateFloatingButtonVisibility()
        }
    }

    @objc private func floatingButtonTapped() {
        presentMenuSheet()
    }

    // MARK: - Adressen

    private static func isAllowed(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        for domain in allowedDomains {
            if host == domain || host.hasSuffix("." + domain) {
                return true
            }
        }
        // Anmeldung in anderen Ländern: accounts.google.<beliebige Länderendung>
        if host.hasPrefix("accounts.google.") {
            return true
        }
        return false
    }

    private static func isLoginHost(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        return host.hasPrefix("accounts.")
    }

    private static func isYouTubeHost(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        return host == "youtube.com" || host.hasSuffix(".youtube.com")
    }

    private static func isWebURL(_ url: URL) -> Bool {
        let scheme = (url.scheme ?? "").lowercased()
        return scheme == "http" || scheme == "https"
    }

    /// Eingehende Adresse über das URL-Schema: flimmerfrei://open?url=<kodierte Adresse>
    @discardableResult
    func handleIncomingURL(_ url: URL) -> Bool {
        guard (url.scheme ?? "").lowercased() == "flimmerfrei" else { return false }
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let value = components.queryItems?.first(where: { $0.name == "url" })?.value,
              let target = URL(string: value),
              BrowserViewController.isWebURL(target),
              BrowserViewController.isAllowed(target) else {
            return false
        }
        if let wv = webView {
            wv.load(URLRequest(url: target))
        } else {
            pendingURL = target
        }
        return true
    }

    // MARK: - Hilfen

    private func runScript(_ source: String) {
        webView?.evaluateJavaScript(source, completionHandler: nil)
    }

    /// Oberstes sichtbares Fenster, von dem aus etwas gezeigt werden darf.
    private func topPresenter() -> UIViewController {
        var top: UIViewController = self
        while let next = top.presentedViewController {
            top = next
        }
        return top
    }

    private func openInSafariView(_ url: URL) {
        guard BrowserViewController.isWebURL(url) else { return }
        let presenter = topPresenter()
        if presenter is SFSafariViewController { return }
        let safari = SFSafariViewController(url: url)
        presenter.present(safari, animated: true, completion: nil)
    }

    /// Holt den frischen Zustand aus der Seite und baut daraus das Video für die Übertragung.
    private func fetchCurrentVideo(_ completion: @escaping (CastVideo?) -> Void) {
        guard let wv = webView else {
            completion(nil)
            return
        }
        let source = "JSON.stringify(window.__flimmerfrei ? window.__flimmerfrei.state() : null)"
        wv.evaluateJavaScript(source) { result, _ in
            guard let text = result as? String,
                  let data = text.data(using: .utf8),
                  let object = try? JSONSerialization.jsonObject(with: data, options: []),
                  let dict = object as? [String: Any] else {
                completion(nil)
                return
            }
            let state = PlayerState(stateDictionary: dict)
            if state.videoId.isEmpty {
                completion(nil)
                return
            }
            completion(CastVideo(videoId: state.videoId, startSeconds: state.currentTime, listId: state.listId))
        }
    }

    // MARK: - Aktionen

    private func togglePip() {
        runScript("window.__flimmerfrei && window.__flimmerfrei.pip()")
    }

    private func showAirPlay() {
        runScript("window.__flimmerfrei && window.__flimmerfrei.airplay()")
    }

    private func goBack() {
        webView?.goBack()
    }

    private func reloadPage() {
        guard let wv = webView else { return }
        if wv.url == nil {
            wv.load(URLRequest(url: failedURL ?? BrowserViewController.homeURL))
        } else {
            wv.reload()
        }
    }

    private func signInWithGoogle() {
        guard let url = URL(string: "https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fm.youtube.com%2F") else { return }
        webView?.load(URLRequest(url: url))
    }

    private func goHome() {
        webView?.load(URLRequest(url: BrowserViewController.homeURL))
    }

    private func shareLink() {
        guard let url = webView?.url else { return }
        let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        configurePopover(sheet)
        topPresenter().present(sheet, animated: true, completion: nil)
    }

    private func openInSafari() {
        guard let url = webView?.url else { return }
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
    }

    private func showSettings() {
        let settings = SettingsViewController()
        settings.onSettingsChanged = { [weak self] in
            self?.applySettings()
        }
        settings.onDataCleared = { [weak self] in
            self?.dataWasCleared()
        }
        settings.onRequestDiagnostics = { [weak self] completion in
            guard let self = self, let wv = self.webView else {
                completion("Skript nicht geladen")
                return
            }
            wv.evaluateJavaScript("window.__flimmerfrei ? window.__flimmerfrei.diagnostics() : 'Skript nicht geladen'") { result, _ in
                if let text = result as? String {
                    completion(text)
                } else {
                    completion("Skript nicht geladen")
                }
            }
        }
        let nav = UINavigationController(rootViewController: settings)
        topPresenter().present(nav, animated: true, completion: nil)
    }

    private func retryAfterError() {
        errorView.isHidden = true
        guard let wv = webView else { return }
        wv.load(URLRequest(url: failedURL ?? BrowserViewController.homeURL))
    }

    /// Auf dem iPad braucht ein Auswahlblatt eine Quelle: Rechteck oben rechts in der Ansicht.
    private func configurePopover(_ controller: UIViewController) {
        if let popover = controller.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.maxX - 44, y: view.safeAreaInsets.top + 4, width: 1, height: 1)
            popover.permittedArrowDirections = [.up]
        }
    }

    // MARK: - Übertragen

    private func showCastSheet() {
        // Nicht öffnen, wenn schon etwas gezeigt wird
        if presentedViewController != nil { return }
        let controller = CastManager.shared.makeSheetController()
        controller.modalPresentationStyle = .pageSheet
        if let sheet = controller.sheetPresentationController {
            sheet.detents = [.medium(), .large()]
        }
        present(controller, animated: true, completion: nil)
    }

    // MARK: - AirPlay-Modus

    /// Der Kern meldet: AirPlay wurde angetippt, der Modus ist aber aus.
    private func askForAirplayMode() {
        if presentedViewController != nil { return }
        if AppSettings.shared.airplayMode { return }
        let alert = UIAlertController(
            title: "AirPlay-Modus einschalten?",
            message: "AirPlay braucht den AirPlay-Modus. Die Seite wird neu geladen; danach AirPlay erneut antippen.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Abbrechen", style: .cancel, handler: nil))
        alert.addAction(UIAlertAction(title: "Einschalten", style: .default) { [weak self] _ in
            AppSettings.shared.airplayMode = true
            self?.applySettings()
        })
        present(alert, animated: true, completion: nil)
    }

    // MARK: - Menü (Auswahlblatt)

    private func presentMenuSheet() {
        // Nicht öffnen, wenn schon etwas gezeigt wird
        if presentedViewController != nil { return }

        let hasVideo = playerState.hasVideo
        let canGoBack = webView?.canGoBack ?? false
        let hasPage = webView?.url != nil

        let sheet = UIAlertController(title: nil, message: nil, preferredStyle: .actionSheet)

        var castTitle = "Auf Fernseher übertragen"
        if CastManager.shared.isConnected {
            castTitle = "Übertragung: " + (CastManager.shared.deviceName ?? "Fernseher")
        }
        sheet.addAction(UIAlertAction(title: castTitle, style: .default) { [weak self] _ in
            // Kurz warten, bis das Auswahlblatt ganz weg ist (sonst gilt noch „es wird etwas gezeigt“).
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                self?.showCastSheet()
            }
        })

        let pipAction = UIAlertAction(title: playerState.pip ? "Bild-in-Bild beenden" : "Bild-in-Bild", style: .default) { [weak self] _ in
            self?.togglePip()
        }
        pipAction.isEnabled = hasVideo
        sheet.addAction(pipAction)

        let airPlayAction = UIAlertAction(title: "AirPlay", style: .default) { [weak self] _ in
            self?.showAirPlay()
        }
        airPlayAction.isEnabled = hasVideo
        sheet.addAction(airPlayAction)

        sheet.addAction(UIAlertAction(title: "Neu laden", style: .default) { [weak self] _ in
            self?.reloadPage()
        })

        let shareAction = UIAlertAction(title: "Link teilen", style: .default) { [weak self] _ in
            self?.shareLink()
        }
        shareAction.isEnabled = hasPage
        sheet.addAction(shareAction)

        let safariAction = UIAlertAction(title: "In Safari öffnen", style: .default) { [weak self] _ in
            self?.openInSafari()
        }
        safariAction.isEnabled = hasPage
        sheet.addAction(safariAction)

        sheet.addAction(UIAlertAction(title: "Mit Google anmelden", style: .default) { [weak self] _ in
            self?.signInWithGoogle()
        })

        let backAction = UIAlertAction(title: "Zurück", style: .default) { [weak self] _ in
            self?.goBack()
        }
        backAction.isEnabled = canGoBack
        sheet.addAction(backAction)

        sheet.addAction(UIAlertAction(title: "Startseite", style: .default) { [weak self] _ in
            self?.goHome()
        })
        sheet.addAction(UIAlertAction(title: "Einstellungen", style: .default) { [weak self] _ in
            self?.showSettings()
        })
        sheet.addAction(UIAlertAction(title: "Abbrechen", style: .cancel, handler: nil))

        configurePopover(sheet)
        present(sheet, animated: true, completion: nil)
    }

    // MARK: - Zustand und Einstellungen

    private func apply(state newState: PlayerState) {
        let wasPlaying = playerState.playing
        playerState = newState
        if newState.playing && !wasPlaying {
            AudioSessionManager.shared.activate()
        }
        countBlockedAds(newState.adsBlocked)
        updateFloatingButtonVisibility()

        // Der Manager entscheidet selbst, ob das Video an den Fernseher geschickt wird.
        if newState.playing && !newState.videoId.isEmpty {
            CastManager.shared.videoDidStart(
                CastVideo(videoId: newState.videoId, startSeconds: newState.currentTime, listId: newState.listId)
            )
        }
    }

    /// Der Zähler des Skripts gilt je Seitenladen; hier wird er über alle Sitzungen aufsummiert.
    private func countBlockedAds(_ reported: Int) {
        let store = AppSettings.shared
        if reported >= lastReportedAds {
            store.adsBlockedTotal += reported - lastReportedAds
        } else {
            store.adsBlockedTotal += reported
        }
        lastReportedAds = reported
    }

    private func applySettings() {
        let settings = AppSettings.shared
        view.window?.overrideUserInterfaceStyle = settings.interfaceStyle
        updateFloatingButtonVisibility()

        guard let wv = webView else { return }
        let controller = wv.configuration.userContentController

        // Für künftige Seitenladungen
        WebViewFactory.installScripts(into: controller)

        var needsReload = false
        if settings.adblock != appliedAdblock {
            controller.removeAllContentRuleLists()
            if settings.adblock, let list = contentRuleList {
                controller.add(list)
            }
            appliedAdblock = settings.adblock
            needsReload = true
        }

        // Der AirPlay-Modus wirkt nur beim Laden der Seite
        if settings.airplayMode != appliedAirplayMode {
            appliedAirplayMode = settings.airplayMode
            needsReload = true
        }

        // Für die aktuelle Seite
        runScript(WebViewFactory.setConfigScript())

        if needsReload {
            wv.reload()
        }
    }

    private func dataWasCleared() {
        playerState = PlayerState()
        lastReportedAds = 0
        updateFloatingButtonVisibility()
        webView?.load(URLRequest(url: BrowserViewController.homeURL))
    }

    @objc private func appWillResignActive() {
        let settings = AppSettings.shared
        guard settings.autoPip, playerState.hasVideo, playerState.playing, !playerState.pip else { return }
        togglePip()
    }

    @objc private func appDidBecomeActive() {
        AudioSessionManager.shared.activate()
    }

    // MARK: - Fehler

    private func handleLoadError(_ error: Error) {
        endRefreshing()
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled { return }
        // „Ladevorgang durch Richtlinienwechsel unterbrochen“ (z. B. wenn wir selbst auf Safari umleiten)
        if nsError.domain == "WebKitErrorDomain" && nsError.code == 102 { return }

        failedURL = nsError.userInfo[NSURLErrorFailingURLErrorKey] as? URL
        let offline = nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorNotConnectedToInternet
        let message = offline
            ? "Keine Internetverbindung."
            : "Die Seite konnte nicht geladen werden."
        errorView.show(message: message, detail: nsError.localizedDescription)
    }
}

// MARK: - Nachrichten vom Skript

extension BrowserViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let dict = message.body as? [String: Any], let type = dict["type"] as? String else { return }
        switch type {
        case "state":
            if let state = PlayerState(message: dict) {
                apply(state: state)
            }
        case "menu":
            presentMenuSheet()
        case "cast":
            showCastSheet()
        case "needAirplayMode":
            askForAirplayMode()
        default:
            // Unbekannte Typen werden ignoriert.
            break
        }
    }
}

// MARK: - Navigation

extension BrowserViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        // Unterrahmen (Einbettungen, Anmeldung) dürfen laden; nur der Hauptrahmen wird geprüft.
        let isMainFrame = navigationAction.targetFrame?.isMainFrame ?? true
        if !isMainFrame {
            decisionHandler(.allow)
            return
        }

        let scheme = (url.scheme ?? "").lowercased()
        if scheme == "http" || scheme == "https" {
            if BrowserViewController.isAllowed(url) {
                decisionHandler(.allow)
            } else {
                decisionHandler(.cancel)
                openInSafariView(url)
            }
            return
        }

        switch scheme {
        case "about", "blob", "data", "javascript":
            decisionHandler(.allow)
        case "mailto", "tel", "sms":
            decisionHandler(.cancel)
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        default:
            // z. B. Verweise, die die YouTube-App öffnen wollen: nicht zulassen
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        failedURL = nil
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        errorView.isHidden = true
        disablePinch()
        pageDidCommit()
        updateRefreshControl()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        errorView.isHidden = true
        disablePinch()
        endRefreshing()
        updateRefreshControl()

        // Rückkehr von einer Anmelde-Seite zu YouTube: einmal frisch laden, damit das Konto sichtbar ist.
        if let url = webView.url {
            if BrowserViewController.isLoginHost(url) {
                cameFromLogin = true
            } else if BrowserViewController.isYouTubeHost(url) {
                if cameFromLogin {
                    cameFromLogin = false
                    webView.reload()
                }
            }
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handleLoadError(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleLoadError(error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }
}

// MARK: - Fenster, neue Fenster, JavaScript-Dialoge

extension BrowserViewController: WKUIDelegate {
    /// target=_blank und window.open: in derselben Ansicht laden (bzw. fremde Seiten in Safari-Ansicht).
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, BrowserViewController.isWebURL(url) {
            if BrowserViewController.isAllowed(url) {
                webView.load(URLRequest(url: url))
            } else {
                openInSafariView(url)
            }
        }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let presenter = topPresenter()
        if view.window == nil || presenter is UIAlertController {
            completionHandler()
            return
        }
        let alert = UIAlertController(title: frame.request.url?.host, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completionHandler()
        })
        presenter.present(alert, animated: true, completion: nil)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let presenter = topPresenter()
        if view.window == nil || presenter is UIAlertController {
            completionHandler(false)
            return
        }
        let alert = UIAlertController(title: frame.request.url?.host, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Abbrechen", style: .cancel) { _ in
            completionHandler(false)
        })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completionHandler(true)
        })
        presenter.present(alert, animated: true, completion: nil)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let presenter = topPresenter()
        if view.window == nil || presenter is UIAlertController {
            completionHandler(nil)
            return
        }
        let alert = UIAlertController(title: frame.request.url?.host, message: prompt, preferredStyle: .alert)
        alert.addTextField { field in
            field.text = defaultText
        }
        alert.addAction(UIAlertAction(title: "Abbrechen", style: .cancel) { _ in
            completionHandler(nil)
        })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak alert] _ in
            completionHandler(alert?.textFields?.first?.text)
        })
        presenter.present(alert, animated: true, completion: nil)
    }
}

// MARK: - Fehlerseite

/// Schlichte Fehleransicht mit „Erneut versuchen“ (Systemfarben).
private final class ErrorOverlayView: UIView {
    var onRetry: (() -> Void)?

    private let titleLabel = UILabel()
    private let detailLabel = UILabel()
    private let retryButton = UIButton(type: .system)

    override init(frame: CGRect) {
        super.init(frame: frame)
        setUp()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setUp()
    }

    private func setUp() {
        backgroundColor = Theme.background

        titleLabel.font = UIFont.preferredFont(forTextStyle: .title3)
        titleLabel.textColor = UIColor.label
        titleLabel.textAlignment = .center
        titleLabel.numberOfLines = 0

        detailLabel.font = UIFont.preferredFont(forTextStyle: .footnote)
        detailLabel.textColor = UIColor.secondaryLabel
        detailLabel.textAlignment = .center
        detailLabel.numberOfLines = 0

        retryButton.setTitle("Erneut versuchen", for: .normal)
        retryButton.titleLabel?.font = UIFont.preferredFont(forTextStyle: .headline)
        retryButton.backgroundColor = UIColor.secondarySystemFill
        retryButton.layer.cornerRadius = 12
        retryButton.contentEdgeInsets = UIEdgeInsets(top: 12, left: 24, bottom: 12, right: 24)
        retryButton.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [titleLabel, detailLabel, retryButton])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -32)
        ])
    }

    func show(message: String, detail: String) {
        titleLabel.text = message
        detailLabel.text = detail
        isHidden = false
    }

    @objc private func retryTapped() {
        onRetry?()
    }
}
