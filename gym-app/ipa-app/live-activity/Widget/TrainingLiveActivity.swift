import ActivityKit
import SwiftUI
import WidgetKit

private let neon = Color(red: 0.878, green: 0.973, blue: 0.290)  // #E0F84A
private let brand = Color(red: 0.012, green: 0.196, blue: 0.125) // #033220

/// Restzeit der Pause als Bereich – `now` wird nur einmal gelesen, damit `end` nie vor dem Beginn liegt.
private func restRange(_ end: Date?) -> ClosedRange<Date>? {
    guard let end = end else { return nil }
    let now = Date()
    return end > now ? now...end : nil
}

struct TrainingLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: EisenzeitActivityAttributes.self) { context in
            LockScreenView(context: context)
                .activityBackgroundTint(brand)
                .activitySystemActionForegroundColor(neon)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.exercise)
                        .font(.headline)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("Satz \(context.state.setIndex)/\(context.state.setTotal)")
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(neon)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        if let range = restRange(context.state.restEndsAt) {
                            HStack {
                                Text("Pause")
                                Spacer()
                                Text(timerInterval: range, countsDown: true)
                                    .monospacedDigit()
                                    .foregroundStyle(neon)
                            }
                            .font(.title3.bold())
                        } else {
                            Text(context.state.target)
                                .font(.subheadline)
                        }
                        ProgressView(value: context.state.progress)
                            .tint(neon)
                    }
                }
            } compactLeading: {
                Image(systemName: "dumbbell.fill")
                    .foregroundStyle(neon)
            } compactTrailing: {
                if let range = restRange(context.state.restEndsAt) {
                    Text(timerInterval: range, countsDown: true)
                        .monospacedDigit()
                        .frame(width: 44)
                        .foregroundStyle(neon)
                } else {
                    Text("\(context.state.setIndex)/\(context.state.setTotal)")
                        .monospacedDigit()
                }
            } minimal: {
                Image(systemName: "dumbbell.fill")
                    .foregroundStyle(neon)
            }
        }
    }
}

struct LockScreenView: View {
    let context: ActivityViewContext<EisenzeitActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(context.attributes.workout)
                    .font(.headline)
                    .foregroundStyle(neon)
                Spacer()
                Text(context.attributes.startedAt, style: .timer)
                    .font(.subheadline.monospacedDigit())
                    .multilineTextAlignment(.trailing)
            }
            Text(context.state.exercise)
                .font(.title3.bold())
                .lineLimit(1)
            Text("Satz \(context.state.setIndex) von \(context.state.setTotal) · \(context.state.target)")
                .font(.subheadline)
                .lineLimit(1)
            if let range = restRange(context.state.restEndsAt) {
                HStack {
                    Text("Pause")
                    Spacer()
                    Text(timerInterval: range, countsDown: true)
                        .monospacedDigit()
                        .foregroundStyle(neon)
                }
                .font(.title2.bold())
            }
            ProgressView(value: context.state.progress)
                .tint(neon)
        }
        .padding()
        .foregroundStyle(.white)
    }
}
