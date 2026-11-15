import AVFoundation
import Foundation

/// Hält die Audio-Sitzung auf „Wiedergabe“, damit der Ton im Hintergrund weiterläuft.
final class AudioSessionManager {
    static let shared = AudioSessionManager()

    /// Wird aufgerufen, wenn eine Unterbrechung (z. B. Anruf) endet und iOS Fortsetzen empfiehlt.
    var onShouldResume: (() -> Void)?

    private var started = false

    private init() {}

    func start() {
        guard !started else { return }
        started = true
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleInterruption(_:)),
            name: AVAudioSession.interruptionNotification,
            object: nil
        )
        activate()
    }

    /// Kategorie setzen und Sitzung aktivieren (bei Start und bei jedem Wiedergabe-Beginn).
    func activate() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .moviePlayback, options: [])
            try session.setActive(true, options: [])
        } catch {
            // Ohne Audio-Sitzung läuft die App weiter, nur ohne Hintergrundton.
        }
    }

    @objc private func handleInterruption(_ notification: Notification) {
        guard let info = notification.userInfo,
              let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }
        if type == .ended {
            activate()
            if let optionValue = info[AVAudioSessionInterruptionOptionKey] as? UInt {
                let options = AVAudioSession.InterruptionOptions(rawValue: optionValue)
                if options.contains(.shouldResume) {
                    onShouldResume?()
                }
            }
        }
    }
}
