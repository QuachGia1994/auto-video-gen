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
            .background(Brand.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(Brand.border, lineWidth: 1)
            }
            .shadow(color: Brand.primary.opacity(0.10), radius: 18, y: 10)
    }
}

struct HomeView: View {
    @Environment(AppModel.self) private var appModel
    @Environment(Localizer.self) private var loc
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
        .navigationTitle(loc.t("nav.create"))
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button(loc.t("create.menuNews"), systemImage: "newspaper") { sourceKind = .url }
                    Button(loc.t("create.menuPlain"), systemImage: "text.alignleft") { sourceKind = .text }
                    Button(loc.t("create.menuMarkdown"), systemImage: "doc.text") { sourceKind = .markdown }
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel(loc.t("create.chooseSource"))
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
                    Text(loc.t("app.tagline"))
                        .font(.caption)
                        .foregroundStyle(Brand.muted)
                }
            }

            Text(loc.t("create.heroTitle"))
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .tracking(-0.7)
            Text(loc.t("create.heroBody"))
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
                Picker(loc.t("create.sourcePicker"), selection: $sourceKind) {
                    ForEach(SourceKind.allCases) { kind in
                        Text(loc.t(kind.labelKey)).tag(kind)
                    }
                }
                .pickerStyle(.segmented)

                TextField(loc.t(sourceKind.placeholderKey), text: $content, axis: .vertical)
                    .lineLimit(sourceKind == .url ? 1...2 : 4...8)
                    .textInputAutocapitalization(sourceKind == .url ? .never : .sentences)
                    .autocorrectionDisabled(sourceKind == .url)
                    .padding(14)
                    .background(Brand.background.opacity(0.5), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(Brand.border, lineWidth: 1)
                    }

                NavigationLink {
                    GenerationView(request: request)
                } label: {
                    HStack {
                        Image(systemName: "sparkles")
                        Text(loc.t("create.ctaGenerate"))
                            .fontWeight(.semibold)
                        Spacer()
                        Image(systemName: "arrow.right")
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .frame(height: 52)
                    .background(Brand.gradient, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                    .shadow(color: Brand.primary.opacity(0.45), radius: 14, y: 8)
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
                Text(loc.t("create.recentProjects"))
                    .font(.title3.bold())
                Spacer()
                NavigationLink(loc.t("create.seeAll")) {
                    LibraryView()
                }
                .font(.subheadline)
            }

            if appModel.projects.isEmpty {
                SurfaceCard {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(loc.t("create.emptyTitle"))
                            .font(.headline)
                        Text(loc.t("create.emptyBody"))
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

struct StatusPill: View {
    @Environment(Localizer.self) private var loc
    let status: ProjectStatus

    private var tone: Color {
        switch status {
        case .draft: Brand.faint
        case .processing: Brand.cyan
        case .completed: Brand.success
        }
    }

    var body: some View {
        Text(loc.t(status.labelKey))
            .font(.caption2.bold())
            .padding(.horizontal, 9)
            .padding(.vertical, 3)
            .background(tone.opacity(0.16), in: Capsule())
            .foregroundStyle(tone)
    }
}

struct ProjectRow: View {
    @Environment(Localizer.self) private var loc
    let project: VideoProject

    var body: some View {
        SurfaceCard {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
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
                        Label(project.duration ?? loc.t("common.rendered"), systemImage: "clock")
                        Text("•")
                        Text(project.createdAt, format: .dateTime.hour().minute())
                            .monospacedDigit()
                    }
                    .font(.caption)
                    .foregroundStyle(Brand.muted)
                    StatusPill(status: project.status)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(Brand.faint)
            }
        }
    }
}

struct GenerationView: View {
    @Environment(AppModel.self) private var appModel
    @Environment(Localizer.self) private var loc
    let request: GenerationRequest
    @State private var didStart = false

    var body: some View {
        ZStack {
            BrandBackground()
            ScrollView {
                VStack(spacing: 20) {
                    VStack(spacing: 7) {
                        BrandMark(size: 54)
                        Text(generationTitle)
                            .font(.title2.bold())
                        Text(generationSubtitle)
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
                                            Text(loc.t(step.titleKey))
                                                .font(.subheadline.bold())
                                            Spacer()
                                            Text(step.progress, format: .percent.precision(.fractionLength(0)))
                                                .font(.caption.monospacedDigit())
                                                .foregroundStyle(Brand.muted)
                                        }
                                        Text(loc.t(step.detailKey))
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
                                Label(loc.t("generate.stopped"), systemImage: "exclamationmark.triangle")
                                    .font(.headline)
                                    .foregroundStyle(Brand.danger)
                                Text(errorMessage)
                                    .font(.subheadline)
                                    .foregroundStyle(Brand.muted)
                                Button(loc.t("generate.tryAgain")) {
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
                            Label(loc.t("generate.reviewVideo"), systemImage: "play.rectangle.fill")
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                                .frame(height: 52)
                                .foregroundStyle(.white)
                                .background(Brand.gradient, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                                .shadow(color: Brand.primary.opacity(0.45), radius: 14, y: 8)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 28)
            }
        }
        .navigationTitle(loc.t("nav.pipeline"))
        .navigationBarTitleDisplayMode(.inline)
        .task {
            guard !didStart else { return }
            didStart = true
            await appModel.generate(request)
        }
    }

    // Derive the header from actual state, not just isGenerating, so a failed
    // run never renders "Generation complete" (restores fix from commit d96d5d7).
    private var generationTitle: String {
        if appModel.isGenerating { return loc.t("generate.creatingTitle") }
        if appModel.errorMessage != nil { return loc.t("generate.stopped") }
        if appModel.currentProject != nil { return loc.t("generate.completeTitle") }
        return loc.t("generate.readyTitle")
    }

    private var generationSubtitle: String {
        if appModel.isGenerating { return loc.t("generate.creatingSubtitle") }
        if appModel.errorMessage != nil { return loc.t("generate.stoppedSubtitle") }
        if appModel.currentProject != nil { return loc.t("generate.completeSubtitle") }
        return loc.t("generate.readySubtitle")
    }
}

struct PreviewView: View {
    @Environment(\.openURL) private var openURL
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(Localizer.self) private var loc
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
                    Button(action: openVideo) {
                        Label(loc.t("preview.openMp4"), systemImage: "play.rectangle")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .foregroundStyle(.white)
                            .background(Brand.gradient, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                            .shadow(color: Brand.primary.opacity(0.45), radius: 14, y: 8)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 30)
            }
        }
        .navigationTitle(loc.t("nav.preview"))
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
        .alert(loc.t("preview.unavailableTitle"), isPresented: $showBackendNotice) {
            Button(loc.t("common.ok"), role: .cancel) {}
        } message: {
            Text(loc.t("preview.unavailableBody"))
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
                    .foregroundStyle(.white)
                Text(project.title.uppercased())
                    .font(.system(size: 30, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 20)
                Text(loc.t("preview.mockupTagline"))
                    .font(.caption.bold())
                    .tracking(1.3)
                    .foregroundStyle(.white.opacity(0.72))
                Spacer()
                Button(action: openVideo) {
                    Image(systemName: "play.circle.fill")
                        .font(.system(size: 58))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(.white)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(loc.t("preview.openMp4"))
                Text(project.duration.map { "0:00 / \($0)" } ?? loc.t("preview.renderedMp4"))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.white.opacity(0.72))
                    .padding(.bottom, 20)
            }
        }
        .frame(maxWidth: 320)
        .aspectRatio(9 / 16, contentMode: .fit)
        .shadow(color: Brand.primary.opacity(0.3), radius: 34, y: 18)
        .accessibilityLabel("\(loc.t("nav.preview")): \(project.title)")
    }

    private var sceneStrip: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(loc.t("preview.scenes"))
                .font(.headline)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(0..<project.sceneCount, id: \.self) { index in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(String(format: "%02d", index + 1))
                                .font(.caption2.monospacedDigit())
                                .foregroundStyle(Brand.cyan)
                            Text(sceneLabel(index))
                                .font(.caption.bold())
                        }
                        .frame(width: 92, alignment: .leading)
                        .padding(12)
                        .background(Brand.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(Brand.border, lineWidth: 1)
                        }
                    }
                }
            }
        }
    }

    private func sceneLabel(_ index: Int) -> String {
        if index == 0 { return loc.t("scene.hook") }
        if index == project.sceneCount - 1 { return loc.t("scene.outro") }
        return loc.t("scene.keyPoint")
    }

    private var options: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(spacing: 12) {
                    themeCard
                    voiceCard
                }
            } else {
                HStack(alignment: .top, spacing: 12) {
                    themeCard
                    voiceCard
                }
            }
        }
    }

    private var themeCard: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 6) {
                Label(loc.t("preview.theme"), systemImage: "paintpalette")
                    .font(.caption)
                    .foregroundStyle(Brand.muted)
                    .lineLimit(1)
                Text(project.theme ?? loc.t("preview.serverDefault"))
                    .font(.subheadline.bold())
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var voiceCard: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 6) {
                Label(loc.t("preview.voice"), systemImage: "waveform")
                    .font(.caption)
                    .foregroundStyle(Brand.muted)
                    .lineLimit(1)
                Text(project.voice)
                    .font(.subheadline.bold())
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func openVideo() {
        guard let videoURL = project.videoURL else {
            showBackendNotice = true
            return
        }
        openURL(videoURL)
    }
}

struct LibraryView: View {
    @Environment(AppModel.self) private var appModel
    @Environment(Localizer.self) private var loc

    var body: some View {
        ZStack {
            BrandBackground()
            if appModel.projects.isEmpty {
                ContentUnavailableView(
                    loc.t("library.emptyTitle"),
                    systemImage: "play.square.stack",
                    description: Text(loc.t("library.emptyBody"))
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
        .navigationTitle(loc.t("nav.libraryHeader"))
    }
}

struct SettingsView: View {
    @Environment(Localizer.self) private var loc
    @AppStorage("app_appearance") private var appearanceRaw = AppearanceMode.system.rawValue
    @State private var videoTheme = "darkNeon"
    @State private var voice = "Edge TTS"
    @State private var autoplay = true

    var body: some View {
        @Bindable var loc = loc
        return List {
            Section(loc.t("settings.appearance")) {
                Picker(loc.t("settings.appearance"), selection: $appearanceRaw) {
                    ForEach(AppearanceMode.allCases) { mode in
                        Text(loc.t(mode.labelKey)).tag(mode.rawValue)
                    }
                }
                .pickerStyle(.segmented)
            }

            Section(loc.t("settings.language")) {
                Picker(loc.t("settings.language"), selection: $loc.language) {
                    ForEach(AppLanguage.allCases) { lang in
                        Text(lang.label).tag(lang)
                    }
                }
                .pickerStyle(.inline)
            }

            Section(loc.t("settings.defaultProduction")) {
                Picker(loc.t("settings.videoTheme"), selection: $videoTheme) {
                    Text(loc.t("settings.themeDarkNeon")).tag("darkNeon")
                    Text(loc.t("settings.themeLightPro")).tag("lightPro")
                }
                Picker(loc.t("settings.voice"), selection: $voice) {
                    Text("Edge TTS").tag("Edge TTS")
                    Text("LucyLab").tag("LucyLab")
                    Text("Vbee").tag("Vbee")
                    Text("ElevenLabs").tag("ElevenLabs")
                }
                Toggle(loc.t("settings.autoplay"), isOn: $autoplay)
            }

            Section(loc.t("settings.pipeline")) {
                LabeledContent(loc.t("settings.format"), value: "1080 × 1920")
                LabeledContent(loc.t("settings.frameRate"), value: "60 FPS")
                LabeledContent(loc.t("settings.backend"), value: BackendConfig.baseURL == nil ? loc.t("settings.notConfigured") : loc.t("settings.configured"))
            }

            Section(loc.t("settings.about")) {
                HStack(spacing: 12) {
                    BrandMark(size: 42)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Auto Video Gen")
                            .font(.headline)
                        Text(loc.t("settings.aboutTagline"))
                            .font(.caption)
                            .foregroundStyle(Brand.muted)
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(BrandBackground())
        .navigationTitle(loc.t("nav.settings"))
    }
}
