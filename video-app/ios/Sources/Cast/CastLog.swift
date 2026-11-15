import Foundation

/// Threadsicherer Ringpuffer für das Übertragungs-Protokoll (letzte ~200 Zeilen, mit Uhrzeit).
final class CastLog {
    static let shared = CastLog()

    private let lock = NSLock()
    private var lines: [String] = []
    private let maxLines = 200
    private let formatter: DateFormatter

    private init() {
        let f = DateFormatter()
        f.locale = Locale(identifier: "de_DE")
        f.dateFormat = "HH:mm:ss.SSS"
        formatter = f
    }

    /// Hängt eine Zeile an.
    func add(_ text: String) {
        lock.lock()
        let stamp = formatter.string(from: Date())
        lines.append(stamp + "  " + text)
        if lines.count > maxLines {
            lines.removeFirst(lines.count - maxLines)
        }
        lock.unlock()
    }

    var text: String {
        lock.lock()
        let result = lines.joined(separator: "\n")
        lock.unlock()
        return result
    }

    func clear() {
        lock.lock()
        lines.removeAll()
        lock.unlock()
    }

    /// Kürzt geheime Werte (Token, SID) auf die ersten 6 Zeichen.
    static func short(_ value: String) -> String {
        if value.count <= 6 { return value }
        return String(value.prefix(6)) + "…"
    }
}
