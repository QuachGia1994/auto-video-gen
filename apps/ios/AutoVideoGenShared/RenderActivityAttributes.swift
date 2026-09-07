import ActivityKit
import Foundation

struct RenderActivityAttributes: ActivityAttributes, Sendable {
    struct ContentState: Codable, Hashable, Sendable {
        var progress: Double
        var phase: String
        var completed: Bool
        var failed: Bool
    }

    let jobID: String
    let title: String
}
