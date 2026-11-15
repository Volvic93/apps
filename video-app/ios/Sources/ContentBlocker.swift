import Foundation
import WebKit

/// Übersetzt die Sperrliste (content-blocker.json aus dem App-Paket) in eine WKContentRuleList.
/// Schlägt irgendetwas fehl, wird nil geliefert und die App startet trotzdem.
enum ContentBlocker {
    private static let baseIdentifier = "flimmerfrei-rules"

    static func load(completion: @escaping (WKContentRuleList?) -> Void) {
        guard let url = Bundle.main.url(forResource: "content-blocker", withExtension: "json"),
              let json = try? String(contentsOf: url, encoding: .utf8),
              !json.isEmpty else {
            completion(nil)
            return
        }
        // Kennung enthält einen Fingerabdruck des Inhalts: neue Listen greifen dadurch sofort.
        let identifier = baseIdentifier + "-" + fingerprint(json)
        WKContentRuleListStore.default().compileContentRuleList(
            forIdentifier: identifier,
            encodedContentRuleList: json
        ) { list, _ in
            DispatchQueue.main.async {
                completion(list)
            }
        }
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
