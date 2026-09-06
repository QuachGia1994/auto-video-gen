import Foundation

enum BackendConfig {
    static var baseURL: URL? {
        let raw = (Bundle.main.object(forInfoDictionaryKey: "MobileAPIBaseURL") as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let raw, !raw.isEmpty else { return nil }
        return URL(string: raw)
    }
}

private struct RenderJobResponse: Decodable, Sendable {
    struct Progress: Decodable, Sendable {
        let step: Int
        let total: Int
        let message: String
    }

    let id: String
    let title: String
    let sceneCount: Int
    let voice: String
    let status: String
    let progress: Progress?
    let error: String?
    let videoUrl: String?
}

private struct APIErrorBody: Decodable {
    let error: String?
    let message: String?
}

private struct MobileAPIError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

struct MobileAPIVideoGenerationService: VideoGenerationService {
    private let baseURL: URL?
    private let session: URLSession

    init(baseURL: URL? = BackendConfig.baseURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func generate(_ request: GenerationRequest) -> AsyncThrowingStream<GenerationEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    guard let baseURL else {
                        throw MobileAPIError(message: "Backend not configured. Set MobileAPIBaseURL before generating a video.")
                    }
                    continuation.yield(.progress(stepID: "script", value: 0.1))
                    var job = try await createJob(request, baseURL: baseURL)
                    continuation.yield(.progress(stepID: "script", value: 1))
                    let deadline = Date.now.addingTimeInterval(30 * 60)
                    var pollDelayMilliseconds = 450

                    while true {
                        for event in progressEvents(job) { continuation.yield(event) }
                        if job.status == "failed" {
                            throw MobileAPIError(message: job.error ?? "Render failed")
                        }
                        if job.status == "completed" {
                            guard let videoPath = job.videoUrl, let videoURL = URL(string: videoPath, relativeTo: baseURL)?.absoluteURL else {
                                throw MobileAPIError(message: "Render completed without a video URL")
                            }
                            continuation.yield(.completed(VideoProject(
                                id: UUID(uuidString: job.id) ?? UUID(),
                                title: job.title,
                                duration: nil,
                                createdAt: .now,
                                status: .completed,
                                theme: "Server default",
                                voice: job.voice,
                                sceneCount: job.sceneCount,
                                videoURL: videoURL
                            )))
                            continuation.finish()
                            return
                        }
                        try Task.checkCancellation()
                        guard Date.now < deadline else {
                            throw MobileAPIError(message: "Generation timed out after 30 minutes")
                        }
                        try await Task.sleep(for: .milliseconds(pollDelayMilliseconds))
                        pollDelayMilliseconds = min(Int(Double(pollDelayMilliseconds) * 1.4), 2_500)
                        job = try await fetchJob(id: job.id, baseURL: baseURL)
                    }
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
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
            throw MobileAPIError(message: "Invalid backend URL")
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw MobileAPIError(message: "Invalid backend response") }
        guard (200..<300).contains(http.statusCode) else {
            let error = try? JSONDecoder().decode(APIErrorBody.self, from: data)
            throw MobileAPIError(message: error?.message ?? error?.error ?? "Backend HTTP \(http.statusCode)")
        }
        return try JSONDecoder().decode(RenderJobResponse.self, from: data)
    }

    private func progressEvents(_ job: RenderJobResponse) -> [GenerationEvent] {
        let step = job.progress?.step ?? 0
        var events: [GenerationEvent] = [.progress(stepID: "script", value: 1)]
        if step >= 3 { events.append(.progress(stepID: "voice", value: step >= 5 ? 1 : 0.65)) }
        if step >= 5 { events.append(.progress(stepID: "audio", value: step >= 6 ? 1 : 0.8)) }
        if step >= 6 { events.append(.progress(stepID: "motion", value: step >= 7 ? 1 : 0.85)) }
        if step >= 7 { events.append(.progress(stepID: "render", value: step >= 8 ? 1 : 0.75)) }
        return events
    }
}
