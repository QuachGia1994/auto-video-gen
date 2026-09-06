import Foundation
import SwiftUI

struct SurfaceCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Brand.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
            }
    }
}

struct HomeView: View {
    @Environment(AppModel.self) private var appModel
    @State private var sourceKind = SourceKind.url
    @State private var content = ""

    private var request: GenerationRequest {
        .init(sourceKind: sourceKind, content: content)
    }

    var body: some View {
        ZStack {
            BrandBackground()
            ScrollView {
                VStack(spacing: 22) {
                    hero
                    createCard
                    recentProjects
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 28)
            }
        }
        .navigationTitle("Create")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("News article", systemImage: "newspaper") { sourceKind = .url }
                    Button("Plain text", systemImage: "text.alignleft") { sourceKind = .text }
                    Button("Markdown", systemImage: "doc.text") { sourceKind = .markdown }
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Choose source")
            }
        }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                BrandMark(size: 46)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Auto Video Gen")
                        .font(.headline)
                    Text("AI short-video studio")
                        .font(.caption)
                        .foregroundStyle(Brand.muted)
                }
            }

            Text("Paste anything.\nTurn it into a video.")
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .tracking(-0.7)
            Text("Start from an article, GitHub repo, text, or Markdown. The pipeline writes, voices, animates, mixes, and renders a vertical short.")
                .font(.subheadline)
                .foregroundStyle(Brand.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 8)
    }

    private var createCard: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 16) {
                Picker("Source", selection: $sourceKind) {
                    ForEach(SourceKind.allCases) { kind in
                        Text(kind.rawValue).tag(kind)
                    }
                }
                .pickerStyle(.segmented)

                TextField(sourceKind.placeholder, text: $content, axis: .vertical)
                    .lineLimit(sourceKind == .url ? 1...2 : 4...8)
                    .textInputAutocapitalization(sourceKind == .url ? .never : .sentences)
                    .autocorrectionDisabled(sourceKind == .url)
                    .padding(14)
                    .background(Color.black.opacity(0.28), in: RoundedRectangle(cornerRadius: 14, style: .continuous))

                NavigationLink {
                    GenerationView(request: request)
                } label: {
                    HStack {
                        Image(systemName: "sparkles")
                        Text("Generate Video")
                            .fontWeight(.semibold)
                        Spacer()
                        Image(systemName: "arrow.right")
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .frame(height: 52)
                    .background(Brand.gradient, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .opacity(content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.45 : 1)
            }
        }
    }

    private var recentProjects: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent Projects")
                    .font(.title3.bold())
                Spacer()
                NavigationLink("See all") {
                    LibraryView()
                }
                .font(.subheadline)
            }

            if appModel.projects.isEmpty {
                SurfaceCard {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("No videos yet")
                            .font(.headline)
                        Text("Paste a source above to create your first rendered short.")
                            .font(.subheadline)
                            .foregroundStyle(Brand.muted)
                    }
                }
            } else {
                ForEach(appModel.projects.prefix(2)) { project in
                    NavigationLink {
                        PreviewView(project: project)
                    } label: {
                        ProjectRow(project: project)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

struct ProjectRow: View {
    let project: VideoProject

    var body: some View {
        SurfaceCard {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .fill(Brand.gradient)
                    Image(systemName: "play.fill")
                        .font(.title3.bold())
                        .foregroundStyle(.white)
                }
                .frame(width: 58, height: 72)

                VStack(alignment: .leading, spacing: 6) {
                    Text(project.title)
                        .font(.headline)
                        .lineLimit(2)
                    HStack(spacing: 8) {
                        Label(project.duration ?? "Rendered", systemImage: "clock")
                        Text("•")
                        Text(project.createdAt, style: .relative)
                    }
                    .font(.caption)
                    .foregroundStyle(Brand.muted)
                    Text(project.status.rawValue)
                        .font(.caption2.bold())
                        .foregroundStyle(Brand.success)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(Brand.muted)
            }
        }
    }
}

struct GenerationView: View {
    @Environment(AppModel.self) private var appModel
    let request: GenerationRequest
    @State private var didStart = false

    var body: some View {
        ZStack {
            BrandBackground()
            ScrollView {
                VStack(spacing: 20) {
                    VStack(spacing: 7) {
                        BrandMark(size: 54)
                        Text(appModel.isGenerating ? "Creating your video" : "Generation complete")
                            .font(.title2.bold())
                        Text(appModel.isGenerating ? "The pipeline is working through each production stage." : "Your preview is ready to review.")
                            .font(.subheadline)
                            .foregroundStyle(Brand.muted)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 18)

                    SurfaceCard {
                        VStack(spacing: 18) {
                            ForEach(Array(appModel.steps.enumerated()), id: \.element.id) { index, step in
                                HStack(alignment: .top, spacing: 13) {
                                    ZStack {
                                        Circle()
                                            .fill(step.progress >= 1 ? Brand.success : Brand.primary)
                                        if step.progress >= 1 {
                                            Image(systemName: "checkmark")
                                                .font(.caption.bold())
                                        } else {
                                            Text("\(index + 1)")
                                                .font(.caption.bold())
                                        }
                                    }
                                    .foregroundStyle(.white)
                                    .frame(width: 28, height: 28)

                                    VStack(alignment: .leading, spacing: 7) {
                                        HStack {
                                            Text(step.title)
                                                .font(.subheadline.bold())
                                            Spacer()
                                            Text(step.progress, format: .percent.precision(.fractionLength(0)))
                                                .font(.caption.monospacedDigit())
                                                .foregroundStyle(Brand.muted)
                                        }
                                        Text(step.detail)
                                            .font(.caption)
                                            .foregroundStyle(Brand.muted)
                                        ProgressView(value: step.progress)
                                            .tint(step.progress >= 1 ? Brand.success : Brand.cyan)
                                    }
                                }
                            }
                        }
                    }

                    if let errorMessage = appModel.errorMessage {
                        SurfaceCard {
                            VStack(alignment: .leading, spacing: 12) {
                                Label("Generation stopped", systemImage: "exclamationmark.triangle")
                                    .font(.headline)
                                    .foregroundStyle(.red)
                                Text(errorMessage)
                                    .font(.subheadline)
                                    .foregroundStyle(Brand.muted)
                                Button("Try Again") {
                                    Task { await appModel.generate(request) }
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(Brand.primary)
                            }
                        }
                    }

                    if let project = appModel.currentProject, !appModel.isGenerating {
                        NavigationLink {
                            PreviewView(project: project)
                        } label: {
                            Label("Review Video", systemImage: "play.rectangle.fill")
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                                .frame(height: 52)
                                .foregroundStyle(.white)
                                .background(Brand.gradient, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 28)
            }
        }
        .navigationTitle("Pipeline")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            guard !didStart else { return }
            didStart = true
            await appModel.generate(request)
        }
    }
}

struct PreviewView: View {
    @Environment(\.openURL) private var openURL
    let project: VideoProject
    @State private var showBackendNotice = false

    var body: some View {
        ZStack {
            BrandBackground()
            ScrollView {
                VStack(spacing: 20) {
                    videoMock
                    sceneStrip
                    options
                    Button {
                        if let videoURL = project.videoURL {
                            openURL(videoURL)
                        } else {
                            showBackendNotice = true
                        }
                    } label: {
                        Label("Export MP4", systemImage: "square.and.arrow.up")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .foregroundStyle(.white)
                            .background(Brand.gradient, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                    }
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 30)
            }
        }
        .navigationTitle("Preview")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let videoURL = project.videoURL {
                ToolbarItem(placement: .topBarTrailing) {
                    ShareLink(item: videoURL) {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
        }
        .alert("Video unavailable", isPresented: $showBackendNotice) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("This project does not have a rendered MP4 URL.")
        }
    }

    private var videoMock: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Color.black, Brand.primary.opacity(0.72), Brand.cyan.opacity(0.38)],
                        startPoint: .top,
                        endPoint: .bottomTrailing
                    )
                )
            VStack(spacing: 18) {
                Spacer()
                Image(systemName: "sparkles")
                    .font(.largeTitle)
                    .foregroundStyle(Brand.cyan)
                Text(project.title.uppercased())
                    .font(.system(size: 30, weight: .black, design: .rounded))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 20)
                Text("A BRIGHTER STORY IN 60 SECONDS")
                    .font(.caption.bold())
                    .tracking(1.3)
                    .foregroundStyle(.white.opacity(0.72))
                Spacer()
                Image(systemName: "play.circle.fill")
                    .font(.system(size: 58))
                    .symbolRenderingMode(.hierarchical)
                Text(project.duration.map { "0:00 / \($0)" } ?? "Rendered MP4")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.white.opacity(0.72))
                    .padding(.bottom, 20)
            }
        }
        .frame(maxWidth: 320)
        .aspectRatio(9 / 16, contentMode: .fit)
        .shadow(color: Brand.primary.opacity(0.22), radius: 34, y: 18)
        .accessibilityLabel("Video preview mockup for \(project.title)")
    }

    private var sceneStrip: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Scenes")
                .font(.headline)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(0..<project.sceneCount, id: \.self) { index in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(String(format: "%02d", index + 1))
                                .font(.caption2.monospacedDigit())
                                .foregroundStyle(Brand.cyan)
                            Text(index == 0 ? "Hook" : index == project.sceneCount - 1 ? "Outro" : "Key point")
                                .font(.caption.bold())
                        }
                        .frame(width: 92, alignment: .leading)
                        .padding(12)
                        .background(Brand.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                }
            }
        }
    }

    private var options: some View {
        HStack(spacing: 12) {
            SurfaceCard {
                Label("Theme", systemImage: "paintpalette")
                    .font(.caption)
                    .foregroundStyle(Brand.muted)
                Text(project.theme)
                    .font(.subheadline.bold())
                    .padding(.top, 6)
            }
            SurfaceCard {
                Label("Voice", systemImage: "waveform")
                    .font(.caption)
                    .foregroundStyle(Brand.muted)
                Text(project.voice)
                    .font(.subheadline.bold())
                    .lineLimit(1)
                    .padding(.top, 6)
            }
        }
    }
}

struct LibraryView: View {
    @Environment(AppModel.self) private var appModel

    var body: some View {
        ZStack {
            BrandBackground()
            if appModel.projects.isEmpty {
                ContentUnavailableView(
                    "No rendered videos",
                    systemImage: "play.square.stack",
                    description: Text("Create a video first. Completed renders will appear here.")
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(appModel.projects) { project in
                            NavigationLink {
                                PreviewView(project: project)
                            } label: {
                                ProjectRow(project: project)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.bottom, 28)
                }
            }
        }
        .navigationTitle("My Videos")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Select") {}
            }
        }
    }
}

struct SettingsView: View {
    @State private var theme = "Dark Neon"
    @State private var voice = "Edge TTS"
    @State private var autoplay = true

    var body: some View {
        List {
            Section("Default production") {
                Picker("Theme", selection: $theme) {
                    Text("Dark Neon").tag("Dark Neon")
                    Text("Light Pro").tag("Light Pro")
                }
                Picker("Voice", selection: $voice) {
                    Text("Edge TTS").tag("Edge TTS")
                    Text("LucyLab").tag("LucyLab")
                    Text("Vbee").tag("Vbee")
                    Text("ElevenLabs").tag("ElevenLabs")
                }
                Toggle("Autoplay previews", isOn: $autoplay)
            }

            Section("Pipeline") {
                LabeledContent("Format", value: "1080 × 1920")
                LabeledContent("Frame rate", value: "60 FPS")
                LabeledContent("Backend", value: BackendConfig.baseURL == nil ? "Not configured" : "Configured")
            }

            Section("About") {
                HStack(spacing: 12) {
                    BrandMark(size: 42)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Auto Video Gen")
                            .font(.headline)
                        Text("Frontend concept build")
                            .font(.caption)
                            .foregroundStyle(Brand.muted)
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(BrandBackground())
        .navigationTitle("Settings")
    }
}
