import AVFoundation
import Foundation

/// Setzt beim Start einmalig die Audio-Kategorie „Wiedergabe“ (nötig für Hintergrundton).
/// Bewusst KEIN setActive(true) und kein Beobachter für Unterbrechungen: WebKit spielt Medien in einem
/// eigenen Prozess mit eigener Audio-Sitzung; eine zusätzlich aktivierte Sitzung der App würde sie stören.
final class AudioSessionManager {
    static let shared = AudioSessionManager()

    private var started = false

    private init() {}

    func start() {
        guard !started else { return }
        started = true
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .moviePlayback, options: [])
        } catch {
            // Ohne diese Kategorie läuft die App weiter, nur evtl. ohne Hintergrundton.
        }
    }

    /// Aktuelle Kategorie und Modus als Text (für die Diagnose).
    var categoryDescription: String {
        let session = AVAudioSession.sharedInstance()
        return session.category.rawValue + " / " + session.mode.rawValue
    }
}
