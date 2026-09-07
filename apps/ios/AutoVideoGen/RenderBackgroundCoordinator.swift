import ActivityKit
import Foundation
import UIKit
import UserNotifications

struct ActiveRenderRecord: Codable, Sendable {
    let jobID: String
    let title: String
    let startedAt: Date
}

enum ActiveRenderStore {
    private static let key = "active_render_job_v1"

    static func load() -> ActiveRenderRecord? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(ActiveRenderRecord.self, from: data)
    }

    static func save(jobID: String, title: String) {
        let record = ActiveRenderRecord(jobID: jobID, title: title, startedAt: .now)
        guard let data = try? JSONEncoder().encode(record) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    static func clear(jobID: String? = nil) {
        guard let jobID else {
            UserDefaults.standard.removeObject(forKey: key)
            return
        }
        guard load()?.jobID == jobID else { return }
        UserDefaults.standard.removeObject(forKey: key)
    }
}

enum LiveActivityPushRegistrationStore {
    private static let key = "registered_live_activity_push_jobs_v1"

    static func contains(_ jobID: String) -> Bool {
        Set(UserDefaults.standard.stringArray(forKey: key) ?? []).contains(jobID)
    }

    static func mark(_ jobID: String) {
        var jobs = Set(UserDefaults.standard.stringArray(forKey: key) ?? [])
        jobs.insert(jobID)
        UserDefaults.standard.set(Array(jobs), forKey: key)
    }

    static func clear(_ jobID: String) {
        var jobs = Set(UserDefaults.standard.stringArray(forKey: key) ?? [])
        jobs.remove(jobID)
        UserDefaults.standard.set(Array(jobs), forKey: key)
    }
}

private enum LiveActivityPushTokenRegistrar {
    static func register(jobID: String, token: Data, baseURL: URL, authToken: String?) async {
        let hexToken = token.map { String(format: "%02x", $0) }.joined()
        guard let url = URL(string: "/v1/render-jobs/\(jobID)/live-activity-token", relativeTo: baseURL)?.absoluteURL,
              let body = try? JSONSerialization.data(withJSONObject: ["token": hexToken]) else { return }

        for attempt in 0..<4 {
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            if let authToken { request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization") }
            do {
                let (_, response) = try await URLSession.shared.data(for: request)
                if let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) {
                    LiveActivityPushRegistrationStore.mark(jobID)
                    return
                }
            } catch {
                // Retry below; background completion monitoring remains the fallback.
            }
            if attempt < 3 { try? await Task.sleep(for: .seconds(2 << attempt)) }
        }
    }
}

@MainActor
final class RenderLiveActivityController {
    static let shared = RenderLiveActivityController()

    private var tokenObservers: [String: Task<Void, Never>] = [:]

    private init() {}

    func start(jobID: String, title: String, baseURL: URL, authToken: String?) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let active: Activity<RenderActivityAttributes>
        if let existing = activity(jobID: jobID) {
            active = existing
        } else {
            let state = RenderActivityAttributes.ContentState(
                progress: 0.05,
                phase: "Queued",
                completed: false,
                failed: false
            )
            let content = ActivityContent(state: state, staleDate: nil)
            do {
                active = try Activity.request(
                    attributes: RenderActivityAttributes(jobID: jobID, title: title),
                    content: content,
                    pushType: .token
                )
            } catch {
                // Live Activity is supplementary. Generation must continue if it is unavailable.
                return
            }
        }
        observePushTokens(for: active, jobID: jobID, baseURL: baseURL, authToken: authToken)
    }

    private func observePushTokens(
        for activity: Activity<RenderActivityAttributes>,
        jobID: String,
        baseURL: URL,
        authToken: String?
    ) {
        tokenObservers[jobID]?.cancel()
        tokenObservers[jobID] = Task {
            if let token = activity.pushToken {
                await LiveActivityPushTokenRegistrar.register(
                    jobID: jobID,
                    token: token,
                    baseURL: baseURL,
                    authToken: authToken
                )
            }
            for await token in activity.pushTokenUpdates {
                guard !Task.isCancelled else { return }
                await LiveActivityPushTokenRegistrar.register(
                    jobID: jobID,
                    token: token,
                    baseURL: baseURL,
                    authToken: authToken
                )
            }
        }
    }

    func update(jobID: String, progress: Double, phase: String) async {
        guard let activity = activity(jobID: jobID) else { return }
        let state = RenderActivityAttributes.ContentState(
            progress: min(max(progress, 0), 1),
            phase: phase,
            completed: false,
            failed: false
        )
        await activity.update(ActivityContent(state: state, staleDate: nil))
    }

    func finish(jobID: String, failed: Bool) async {
        guard let activity = activity(jobID: jobID) else { return }
        let state = RenderActivityAttributes.ContentState(
            progress: failed ? 0 : 1,
            phase: failed ? "Render stopped" : "Ready to review",
            completed: !failed,
            failed: failed
        )
        let dismissalPolicy: ActivityUIDismissalPolicy = failed
            ? .default
            : .after(.now.addingTimeInterval(15 * 60))
        await activity.end(
            ActivityContent(state: state, staleDate: nil),
            dismissalPolicy: dismissalPolicy
        )
        tokenObservers[jobID]?.cancel()
        tokenObservers[jobID] = nil
    }

    private func activity(jobID: String) -> Activity<RenderActivityAttributes>? {
        Activity<RenderActivityAttributes>.activities.first { $0.attributes.jobID == jobID }
    }
}

private struct BackgroundRenderResult: Decodable, Sendable {
    let id: String
    let title: String
    let status: String
    let error: String?
    let videoUrl: String?
}

final class BackgroundRenderMonitor: NSObject, URLSessionDownloadDelegate, @unchecked Sendable {
    static let shared = BackgroundRenderMonitor()
    static let sessionIdentifier = "com.autovideogen.mobile.render-monitor"

    private let lock = NSLock()
    private var backgroundEventsCompletionHandler: (() -> Void)?
    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.background(withIdentifier: Self.sessionIdentifier)
        configuration.sessionSendsLaunchEvents = true
        configuration.isDiscretionary = false
        configuration.waitsForConnectivity = true
        configuration.timeoutIntervalForRequest = 45 * 60
        configuration.timeoutIntervalForResource = 60 * 60
        let queue = OperationQueue()
        queue.maxConcurrentOperationCount = 1
        return URLSession(configuration: configuration, delegate: self, delegateQueue: queue)
    }()

    private override init() {
        super.init()
    }

    func reconnect() {
        _ = session
    }

    func track(jobID: String, baseURL: URL, authToken: String?) {
        requestNotificationPermission()
        guard let url = URL(string: "/v1/render-jobs/\(jobID)/wait", relativeTo: baseURL)?.absoluteURL else { return }
        session.getAllTasks { [weak self] tasks in
            guard let self else { return }
            guard !tasks.contains(where: { $0.taskDescription == jobID }) else { return }
            var request = URLRequest(url: url)
            request.httpMethod = "GET"
            request.timeoutInterval = 45 * 60
            if let authToken {
                request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
            }
            let task = self.session.downloadTask(with: request)
            task.taskDescription = jobID
            task.resume()
        }
    }

    func setBackgroundEventsCompletionHandler(_ completionHandler: @escaping () -> Void) {
        lock.lock()
        backgroundEventsCompletionHandler = completionHandler
        lock.unlock()
        reconnect()
    }

    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        guard let data = try? Data(contentsOf: location),
              let result = try? JSONDecoder().decode(BackgroundRenderResult.self, from: data) else { return }
        Task { @MainActor in
            await RenderLiveActivityController.shared.finish(
                jobID: result.id,
                failed: result.status != "completed"
            )
        }
        if LiveActivityPushRegistrationStore.contains(result.id) {
            LiveActivityPushRegistrationStore.clear(result.id)
        } else {
            scheduleCompletionNotification(result)
        }
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: (any Error)?
    ) {
        guard error == nil else { return }
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        lock.lock()
        let handler = backgroundEventsCompletionHandler
        backgroundEventsCompletionHandler = nil
        lock.unlock()
        handler?()
    }

    private func requestNotificationPermission() {
        Task {
            _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
        }
    }

    private func scheduleCompletionNotification(_ result: BackgroundRenderResult) {
        let content = UNMutableNotificationContent()
        if result.status == "completed" {
            content.title = "Video ready"
            content.body = "\(result.title) finished rendering and is ready to review."
            content.sound = .default
        } else {
            content.title = "Render stopped"
            content.body = result.error ?? "\(result.title) could not be completed."
            content.sound = .default
        }
        content.userInfo = ["jobID": result.id]
        let request = UNNotificationRequest(
            identifier: "render-terminal-\(result.id)",
            content: content,
            trigger: nil
        )
        UNUserNotificationCenter.current().add(request) { _ in }
    }
}

@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        handleEventsForBackgroundURLSession identifier: String,
        completionHandler: @escaping () -> Void
    ) {
        guard identifier == BackgroundRenderMonitor.sessionIdentifier else {
            completionHandler()
            return
        }
        BackgroundRenderMonitor.shared.setBackgroundEventsCompletionHandler(completionHandler)
    }
}
