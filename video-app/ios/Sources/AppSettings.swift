import UIKit

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
        static let appearance = "appearance"
        static let playerButtons = "playerButtons"
        static let alwaysShowButton = "alwaysShowButton"
        static let airplayMode = "airplayMode"
    }

    private init() {
        defaults.register(defaults: [
            Key.adblock: true,
            Key.background: true,
            Key.autoPip: false,
            Key.adsBlockedTotal: 0,
            Key.buttonSide: 1,
            Key.buttonY: 0.72,
            Key.appearance: 0,
            Key.playerButtons: true,
            Key.alwaysShowButton: false,
            Key.airplayMode: false
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

    /// Knöpfe (Übertragen, Bild-in-Bild, AirPlay) in der Player-Leiste
    var playerButtons: Bool {
        get { return defaults.bool(forKey: Key.playerButtons) }
        set { defaults.set(newValue, forKey: Key.playerButtons) }
    }

    /// Ersatzknopf auch dann zeigen, wenn die Seite den Menü-Knopf hat
    var alwaysShowButton: Bool {
        get { return defaults.bool(forKey: Key.alwaysShowButton) }
        set { defaults.set(newValue, forKey: Key.alwaysShowButton) }
    }

    /// AirPlay-Modus: wirkt nur beim Laden der Seite (Seite danach neu laden)
    var airplayMode: Bool {
        get { return defaults.bool(forKey: Key.airplayMode) }
        set { defaults.set(newValue, forKey: Key.airplayMode) }
    }

    /// Darstellung: 0 = automatisch, 1 = hell, 2 = dunkel
    var appearance: Int {
        get { return defaults.integer(forKey: Key.appearance) }
        set { defaults.set(newValue, forKey: Key.appearance) }
    }

    var interfaceStyle: UIUserInterfaceStyle {
        switch appearance {
        case 1: return .light
        case 2: return .dark
        default: return .unspecified
        }
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
