import ActivityKit
import Capacitor
import Foundation

/// Capacitor-Plugin: startet, aktualisiert und beendet die Live-Aktivität „Training läuft“.
/// JavaScript-Name: EisenzeitLiveActivity (siehe webapp/src/platform/capacitor.ts)
@objc(EisenzeitLiveActivityPlugin)
public class EisenzeitLiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EisenzeitLiveActivityPlugin"
    public let jsName = "EisenzeitLiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
    ]

    private func state(from call: CAPPluginCall) -> EisenzeitActivityAttributes.ContentState {
        var rest: Date? = nil
        if let ms = call.getDouble("restEndsAt") {
            rest = Date(timeIntervalSince1970: ms / 1000)
        }
        return EisenzeitActivityAttributes.ContentState(
            exercise: call.getString("exercise") ?? "",
            setIndex: call.getInt("setIndex") ?? 1,
            setTotal: call.getInt("setTotal") ?? 1,
            target: call.getString("target") ?? "",
            progress: call.getDouble("progress") ?? 0,
            restEndsAt: rest
        )
    }

    @objc func start(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            startActivity(call)
        } else {
            call.resolve(["started": false])
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            updateActivity(call)
        } else {
            call.resolve()
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            endActivities(call)
        } else {
            call.resolve()
        }
    }

    @available(iOS 16.2, *)
    private func startActivity(_ call: CAPPluginCall) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.resolve(["started": false, "reason": "Live-Aktivitäten sind ausgeschaltet"])
            return
        }
        let content = ActivityContent(state: state(from: call), staleDate: nil)
        let startedMs = call.getDouble("startedAt") ?? (Date().timeIntervalSince1970 * 1000)
        let attributes = EisenzeitActivityAttributes(
            workout: call.getString("workout") ?? "Training",
            startedAt: Date(timeIntervalSince1970: startedMs / 1000)
        )
        Task {
            // Reste einer früheren Aktivität (z. B. nach App-Neustart) zuerst beenden
            for old in Activity<EisenzeitActivityAttributes>.activities {
                await old.end(nil, dismissalPolicy: .immediate)
            }
            do {
                _ = try Activity<EisenzeitActivityAttributes>.request(attributes: attributes, content: content, pushType: nil)
                call.resolve(["started": true])
            } catch {
                call.resolve(["started": false, "reason": error.localizedDescription])
            }
        }
    }

    @available(iOS 16.2, *)
    private func updateActivity(_ call: CAPPluginCall) {
        let content = ActivityContent(state: state(from: call), staleDate: nil)
        Task {
            for activity in Activity<EisenzeitActivityAttributes>.activities {
                await activity.update(content)
            }
            call.resolve()
        }
    }

    @available(iOS 16.2, *)
    private func endActivities(_ call: CAPPluginCall) {
        Task {
            for activity in Activity<EisenzeitActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve()
        }
    }
}
