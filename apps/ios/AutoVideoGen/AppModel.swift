import Foundation
import Observation

enum SourceKind: String, CaseIterable, Identifiable, Sendable {
    case url = "URL"
    case text = "Text"
    case markdown = "Markdown"

    var id: Self { self }

    var labelKey: String {
        switch self {
        case .url: "source.url"
        case .text: "source.text"
        case .markdown: "source.markdown"
        }
    }

    var placeholderKey: String {
        switch self {
        case .url: "create.placeholderUrl"
        case .text: "create.placeholderText"
        case .markdown: "create.placeholderMarkdown"
        }
    }
}

enum ProjectStatus: String, Sendable {
    case draft = "Draft"
    case processing = "Processing"
    case completed = "Completed"

    var labelKey: String {
        switch self {
        case .draft: "status.draft"
        case .processing: "status.processing"
        case .completed: "status.completed"
        }
    }
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
    var progress: Double

    var titleKey: String { "step.\(camelID)Title" }
    var detailKey: String { "step.\(camelID)Detail" }

    private var camelID: String { id == "audio" ? "audioMix" : id }

    static let defaults: [PipelineStep] = [
        .init(id: "script", progress: 0),
        .init(id: "voice", progress: 0),
        .init(id: "motion", progress: 0),
        .init(id: "audio", progress: 0),
        .init(id: "render", progress: 0)
    ]
}

enum GenerationEvent: Sendable {
    case started(jobID: String, title: String)
    case progress(stepID: String, value: Double)
    case completed(VideoProject)
}

protocol VideoGenerationService: Sendable {
    func generate(_ request: GenerationRequest) -> AsyncThrowingStream<GenerationEvent, Error>
    func resume(jobID: String) -> AsyncThrowingStream<GenerationEvent, Error>
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
    private var activeJobID: String?

    init(service: any VideoGenerationService = MobileAPIVideoGenerationService()) {
        self.service = service
    }

    func generate(_ request: GenerationRequest) async {
        guard !isGenerating else { return }
        await consume(service.generate(request))
    }

    func resumeActiveGenerationIfNeeded() async {
        guard !isGenerating, let record = ActiveRenderStore.load() else { return }
        await consume(service.resume(jobID: record.jobID))
    }

    private func consume(_ stream: AsyncThrowingStream<GenerationEvent, Error>) async {
        isGenerating = true
        defer { isGenerating = false }
        errorMessage = nil
        steps = PipelineStep.defaults
        currentProject = nil

        do {
            for try await event in stream {
                switch event {
                case let .started(jobID, title):
                    activeJobID = jobID
                    ActiveRenderStore.save(jobID: jobID, title: title)
                    if let baseURL = BackendConfig.baseURL {
                        BackgroundRenderMonitor.shared.track(
                            jobID: jobID,
                            baseURL: baseURL,
                            authToken: BackendConfig.authToken
                        )
                    }
                    if let baseURL = BackendConfig.baseURL {
                        RenderLiveActivityController.shared.start(
                            jobID: jobID,
                            title: title,
                            baseURL: baseURL,
                            authToken: BackendConfig.authToken
                        )
                    }

                case let .progress(stepID, value):
                    if let index = steps.firstIndex(where: { $0.id == stepID }) {
                        steps[index].progress = value
                    }
                    if let activeJobID {
                        await RenderLiveActivityController.shared.update(
                            jobID: activeJobID,
                            progress: overallProgress,
                            phase: phaseLabel(stepID: stepID, value: value)
                        )
                    }

                case let .completed(project):
                    currentProject = project
                    if !projects.contains(where: { $0.id == project.id }) {
                        projects.insert(project, at: 0)
                    }
                    if let activeJobID {
                        ActiveRenderStore.clear(jobID: activeJobID)
                        await RenderLiveActivityController.shared.finish(jobID: activeJobID, failed: false)
                    }
                    activeJobID = nil
                }
            }
        } catch is CancellationError {
            return
        } catch {
            errorMessage = error.localizedDescription
            if let activeJobID,
               let apiError = error as? MobileAPIError,
               apiError.isTerminal {
                ActiveRenderStore.clear(jobID: activeJobID)
                await RenderLiveActivityController.shared.finish(jobID: activeJobID, failed: true)
                self.activeJobID = nil
            }
        }
    }

    private var overallProgress: Double {
        guard !steps.isEmpty else { return 0 }
        return steps.reduce(0) { $0 + min(max($1.progress, 0), 1) } / Double(steps.count)
    }

    private func phaseLabel(stepID: String, value: Double) -> String {
        let phase: String
        switch stepID {
        case "script": phase = "Script"
        case "voice": phase = "Voice"
        case "motion": phase = "Motion"
        case "audio": phase = "Audio mix"
        case "render": phase = "Render"
        default: phase = "Processing"
        }
        return "\(phase) \(Int((min(max(value, 0), 1) * 100).rounded()))%"
    }
}
