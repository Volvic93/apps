import Foundation

/// Zustandsmeldung des Skript-Kerns (Konzept 3.4):
/// { type: 'state', hasVideo, playing, pip, title, url, adsBlocked, menuButton, videoId, listId, currentTime }
struct PlayerState {
    var hasVideo = false
    var playing = false
    var pip = false
    var title = ""
    var url = ""
    var adsBlocked = 0
    var menuButton = false
    var videoId = ""
    var listId = ""
    var currentTime = 0.0

    init() {}

    /// Aus dem Ergebnis von `window.__flimmerfrei.state()` (ohne Feld `type`).
    init(stateDictionary dict: [String: Any]) {
        hasVideo = PlayerState.readBool(dict["hasVideo"])
        playing = PlayerState.readBool(dict["playing"])
        pip = PlayerState.readBool(dict["pip"])
        title = (dict["title"] as? String) ?? ""
        url = (dict["url"] as? String) ?? ""
        adsBlocked = (dict["adsBlocked"] as? NSNumber)?.intValue ?? 0
        menuButton = PlayerState.readBool(dict["menuButton"])
        videoId = (dict["videoId"] as? String) ?? ""
        listId = (dict["listId"] as? String) ?? ""
        currentTime = (dict["currentTime"] as? NSNumber)?.doubleValue ?? 0.0
    }

    /// Dekodiert eine Meldung vom Typ `state`; liefert nil bei anderem Typ oder falscher Form.
    init?(message: Any) {
        guard let dict = message as? [String: Any] else { return nil }
        guard let type = dict["type"] as? String, type == "state" else { return nil }
        self.init(stateDictionary: dict)
    }

    private static func readBool(_ value: Any?) -> Bool {
        if let b = value as? Bool { return b }
        if let n = value as? NSNumber { return n.boolValue }
        return false
    }
}
