import SwiftUI
import UIKit

@main
struct AutoVideoGenApp: App {
    @State private var appModel = AppModel()
    @State private var localizer = Localizer()
    @State private var showingSplash = true
    @AppStorage("app_appearance") private var appearanceRaw = AppearanceMode.system.rawValue

    private var appearance: AppearanceMode {
        AppearanceMode(rawValue: appearanceRaw) ?? .system
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if showingSplash {
                    SplashView()
                        .transition(.opacity)
                } else {
                    RootTabView()
                        .transition(.opacity)
                }
            }
            .environment(appModel)
            .environment(localizer)
            .environment(\.locale, localizer.language.locale)
            .preferredColorScheme(appearance.colorScheme)
            .animation(.easeOut(duration: 0.28), value: showingSplash)
            .onChange(of: appModel.isGenerating, initial: true) { _, isGenerating in
                UIApplication.shared.isIdleTimerDisabled = isGenerating
            }
            .task {
                guard showingSplash else { return }
                try? await Task.sleep(for: .milliseconds(850))
                showingSplash = false
            }
        }
    }
}

struct RootTabView: View {
    @Environment(Localizer.self) private var loc

    var body: some View {
        TabView {
            Tab(loc.t("nav.create"), systemImage: "sparkles.rectangle.stack") {
                NavigationStack {
                    HomeView()
                }
            }

            Tab(loc.t("nav.library"), systemImage: "play.square.stack") {
                NavigationStack {
                    LibraryView()
                }
            }

            Tab(loc.t("nav.settings"), systemImage: "gearshape") {
                NavigationStack {
                    SettingsView()
                }
            }
        }
        .tint(Brand.cyan)
        .tabBarMinimizeBehavior(.onScrollDown)
    }
}

struct SplashView: View {
    @Environment(Localizer.self) private var loc

    var body: some View {
        ZStack {
            BrandBackground()
            VStack(spacing: 22) {
                Spacer()
                BrandMark(size: 108)
                VStack(spacing: 7) {
                    Text("Auto Video Gen")
                        .font(.largeTitle.bold())
                    Text(loc.t("splash.tagline"))
                        .font(.subheadline)
                        .foregroundStyle(Brand.muted)
                }
                Spacer()
                ProgressView()
                    .tint(Brand.cyan)
                Text(loc.t("splash.loading"))
                    .font(.caption)
                    .foregroundStyle(Brand.muted)
                    .padding(.bottom, 28)
            }
        }
    }
}
