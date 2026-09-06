import SwiftUI

@main
struct AutoVideoGenApp: App {
    @State private var appModel = AppModel()
    @State private var showingSplash = true

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
            .preferredColorScheme(.dark)
            .animation(.easeOut(duration: 0.28), value: showingSplash)
            .task {
                guard showingSplash else { return }
                try? await Task.sleep(for: .milliseconds(850))
                showingSplash = false
            }
        }
    }
}

struct RootTabView: View {
    var body: some View {
        TabView {
            Tab("Create", systemImage: "sparkles.rectangle.stack") {
                NavigationStack {
                    HomeView()
                }
            }

            Tab("Library", systemImage: "play.square.stack") {
                NavigationStack {
                    LibraryView()
                }
            }

            Tab("Settings", systemImage: "gearshape") {
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
    var body: some View {
        ZStack {
            BrandBackground()
            VStack(spacing: 22) {
                Spacer()
                BrandMark(size: 108)
                VStack(spacing: 7) {
                    Text("Auto Video Gen")
                        .font(.largeTitle.bold())
                    Text("URL → video in minutes")
                        .font(.subheadline)
                        .foregroundStyle(Brand.muted)
                }
                Spacer()
                ProgressView()
                    .tint(Brand.cyan)
                Text("Preparing your studio")
                    .font(.caption)
                    .foregroundStyle(Brand.muted)
                    .padding(.bottom, 28)
            }
        }
    }
}
