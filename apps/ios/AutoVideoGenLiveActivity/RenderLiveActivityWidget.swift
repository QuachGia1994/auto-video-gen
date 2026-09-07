import ActivityKit
import SwiftUI
import WidgetKit

@main
struct AutoVideoGenLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        RenderLiveActivityWidget()
    }
}

struct RenderLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RenderActivityAttributes.self) { context in
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: context.state.completed ? "checkmark.circle.fill" : "film.stack")
                    Text(context.attributes.title)
                        .font(.headline)
                        .lineLimit(1)
                    Spacer()
                    Text(percent(context.state.progress))
                        .font(.headline.monospacedDigit())
                }
                ProgressView(value: context.state.progress)
            }
            .padding(.vertical, 4)
            .activityBackgroundTint(.black.opacity(0.82))
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: context.state.completed ? "checkmark.circle.fill" : "film.stack")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(percent(context.state.progress))
                        .monospacedDigit()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ProgressView(value: context.state.progress)
                }
            } compactLeading: {
                Image(systemName: "film.stack")
            } compactTrailing: {
                Text(shortPercent(context.state.progress))
                    .monospacedDigit()
            } minimal: {
                Image(systemName: context.state.completed ? "checkmark" : "film")
            }
        }
    }

    private func percent(_ value: Double) -> String {
        "\(Int((min(max(value, 0), 1) * 100).rounded()))%"
    }

    private func shortPercent(_ value: Double) -> String {
        "\(Int((min(max(value, 0), 1) * 100).rounded()))"
    }
}
