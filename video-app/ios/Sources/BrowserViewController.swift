import UIKit
import WebKit
import SafariServices

/// Die einzige Hauptansicht: eine Web-Ansicht mit youtube.com, ein schwebender Menüknopf und eine Fehlerseite.
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
    private var pendingURL: URL?
    private var failedURL: URL?
    private var cameFromLogin = false

    private var playerState = PlayerState()
    private var lastReportedAds = 0
    private var menuSignature = ""

    private let floatingButton = FloatingMenuButton()
    private let errorView = ErrorOverlayView()

    // MARK: - Lebenszyklus

    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        return .all
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
            errorView.topAnchor.constraint(equalTo: view.topAnchor),
            errorView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            errorView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            errorView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])

        view.addSubview(floatingButton)
        rebuildMenu(force: true)

        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(appWillResignActive), name: UIApplication.willResignActiveNotification, object: nil)
        center.addObserver(self, selector: #selector(appDidBecomeActive), name: UIApplication.didBecomeActiveNotification, object: nil)

        AudioSessionManager.shared.onShouldResume = { [weak self] in
            self?.runScript("(function(){var v=document.querySelector('video');if(v&&v.paused&&!v.ended){v.play();}})();")
        }

        // Sperrliste zuerst übersetzen, dann die Web-Ansicht bauen (schlägt es fehl, geht es ohne Liste weiter).
        ContentBlocker.load { [weak self] list in
            guard let self = self else { return }
            self.contentRuleList = list
            self.buildWebView()
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
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

    private func buildWebView() {
        guard webView == nil else { return }
        let settings = AppSettings.shared
        appliedAdblock = settings.adblock

        let config = WebViewFactory.makeConfiguration(
            messageHandler: self,
            contentRuleList: settings.adblock ? contentRuleList : nil
        )
        let wv = WKWebView(frame: .zero, configuration: config)
        wv.translatesAutoresizingMaskIntoConstraints = false
        wv.navigationDelegate = self
        wv.uiDelegate = self
        wv.allowsBackForwardNavigationGestures = true
        wv.isOpaque = false
        wv.backgroundColor = Theme.background
        wv.scrollView.backgroundColor = Theme.background
        wv.scrollView.contentInsetAdjustmentBehavior = .never

        view.insertSubview(wv, at: 0)
        let guide = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            wv.topAnchor.constraint(equalTo: guide.topAnchor),
            wv.leadingAnchor.constraint(equalTo: guide.leadingAnchor),
            wv.trailingAnchor.constraint(equalTo: guide.trailingAnchor),
            wv.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        webView = wv

        let start = pendingURL ?? BrowserViewController.homeURL
        pendingURL = nil
        wv.load(URLRequest(url: start))
        rebuildMenu(force: true)
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
        safari.preferredControlTintColor = Theme.accent
        presenter.present(safari, animated: true, completion: nil)
    }

    // MARK: - Aktionen (Menü)

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
        sheet.popoverPresentationController?.sourceView = floatingButton
        sheet.popoverPresentationController?.sourceRect = floatingButton.bounds
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
        let nav = UINavigationController(rootViewController: settings)
        topPresenter().present(nav, animated: true, completion: nil)
    }

    private func retryAfterError() {
        errorView.isHidden = true
        guard let wv = webView else { return }
        wv.load(URLRequest(url: failedURL ?? BrowserViewController.homeURL))
    }

    // MARK: - Menü

    /// Baut das Menü des Knopfs neu auf (ein geöffnetes UIMenu ist fest, deshalb bei jeder Änderung).
    private func rebuildMenu(force: Bool = false) {
        let hasVideo = playerState.hasVideo
        let canGoBack = webView?.canGoBack ?? false
        let hasPage = webView?.url != nil
        let signature = "\(hasVideo)|\(playerState.pip)|\(canGoBack)|\(hasPage)"
        if !force && signature == menuSignature { return }
        menuSignature = signature

        let videoAttributes: UIMenuElement.Attributes = hasVideo ? [] : [.disabled]
        let backAttributes: UIMenuElement.Attributes = canGoBack ? [] : [.disabled]
        let pageAttributes: UIMenuElement.Attributes = hasPage ? [] : [.disabled]

        let pipTitle = playerState.pip ? "Bild-in-Bild beenden" : "Bild-in-Bild"
        let pipImage = UIImage(systemName: playerState.pip ? "pip.exit" : "pip.enter")

        let pipAction = UIAction(title: pipTitle, image: pipImage, attributes: videoAttributes) { [weak self] _ in
            self?.togglePip()
        }
        let airPlayAction = UIAction(title: "AirPlay", image: UIImage(systemName: "airplayvideo"), attributes: videoAttributes) { [weak self] _ in
            self?.showAirPlay()
        }
        let backAction = UIAction(title: "Zurück", image: UIImage(systemName: "chevron.backward"), attributes: backAttributes) { [weak self] _ in
            self?.goBack()
        }
        let reloadAction = UIAction(title: "Neu laden", image: UIImage(systemName: "arrow.clockwise")) { [weak self] _ in
            self?.reloadPage()
        }
        let homeAction = UIAction(title: "Startseite", image: UIImage(systemName: "house")) { [weak self] _ in
            self?.goHome()
        }
        let shareAction = UIAction(title: "Link teilen", image: UIImage(systemName: "square.and.arrow.up"), attributes: pageAttributes) { [weak self] _ in
            self?.shareLink()
        }
        let safariAction = UIAction(title: "In Safari öffnen", image: UIImage(systemName: "safari"), attributes: pageAttributes) { [weak self] _ in
            self?.openInSafari()
        }
        let signInAction = UIAction(title: "Mit Google anmelden", image: UIImage(systemName: "person.crop.circle")) { [weak self] _ in
            self?.signInWithGoogle()
        }
        let settingsAction = UIAction(title: "Einstellungen", image: UIImage(systemName: "gearshape")) { [weak self] _ in
            self?.showSettings()
        }

        let videoGroup = UIMenu(title: "", options: .displayInline, children: [pipAction, airPlayAction])
        let navGroup = UIMenu(title: "", options: .displayInline, children: [backAction, reloadAction, homeAction])
        let linkGroup = UIMenu(title: "", options: .displayInline, children: [shareAction, safariAction])
        let settingsGroup = UIMenu(title: "", options: .displayInline, children: [signInAction, settingsAction])

        floatingButton.menu = UIMenu(title: "", children: [videoGroup, navGroup, linkGroup, settingsGroup])
    }

    // MARK: - Zustand und Einstellungen

    private func apply(state newState: PlayerState) {
        let wasPlaying = playerState.playing
        playerState = newState
        if newState.playing && !wasPlaying {
            AudioSessionManager.shared.activate()
        }
        countBlockedAds(newState.adsBlocked)
        rebuildMenu()
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
        guard let wv = webView else { return }
        let settings = AppSettings.shared
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

        // Für die aktuelle Seite
        runScript(WebViewFactory.setConfigScript())

        if needsReload {
            wv.reload()
        }
    }

    private func dataWasCleared() {
        playerState = PlayerState()
        lastReportedAds = 0
        rebuildMenu(force: true)
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
        // Unbekannte Typen werden ignoriert (PlayerState liefert dann nil).
        if let state = PlayerState(message: message.body) {
            apply(state: state)
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
        rebuildMenu()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        errorView.isHidden = true
        rebuildMenu()

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

/// Schlichte Fehleransicht mit „Erneut versuchen“.
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
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center
        titleLabel.numberOfLines = 0

        detailLabel.font = UIFont.preferredFont(forTextStyle: .footnote)
        detailLabel.textColor = UIColor(white: 1.0, alpha: 0.6)
        detailLabel.textAlignment = .center
        detailLabel.numberOfLines = 0

        retryButton.setTitle("Erneut versuchen", for: .normal)
        retryButton.titleLabel?.font = UIFont.preferredFont(forTextStyle: .headline)
        retryButton.setTitleColor(Theme.background, for: .normal)
        retryButton.backgroundColor = Theme.accent
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
