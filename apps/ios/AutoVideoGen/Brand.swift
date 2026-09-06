import SwiftUI

enum Brand {
    static let background = Color(red: 0.035, green: 0.055, blue: 0.10)
    static let surface = Color.white.opacity(0.07)
    static let surfaceStrong = Color.white.opacity(0.12)
    static let primary = Color(red: 0.48, green: 0.27, blue: 0.98)
    static let cyan = Color(red: 0.13, green: 0.84, blue: 0.96)
    static let success = Color(red: 0.20, green: 0.82, blue: 0.52)
    static let muted = Color.white.opacity(0.64)

    static let gradient = LinearGradient(
        colors: [primary, Color(red: 0.18, green: 0.45, blue: 1.0), cyan],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

struct BrandMark: View {
    var size: CGFloat = 40

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.25, style: .continuous)
                .fill(Brand.gradient)
            RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                .fill(Color.black.opacity(0.66))
                .padding(size * 0.10)
            Image(systemName: "play.fill")
                .font(.system(size: size * 0.34, weight: .bold))
                .foregroundStyle(.white)
                .offset(x: -size * 0.04)
            Image(systemName: "sparkles")
                .font(.system(size: size * 0.23, weight: .bold))
                .foregroundStyle(Brand.cyan)
                .offset(x: size * 0.29, y: -size * 0.28)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

struct BrandBackground: View {
    var body: some View {
        ZStack {
            Brand.background
            RadialGradient(
                colors: [Brand.primary.opacity(0.24), .clear],
                center: .topTrailing,
                startRadius: 20,
                endRadius: 430
            )
            RadialGradient(
                colors: [Brand.cyan.opacity(0.16), .clear],
                center: .bottomLeading,
                startRadius: 10,
                endRadius: 360
            )
        }
        .ignoresSafeArea()
    }
}
