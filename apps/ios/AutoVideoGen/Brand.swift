import SwiftUI
import UIKit

extension Color {
    /// Dynamic color that resolves to `light` or `dark` based on the active user interface style.
    /// Drives automatic Light/Dark theming, including `.preferredColorScheme` overrides.
    init(light: Color, dark: Color) {
        self = Color(UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light)
        })
    }
}

enum Brand {
    static let background = Color(light: Color(hex: 0xF3F5FC), dark: Color(hex: 0x0A1019))
    static let surface = Color(light: .white, dark: Color(hex: 0x141E30))
    static let surfaceStrong = Color(light: Color(hex: 0xEDF1FA), dark: Color(hex: 0x1D2A41))
    static let border = Color(light: Color(hex: 0xE1E7F3), dark: Color(hex: 0x273449))
    static let primary = Color(light: Color(hex: 0x6D3BF5), dark: Color(hex: 0x8B5CF6))
    static let blue = Color(light: Color(hex: 0x2563EB), dark: Color(hex: 0x4F7BFF))
    static let cyan = Color(light: Color(hex: 0x0E9BC4), dark: Color(hex: 0x22D3EE))
    static let success = Color(light: Color(hex: 0x0E9F6E), dark: Color(hex: 0x34D399))
    static let danger = Color(light: Color(hex: 0xE11D48), dark: Color(hex: 0xFB7185))
    static let muted = Color(light: Color(hex: 0x54617A), dark: Color(hex: 0xA6B2C6))
    static let faint = Color(light: Color(hex: 0x9AA5BA), dark: Color(hex: 0x6B7889))

    static let gradient = LinearGradient(
        colors: [primary, blue, cyan],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

struct BrandMark: View {
    var size: CGFloat = 40

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.25, style: .continuous)
                .fill(Brand.gradient)
                .shadow(color: Brand.primary.opacity(0.5), radius: size * 0.28, y: size * 0.12)
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
                colors: [Brand.primary.opacity(0.22), .clear],
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
