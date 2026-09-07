import Foundation

enum BackendConfig {
    static var baseURL: URL? {
        let raw = (Bundle.main.object(forInfoDictionaryKey: "MobileAPIBaseURL") as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let raw, !raw.isEmpty else { return nil }
        return URL(string: raw)
    }

    static var authToken: String? {
        let raw = (Bundle.main.object(forInfoDictionaryKey: "MobileAPIAuthToken") as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let raw, !raw.isEmpty else { return nil }
        return raw
    }
}

private struct RenderJobResponse: Decodable, Sendable {
    struct Progress: Decodable, Sendable {
        let step: Int
        let total: Int
        let message: String
        let fraction: Double?
    }

    let id: String
    let title: String
    let sceneCount: Int
    let voice: String
    let status: String
    let progress: Progress?
    let videoUrl: String?
}

struct MobileAPIError: LocalizedError, Sendable {
    let messageKey: String
    let replacements: [String: String]
    let isTerminal: Bool

    init(_ messageKey: String, replacements: [String: String] = [:], isTerminal: Bool = false) {
        self.messageKey = messageKey
        self.replacements = replacements
        self.isTerminal = isTerminal
    }

    var errorDescription: String? {
        replacements.reduce(Strings.localized(messageKey, language: .persistedOrDevice())) { message, replacement in
            message.replacingOccurrences(of: "{\(replacement.key)}", with: replacement.value)
        }
    }
}

struct MobileAPIVideoGenerationService: VideoGenerationService {
    private enum StartPoint: Sendable {
        case create(GenerationRequest)
        case resume(String)
    }

    private let baseURL: URL?
    private let authToken: String?
    private let session: URLSession

    init(
        baseURL: URL? = BackendConfig.baseURL,
        authToken: String? = BackendConfig.authToken,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.authToken = authToken
        self.session = session
    }

    func generate(_ request: GenerationRequest) -> AsyncThrowingStream<GenerationEvent, Error> {
        makeStream(startingAt: .create(request))
    }

    func resume(jobID: String) -> AsyncThrowingStream<GenerationEvent, Error> {
        makeStream(startingAt: .resume(jobID))
    }

    private func makeStream(startingAt startPoint: StartPoint) -> AsyncThrowingStream<GenerationEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    guard let baseURL else {
                        throw MobileAPIError("error.backendNotConfigured", isTerminal: true)
                    }

                    var job: RenderJobResponse
                    switch startPoint {
                    case let .create(request):
                        continuation.yield(.progress(stepID: "script", value: 0.1))
                        job = try await createJob(request, baseURL: baseURL)
                    case let .resume(jobID):
                        job = try await fetchJob(id: jobID, baseURL: baseURL)
                    }

                    continuation.yield(.started(jobID: job.id, title: job.title))
                    continuation.yield(.progress(stepID: "script", value: 1))
                    try await poll(job: &job, baseURL: baseURL, continuation: continuation)
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    private func poll(
        job: inout RenderJobResponse,
        baseURL: URL,
        continuation: AsyncThrowingStream<GenerationEvent, Error>.Continuation
    ) async throws {
        let deadline = Date.now.addingTimeInterval(30 * 60)
        var pollDelayMilliseconds = 450

        while true {
            for event in progressEvents(job) { continuation.yield(event) }
            if job.status == "failed" {
                throw MobileAPIError("error.renderFailed", isTerminal: true)
            }
            if job.status == "completed" {
                guard let videoPath = job.videoUrl,
                      let videoURL = URL(string: videoPath, relativeTo: baseURL)?.absoluteURL else {
                    throw MobileAPIError("error.missingVideoURL", isTerminal: true)
                }
                continuation.yield(.completed(VideoProject(
                    id: UUID(uuidString: job.id) ?? UUID(),
                    title: job.title,
                    duration: nil,
                    createdAt: .now,
                    status: .completed,
                    theme: nil,
                    voice: job.voice,
                    sceneCount: job.sceneCount,
                    videoURL: videoURL
                )))
                continuation.finish()
                return
            }

            try Task.checkCancellation()
            guard Date.now < deadline else {
                throw MobileAPIError("error.timeout", isTerminal: true)
            }
            try await Task.sleep(for: .milliseconds(pollDelayMilliseconds))
            pollDelayMilliseconds = min(Int(Double(pollDelayMilliseconds) * 1.4), 2_500)
            do {
                job = try await fetchJob(id: job.id, baseURL: baseURL)
            } catch let error as MobileAPIError where error.isTerminal {
                throw error
            } catch {
                continue
            }
        }
    }

    private func createJob(_ source: GenerationRequest, baseURL: URL) async throws -> RenderJobResponse {
        let body = try JSONSerialization.data(withJSONObject: ["sourceKind": source.sourceKind.rawValue, "content": source.content])
        return try await request(path: "/v1/generate", method: "POST", body: body, baseURL: baseURL)
    }

    private func fetchJob(id: String, baseURL: URL) async throws -> RenderJobResponse {
        try await request(path: "/v1/render-jobs/\(id)", method: "GET", body: nil, baseURL: baseURL)
    }

    private func request(path: String, method: String, body: Data?, baseURL: URL) async throws -> RenderJobResponse {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw MobileAPIError("error.invalidBackendURL", isTerminal: true)
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        if let authToken { request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization") }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw MobileAPIError("error.invalidBackendResponse")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw MobileAPIError(
                "error.backendHttp",
                replacements: ["status": String(http.statusCode)],
                isTerminal: (400..<500).contains(http.statusCode)
            )
        }
        return try JSONDecoder().decode(RenderJobResponse.self, from: data)
    }

    private func progressEvents(_ job: RenderJobResponse) -> [GenerationEvent] {
        let step = job.progress?.step ?? 0
        var events: [GenerationEvent] = [.progress(stepID: "script", value: 1)]
        if step >= 3 { events.append(.progress(stepID: "voice", value: step >= 5 ? 1 : 0.65)) }
        if step >= 5 { events.append(.progress(stepID: "audio", value: step >= 6 ? 1 : 0.8)) }
        if step >= 6 { events.append(.progress(stepID: "motion", value: step >= 7 ? 1 : 0.85)) }
        if step >= 7 {
            let renderProgress = step >= 8 ? 1 : min(max(job.progress?.fraction ?? 0.05, 0), 1)
            events.append(.progress(stepID: "render", value: renderProgress))
        }
        events.append(.overallProgress(liveActivityProgress(job)))
        return events
    }

    private func liveActivityProgress(_ job: RenderJobResponse) -> Double {
        let total = max(job.progress?.total ?? 8, 1)
        let step = min(max(job.progress?.step ?? 1, 1), total)
        let inner: Double
        if step >= total {
            inner = 1
        } else if step == total - 1 {
            inner = min(max(job.progress?.fraction ?? 0, 0), 1)
        } else {
            inner = 0
        }
        return min(max((Double(step - 1) + inner) / Double(total), 0), 1)
    }
}
