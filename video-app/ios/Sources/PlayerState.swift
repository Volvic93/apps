import Foundation

/// Zustandsmeldung des Skript-Kerns (Konzept 3.4):
/// { type: 'state', hasVideo, playing, pip, title, url, adsBlocked }
struct PlayerState {
    var hasVideo = false
    var playing = false
    var pip = false
    var title = ""
    var url = ""
    var adsBlocked = 0

    init() {}

    /// Dekodiert die Meldung; liefert nil bei fremdem Typ oder falscher Form.
    init?(message: Any) {
        guard let dict = message as? [String: Any] else { return nil }
        guard let type = dict["type"] as? String, type == "state" else { return nil }
        hasVideo = PlayerState.readBool(dict["hasVideo"])
        playing = PlayerState.readBool(dict["playing"])
        pip = PlayerState.readBool(dict["pip"])
        title = (dict["title"] as? String) ?? ""
        url = (dict["url"] as? String) ?? ""
        adsBlocked = (dict["adsBlocked"] as? NSNumber)?.intValue ?? 0
    }

    private static func readBool(_ value: Any?) -> Bool {
        if let b = value as? Bool { return b }
        if let n = value as? NSNumber { return n.boolValue }
        return false
    }
}
