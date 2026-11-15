import Foundation
import WebKit

/// Übersetzt die Sperrliste (content-blocker.json aus dem App-Paket) in eine WKContentRuleList.
/// Schlägt irgendetwas fehl, wird nil geliefert und die App startet trotzdem.
enum ContentBlocker {
    private static let baseIdentifier = "flimmerfrei-rules"

    /// Wurde die Liste erfolgreich übersetzt?
    private(set) static var isLoaded = false
    /// Fehlertext der letzten Übersetzung (für die Einstellungen)
    private(set) static var lastError: String?

    static func load(completion: @escaping (WKContentRuleList?) -> Void) {
        guard let url = Bundle.main.url(forResource: "content-blocker", withExtension: "json") else {
            finish(list: nil, error: "content-blocker.json fehlt im App-Paket.", completion: completion)
            return
        }
        guard let json = try? String(contentsOf: url, encoding: .utf8), !json.isEmpty else {
            finish(list: nil, error: "content-blocker.json ist nicht lesbar oder leer.", completion: completion)
            return
        }
        // Kennung enthält einen Fingerabdruck des Inhalts: neue Listen greifen dadurch sofort.
        let identifier = baseIdentifier + "-" + fingerprint(json)
        WKContentRuleListStore.default().compileContentRuleList(
            forIdentifier: identifier,
            encodedContentRuleList: json
        ) { list, error in
            DispatchQueue.main.async {
                if list != nil {
                    finish(list: list, error: nil, completion: completion)
                } else {
                    finish(list: nil, error: describe(error), completion: completion)
                }
            }
        }
    }

    private static func finish(list: WKContentRuleList?, error: String?, completion: (WKContentRuleList?) -> Void) {
        isLoaded = (list != nil)
        lastError = error
        completion(list)
    }

    private static func describe(_ error: Error?) -> String {
        guard let error = error else { return "Unbekannter Fehler bei der Übersetzung." }
        let ns = error as NSError
        var parts: [String] = [ns.localizedDescription]
        if let reason = ns.localizedFailureReason, !reason.isEmpty { parts.append(reason) }
        if let anchor = ns.userInfo[NSHelpAnchorErrorKey] as? String, !anchor.isEmpty { parts.append(anchor) }
        return parts.joined(separator: " – ")
    }

    /// Einfacher, stabiler Fingerabdruck (djb2) über die UTF-8-Bytes.
    private static func fingerprint(_ text: String) -> String {
        var hash: UInt64 = 5381
        for byte in text.utf8 {
            hash = (hash &* 33) &+ UInt64(byte)
        }
        return String(hash, radix: 16)
    }
}
