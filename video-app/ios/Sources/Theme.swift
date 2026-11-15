import UIKit

/// Farben der App: folgen Hell/Dunkel des Systems (wie die YouTube-App).
enum Theme {
    /// Hintergrund, solange die Seite noch keine eigene Farbe meldet (hell #FFFFFF, dunkel #0F0F0F).
    static let background = UIColor { traits in
        if traits.userInterfaceStyle == .dark {
            return UIColor(red: 15.0 / 255.0, green: 15.0 / 255.0, blue: 15.0 / 255.0, alpha: 1.0)
        }
        return UIColor.white
    }
}
