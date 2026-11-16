import Foundation
import WebKit

/// Schwacher Zwischenhändler für den Nachrichtenkanal: verhindert den Retain-Zyklus
/// WKUserContentController -> Handler -> Ansicht -> WKWebView -> WKUserContentController.
final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    private weak var target: WKScriptMessageHandler?

    init(target: WKScriptMessageHandler) {
        self.target = target
        super.init()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(userContentController, didReceive: message)
    }
}

/// Baut die Konfiguration der Web-Ansicht laut Konzept 5.
enum WebViewFactory {
    static let messageName = "flimmerfrei"

    /// Zusatz im User-Agent, gekoppelt an die echte iOS-Hauptversion.
    static var userAgentSuffix: String {
        let major = ProcessInfo.processInfo.operatingSystemVersion.majorVersion
        return "Version/" + String(major) + ".0 Mobile/15E148 Safari/604.1"
    }

    static func makeConfiguration(messageHandler: WKScriptMessageHandler, contentRuleList: WKContentRuleList?) -> WKWebViewConfiguration {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = WKWebsiteDataStore.default()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsPictureInPictureMediaPlayback = true
        config.allowsAirPlayForMediaPlayback = true
        config.preferences.isElementFullscreenEnabled = true
        // Auch auf dem iPad die mobile Seite laden (wie die YouTube-App).
        config.defaultWebpagePreferences.preferredContentMode = .mobile
        // Google soll die Ansicht wie Safari behandeln; die Kennung der App steht nicht im User-Agent.
        config.applicationNameForUserAgent = userAgentSuffix

        let controller = config.userContentController
        controller.add(WeakScriptMessageHandler(target: messageHandler), name: messageName)
        installScripts(into: controller)
        if let list = contentRuleList {
            controller.add(list)
        }
        return config
    }

    /// (Neu) einsetzen: erst die Einstellungen, dann der Kern aus dem App-Paket.
    /// Fehlt der Kern im Paket, startet die Ansicht ohne Skript.
    static func installScripts(into controller: WKUserContentController) {
        controller.removeAllUserScripts()

        let settings = AppSettings.shared
        let configSource = "window.__FLIMMERFREI_CONFIG__ = { " + configFields(settings) + ", host: 'ios' };"
        controller.addUserScript(WKUserScript(source: configSource, injectionTime: .atDocumentStart, forMainFrameOnly: true, in: .page))

        if let url = Bundle.main.url(forResource: "flimmerfrei.inject", withExtension: "js"),
           let source = try? String(contentsOf: url, encoding: .utf8),
           !source.isEmpty {
            controller.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true, in: .page))
        }
    }

    /// JavaScript, der die Einstellungen im laufenden Betrieb setzt.
    static func setConfigScript() -> String {
        return "window.__flimmerfrei && window.__flimmerfrei.setConfig({ " + configFields(AppSettings.shared) + " });"
    }

    private static func configFields(_ settings: AppSettings) -> String {
        func flag(_ value: Bool) -> String { return value ? "true" : "false" }
        return "adblock: " + flag(settings.adblock)
            + ", background: " + flag(settings.background)
            + ", pipFix: true, look: true"
            + ", playerButtons: " + flag(settings.playerButtons)
            + ", menuButton: true"
            + ", airplayMode: " + flag(settings.airplayMode)
            + ", captionsOff: " + flag(settings.captionsOff)
    }
}
