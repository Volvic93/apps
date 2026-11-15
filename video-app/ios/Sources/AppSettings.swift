import Foundation

/// Einstellungen der App (UserDefaults).
final class AppSettings {
    static let shared = AppSettings()

    private let defaults = UserDefaults.standard

    private enum Key {
        static let adblock = "adblock"
        static let background = "background"
        static let autoPip = "autoPip"
        static let adsBlockedTotal = "adsBlockedTotal"
        static let buttonSide = "buttonSide"
        static let buttonY = "buttonY"
    }

    private init() {
        defaults.register(defaults: [
            Key.adblock: true,
            Key.background: true,
            Key.autoPip: false,
            Key.adsBlockedTotal: 0,
            Key.buttonSide: 1,
            Key.buttonY: 0.72
        ])
    }

    /// Werbeblocker (Sperrliste + Skript)
    var adblock: Bool {
        get { return defaults.bool(forKey: Key.adblock) }
        set { defaults.set(newValue, forKey: Key.adblock) }
    }

    /// Hintergrundwiedergabe (Skript-Seite)
    var background: Bool {
        get { return defaults.bool(forKey: Key.background) }
        set { defaults.set(newValue, forKey: Key.background) }
    }

    /// Beim Verlassen der App automatisch Bild-in-Bild versuchen
    var autoPip: Bool {
        get { return defaults.bool(forKey: Key.autoPip) }
        set { defaults.set(newValue, forKey: Key.autoPip) }
    }

    /// Insgesamt blockierte Werbung (über alle Sitzungen)
    var adsBlockedTotal: Int {
        get { return defaults.integer(forKey: Key.adsBlockedTotal) }
        set { defaults.set(newValue, forKey: Key.adsBlockedTotal) }
    }

    /// Seite des schwebenden Knopfs: 0 = links, 1 = rechts
    var buttonSide: Int {
        get { return defaults.integer(forKey: Key.buttonSide) }
        set { defaults.set(newValue, forKey: Key.buttonSide) }
    }

    /// Senkrechte Lage des Knopfs als Anteil der Höhe (0 bis 1)
    var buttonY: Double {
        get { return defaults.double(forKey: Key.buttonY) }
        set { defaults.set(newValue, forKey: Key.buttonY) }
    }
}
