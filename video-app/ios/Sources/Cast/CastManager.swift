import Foundation
import UIKit

/// Ein Video, das an den Fernseher geschickt werden soll.
struct CastVideo {
    let videoId: String
    let startSeconds: Double
    let listId: String          // "" = keine Wiedergabeliste
}

/// Zuletzt per TV-Code verbundenes Gerät.
struct CastRecentScreen {
    let name: String
    let screenId: String
}

/// Zentrale Steuerung: Verbindungszustand, Cast-Kanal, Lounge-Sitzung. Nur vom Hauptthread benutzen.
final class CastManager {
    static let shared = CastManager()

    enum State {
        case idle
        case connecting(String)
        case connected(String)
    }

    private(set) var state: State = .idle

    var isConnected: Bool {
        if case .connected = state { return true }
        return false
    }

    var deviceName: String? {
        if case .connected(let name) = state { return name }
        return nil
    }

    /// Hauptthread: Verbindung/Zustand hat sich geändert.
    var onChange: (() -> Void)?
    /// Hauptthread: Video wurde erfolgreich an den Fernseher geschickt.
    var onDidSendVideo: (() -> Void)?
    /// Die App liefert das aktuelle Video.
    var currentVideoProvider: ((@escaping (CastVideo?) -> Void) -> Void)?

    /// Nur für das Blatt.
    var sheetUpdate: (() -> Void)?
    var sheetError: ((String) -> Void)?

    var logText: String { return CastLog.shared.text }

    func clearLog() {
        CastLog.shared.clear()
    }

    private static let recentKey = "cast.recentScreens"
    private var channel: CastChannel?
    private var lounge: LoungeSession?
    private var lastVideoId: String?
    private var generation = 0

    private init() {}

    func makeSheetController() -> UIViewController {
        return UINavigationController(rootViewController: CastSheetViewController())
    }

    // MARK: - Zuletzt verbunden

    var recentScreens: [CastRecentScreen] {
        let raw = UserDefaults.standard.array(forKey: CastManager.recentKey) as? [[String: String]] ?? []
        var result: [CastRecentScreen] = []
        for item in raw {
            if let name = item["name"], let id = item["screenId"] {
                result.append(CastRecentScreen(name: name, screenId: id))
            }
        }
        return result
    }

    private func remember(_ screen: CastRecentScreen) {
        var list = recentScreens.filter { $0.screenId != screen.screenId }
        list.insert(screen, at: 0)
        if list.count > 5 { list = Array(list.prefix(5)) }
        let raw: [[String: String]] = list.map { ["name": $0.name, "screenId": $0.screenId] }
        UserDefaults.standard.set(raw, forKey: CastManager.recentKey)
    }

    // MARK: - Verbinden

    /// Gerät aus der WLAN-Suche (Cast-Protokoll).
    func connect(device: CastDevice) {
        guard beginConnecting(name: device.name) else { return }
        let gen = generation
        CastLog.shared.add("Verbinden mit \(device.name) (WLAN)")
        let ch = CastChannel(endpoint: device.endpoint)
        channel = ch
        ch.onClosed = {
            CastLog.shared.add("Cast-Kanal geschlossen, Lounge-Sitzung bleibt nutzbar")
        }
        ch.start { [weak self] result in
            guard let self = self, self.generation == gen else { return }
            switch result {
            case .failure(let error):
                self.fail(CastManager.message(for: error))
            case .success(let screenId):
                let l = LoungeSession(screenId: screenId, token: nil)
                self.lounge = l
                l.connect { [weak self] outcome in
                    guard let self = self, self.generation == gen else { return }
                    switch outcome {
                    case .success:
                        self.didConnect(name: device.name)
                    case .failure(let error):
                        self.fail(CastManager.message(for: error))
                    }
                }
            }
        }
    }

    /// Per TV-Code (Ziffern).
    func connect(tvCode: String) {
        let digits = tvCode.filter { "0123456789".contains($0) }
        if digits.isEmpty {
            sheetError?(CastManager.message(for: LoungeError.invalidCode))
            return
        }
        guard beginConnecting(name: "Fernseher") else { return }
        let gen = generation
        LoungeSession.pair(code: digits) { [weak self] result in
            guard let self = self, self.generation == gen else { return }
            switch result {
            case .failure(let error):
                self.fail(CastManager.message(for: error))
            case .success(let screen):
                self.state = .connecting(screen.name)
                self.notifyChange()
                let l = LoungeSession(screenId: screen.screenId, token: screen.loungeToken)
                self.lounge = l
                l.connect { [weak self] outcome in
                    guard let self = self, self.generation == gen else { return }
                    switch outcome {
                    case .success:
                        self.remember(CastRecentScreen(name: screen.name, screenId: screen.screenId))
                        self.didConnect(name: screen.name)
                    case .failure(let error):
                        self.fail(CastManager.message(for: error))
                    }
                }
            }
        }
    }

    /// Erneut verbinden mit einem gemerkten Gerät (Token wird frisch geholt).
    func connect(recent: CastRecentScreen) {
        guard beginConnecting(name: recent.name) else { return }
        let gen = generation
        CastLog.shared.add("Erneut verbinden mit \(recent.name)")
        let l = LoungeSession(screenId: recent.screenId, token: nil)
        lounge = l
        l.connect { [weak self] outcome in
            guard let self = self, self.generation == gen else { return }
            switch outcome {
            case .success:
                self.didConnect(name: recent.name)
            case .failure(let error):
                self.fail(CastManager.message(for: error))
            }
        }
    }

    private func beginConnecting(name: String) -> Bool {
        guard case .idle = state else { return false }
        generation += 1
        lastVideoId = nil
        state = .connecting(name)
        notifyChange()
        return true
    }

    private func didConnect(name: String) {
        state = .connected(name)
        CastLog.shared.add("Verbunden mit \(name)")
        notifyChange()
        let gen = generation
        guard let provider = currentVideoProvider else { return }
        provider { [weak self] video in
            DispatchQueue.main.async {
                guard let self = self, self.generation == gen, let video = video else { return }
                self.send(video: video, force: true, completion: nil)
            }
        }
    }

    private func fail(_ text: String) {
        CastLog.shared.add("Fehler: \(text)")
        teardown()
        state = .idle
        notifyChange()
        sheetError?(text)
    }

    private func teardown() {
        generation += 1
        channel?.close()
        channel = nil
        lounge?.close()
        lounge = nil
        lastVideoId = nil
    }

    private func notifyChange() {
        onChange?()
        sheetUpdate?()
    }

    // MARK: - Trennen

    func disconnect() {
        if case .idle = state { return }
        CastLog.shared.add("Trennen")
        let old = lounge
        if isConnected, let old = old {
            old.send(command: "stopVideo", params: [:]) { _ in
                old.close()
            }
            lounge = nil
        }
        teardown()
        state = .idle
        notifyChange()
    }

    // MARK: - Video und Steuerung

    /// Die App meldet: dieses Video läuft jetzt.
    func videoDidStart(_ video: CastVideo) {
        if !Thread.isMainThread {
            DispatchQueue.main.async { [weak self] in
                self?.videoDidStart(video)
            }
            return
        }
        guard isConnected, video.videoId != lastVideoId else { return }
        send(video: video, force: false, completion: nil)
    }

    /// „Aktuelles Video senden“ im Blatt.
    func sendCurrentVideo() {
        guard isConnected else { return }
        guard let provider = currentVideoProvider else {
            sheetError?("Es läuft gerade kein Video.")
            return
        }
        let gen = generation
        provider { [weak self] video in
            DispatchQueue.main.async {
                guard let self = self, self.generation == gen else { return }
                guard let video = video else {
                    self.sheetError?("Es läuft gerade kein Video.")
                    return
                }
                self.send(video: video, force: true, completion: nil)
            }
        }
    }

    func sendControl(_ command: String) {
        guard isConnected, let l = lounge else { return }
        let gen = generation
        l.send(command: command, params: [:]) { [weak self] ok in
            guard let self = self, self.generation == gen else { return }
            if !ok {
                self.sheetError?("Der Befehl konnte nicht an das Gerät gesendet werden.")
            }
        }
    }

    private func send(video: CastVideo, force: Bool, completion: ((Bool) -> Void)?) {
        guard isConnected, let l = lounge else {
            completion?(false)
            return
        }
        if !force && video.videoId == lastVideoId {
            completion?(true)
            return
        }
        lastVideoId = video.videoId
        let seconds = max(0, Int(video.startSeconds))
        let params: [String: String] = [
            "_videoId": video.videoId,
            "_currentTime": String(seconds),
            "_currentIndex": "-1",
            "_audioOnly": "false",
            "_listId": video.listId
        ]
        let gen = generation
        CastLog.shared.add("Sende Video \(video.videoId) ab \(seconds) s")
        l.send(command: "setPlaylist", params: params) { [weak self] ok in
            guard let self = self, self.generation == gen else { return }
            if ok {
                CastLog.shared.add("Video gesendet")
                self.onDidSendVideo?()
            } else {
                if self.lastVideoId == video.videoId { self.lastVideoId = nil }
                self.sheetError?("Das Video konnte nicht an das Gerät gesendet werden.")
            }
            completion?(ok)
        }
    }

    // MARK: - Fehlertexte

    private static func message(for error: CastChannelError) -> String {
        switch error {
        case .unreachable: return "Gerät nicht erreichbar. Prüfe, ob iPhone und Gerät im selben WLAN sind."
        case .launchFailed: return "YouTube auf dem Gerät konnte nicht gestartet werden."
        case .timeout: return "Das Gerät antwortet nicht. Versuche es noch einmal."
        case .protocolError: return "Unerwartete Antwort vom Gerät."
        }
    }

    private static func message(for error: LoungeError) -> String {
        switch error {
        case .invalidCode: return "Code ungültig. Den TV-Code findest du in der YouTube-App des Fernsehers unter Einstellungen, Mit TV-Code verknüpfen."
        case .network: return "Keine Verbindung zu YouTube. Prüfe die Internetverbindung."
        case .tokenFailed, .bindFailed: return "Die Sitzung mit dem Gerät konnte nicht aufgebaut werden."
        }
    }
}
