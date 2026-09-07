import AVFoundation
import AVKit
import Observation
import SwiftUI
import UIKit

// Native in-app playback + real file export for a rendered project MP4.
// The `/v1/render-jobs/{id}/video` route is unauthenticated (only write
// endpoints require the bearer token), so plain AVURLAsset playback is correct;
// there is no auth to drop here. The export download still sends the bearer if
// one is configured, so it keeps working if that route is ever protected.

@MainActor
@Observable
final class VideoPreviewModel {
    enum LoadState {
        case loading
        case ready
        case failed
    }

    let player: AVPlayer
    private(set) var loadState: LoadState = .loading

    private var statusObservation: NSKeyValueObservation?
    private var failObserver: (any NSObjectProtocol)?
    private var endObserver: (any NSObjectProtocol)?

    init(url: URL) {
        let item = AVPlayerItem(asset: AVURLAsset(url: url))
        player = AVPlayer(playerItem: item)
        player.allowsExternalPlayback = true

        statusObservation = item.observe(\.status, options: [.initial, .new]) { [weak self] observed, _ in
            let status = observed.status
            Task { @MainActor in
                switch status {
                case .readyToPlay: self?.loadState = .ready
                case .failed: self?.loadState = .failed
                default: self?.loadState = .loading
                }
            }
        }
        failObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemFailedToPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.loadState = .failed }
        }
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.player.seek(to: .zero, toleranceBefore: .zero, toleranceAfter: .zero)
            }
        }
    }

    // Route media to the .playback category so audio plays even with the ring
    // switch silenced, matching a real video player.
    func activateAudioSession() {
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
        try? AVAudioSession.sharedInstance().setActive(true)
    }

    func pause() {
        player.pause()
    }

    // Explicit teardown from the view's onDisappear: NSKeyValueObservation would
    // self-invalidate on release, but the NotificationCenter token must be
    // removed to avoid a lingering observer. Deactivate the audio session so
    // other apps regain it.
    func teardown() {
        player.pause()
        statusObservation?.invalidate()
        statusObservation = nil
        if let failObserver {
            NotificationCenter.default.removeObserver(failObserver)
            self.failObserver = nil
        }
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }
}

struct VideoPlayerCard: View {
    @Environment(Localizer.self) private var loc
    @Environment(\.scenePhase) private var scenePhase
    @State private var model: VideoPreviewModel

    init(url: URL) {
        _model = State(initialValue: VideoPreviewModel(url: url))
    }

    var body: some View {
        VideoPlayer(player: model.player)
            .aspectRatio(9 / 16, contentMode: .fit)
            .frame(maxWidth: 320)
            .background(Color.black)
            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
            .overlay {
                switch model.loadState {
                case .loading:
                    ZStack {
                        Color.black.opacity(0.25)
                        VStack(spacing: 10) {
                            ProgressView().tint(.white)
                            Text(loc.t("player.loading"))
                                .font(.caption)
                                .foregroundStyle(.white.opacity(0.85))
                        }
                    }
                    .allowsHitTesting(false)
                case .failed:
                    ZStack {
                        Color.black.opacity(0.55)
                        VStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.title2)
                                .foregroundStyle(.white)
                            Text(loc.t("player.error"))
                                .font(.caption)
                                .multilineTextAlignment(.center)
                                .foregroundStyle(.white.opacity(0.9))
                                .padding(.horizontal, 16)
                        }
                    }
                case .ready:
                    EmptyView()
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
            .shadow(color: Brand.primary.opacity(0.3), radius: 34, y: 18)
            .accessibilityElement(children: .contain)
            .accessibilityLabel(loc.t("nav.preview"))
            .onAppear { model.activateAudioSession() }
            .onDisappear { model.teardown() }
            .onChange(of: scenePhase) { _, phase in
                if phase != .active { model.pause() }
            }
    }
}

@MainActor
@Observable
final class VideoExportModel {
    enum State: Equatable {
        case idle
        case preparing
        case ready(URL)
        case failed
    }

    private(set) var state: State = .idle
    private var task: Task<Void, Never>?
    private var currentFile: URL?

    private static let cacheDirectoryName = "shared-videos"

    var isPreparing: Bool {
        if case .preparing = state { return true }
        return false
    }

    func start(url: URL, authToken: String?, fileName: String) {
        guard !isPreparing else { return }
        task?.cancel()
        state = .preparing
        task = Task { [weak self] in
            await self?.run(url: url, authToken: authToken, fileName: fileName)
        }
    }

    func cancel() {
        task?.cancel()
        task = nil
        state = .idle
    }

    // Bounded cleanup: cancel work and drop the exported temp file. Called from
    // the view's onDisappear so at most one exported file survives per session,
    // on top of the OS reclaiming the temporary directory.
    func cleanup() {
        task?.cancel()
        task = nil
        if let currentFile {
            try? FileManager.default.removeItem(at: currentFile)
            self.currentFile = nil
        }
        if case .ready = state { state = .idle }
    }

    private func run(url: URL, authToken: String?, fileName: String) async {
        do {
            var request = URLRequest(url: url)
            if let authToken, !authToken.isEmpty {
                request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
            }
            let (tempURL, response) = try await URLSession.shared.download(for: request)
            try Task.checkCancellation()
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                state = .failed
                return
            }
            let directory = FileManager.default.temporaryDirectory
                .appendingPathComponent(Self.cacheDirectoryName, isDirectory: true)
            // Keep only the newest exported file.
            try? FileManager.default.removeItem(at: directory)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let destination = directory.appendingPathComponent(fileName)
            try FileManager.default.moveItem(at: tempURL, to: destination)
            currentFile = destination
            state = .ready(destination)
        } catch is CancellationError {
            state = .idle
        } catch {
            state = .failed
        }
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
