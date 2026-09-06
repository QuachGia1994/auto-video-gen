import Foundation
import Observation

enum SourceKind: String, CaseIterable, Identifiable, Sendable {
    case url = "URL"
    case text = "Text"
    case markdown = "Markdown"

    var id: Self { self }
    var placeholder: String {
        switch self {
        case .url: "https://example.com/article"
        case .text: "Paste an article, idea, or script"
        case .markdown: "Paste Markdown content"
        }
    }
}

enum ProjectStatus: String, Sendable {
    case draft = "Draft"
    case processing = "Processing"
    case completed = "Completed"
}

struct GenerationRequest: Sendable {
    let sourceKind: SourceKind
    let content: String
}

struct VideoProject: Identifiable, Hashable, Sendable {
    let id: UUID
    let title: String
    let duration: String?
    let createdAt: Date
    let status: ProjectStatus
    let theme: String
    let voice: String
    let sceneCount: Int
    let videoURL: URL?
}

struct PipelineStep: Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let detail: String
    var progress: Double

    static let defaults: [PipelineStep] = [
        .init(id: "script", title: "Script", detail: "Writing the short-form narrative", progress: 0),
        .init(id: "voice", title: "Voice", detail: "Generating natural narration", progress: 0),
        .init(id: "motion", title: "Motion", detail: "Building vertical motion scenes", progress: 0),
        .init(id: "audio", title: "Audio Mix", detail: "Balancing voice, music, and SFX", progress: 0),
        .init(id: "render", title: "Render", detail: "Exporting the 9:16 MP4", progress: 0)
    ]
}

enum GenerationEvent: Sendable {
    case progress(stepID: String, value: Double)
    case completed(VideoProject)
}

protocol VideoGenerationService: Sendable {
    func generate(_ request: GenerationRequest) -> AsyncThrowingStream<GenerationEvent, Error>
}

@MainActor
@Observable
final class AppModel {
    var steps = PipelineStep.defaults
    var isGenerating = false
    var currentProject: VideoProject?
    var projects: [VideoProject] = []
    var errorMessage: String?

    private let service: any VideoGenerationService

    init(service: any VideoGenerationService = MobileAPIVideoGenerationService()) {
        self.service = service
    }

    func generate(_ request: GenerationRequest) async {
        guard !isGenerating else { return }
        isGenerating = true
        defer { isGenerating = false }
        errorMessage = nil
        steps = PipelineStep.defaults
        currentProject = nil

        do {
            for try await event in service.generate(request) {
                switch event {
                case let .progress(stepID, value):
                    if let index = steps.firstIndex(where: { $0.id == stepID }) {
                        steps[index].progress = value
                    }
                case let .completed(project):
                    currentProject = project
                    projects.insert(project, at: 0)
                }
            }
        } catch is CancellationError {
            return
        } catch {
            errorMessage = error.localizedDescription
        }
    }

}
