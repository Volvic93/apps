import ActivityKit
import Foundation

/// Daten der Live-Aktivität „Training läuft“. Diese Datei gehört sowohl zur App als auch zur Widget-Erweiterung.
public struct EisenzeitActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// Aktuelle Übung
        public var exercise: String
        /// Aktueller Satz (1-basiert) und Zahl der Sätze der Übung
        public var setIndex: Int
        public var setTotal: Int
        /// Ziel, z. B. „3 × 8–12 · 40 kg“
        public var target: String
        /// Fortschritt der ganzen Einheit, 0 bis 1
        public var progress: Double
        /// Ende der laufenden Pause (nil: keine Pause)
        public var restEndsAt: Date?

        public init(exercise: String, setIndex: Int, setTotal: Int, target: String, progress: Double, restEndsAt: Date?) {
            self.exercise = exercise
            self.setIndex = setIndex
            self.setTotal = setTotal
            self.target = target
            self.progress = progress
            self.restEndsAt = restEndsAt
        }
    }

    /// Name der Einheit und Beginn (für die laufende Trainingsdauer)
    public var workout: String
    public var startedAt: Date

    public init(workout: String, startedAt: Date) {
        self.workout = workout
        self.startedAt = startedAt
    }
}
