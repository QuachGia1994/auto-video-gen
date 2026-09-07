# Changelog

All notable changes to this project are recorded here.

## [Unreleased]

### Added
- Add a native SwiftUI iOS 27 frontend scaffold with system `TabView`, `NavigationStack`, splash branding, create, pipeline progress, preview, library, and settings screens.
- Add an Android Expo SDK 57 / React Native frontend with the same product flow, adaptive app icon, splash branding, Expo Router navigation, and a typed backend gateway.
- Add a dependency-free local mobile API with schema-validated render jobs, status polling, SSE progress, and completed MP4 delivery.
- Add OpenAI-compatible Chat Completions script generation for URL/Text/Markdown sources, configured by base URL, model, and API key.
- Add public-network validation with DNS address pinning for fetched source URLs and redirects; mobile-generated jobs intentionally omit remote `og:image` until that fetch path has the same pinned-network guarantee.
- Add a Cloudflare Workers AI gateway with an `env.AI` binding, bearer-secret protection, and `@cf/zai-org/glm-4.7-flash` as the free-first script model while preserving the backend's generic OpenAI-compatible boundary.
- Add GitHub Actions artifacts for an Android debug APK and an unsigned iOS 27 IPA, both manually dispatchable and rebuilt when their platform sources change.
- Add explicit physical-device LAN support for the mobile backend: configurable bind host, mandatory bearer protection for non-loopback write endpoints, and iOS/Android client token injection.
- Add in-app language switching to both mobile apps (Vietnamese, English, Chinese, Japanese, French) with first-run device-locale detection and a persisted choice that re-localizes every screen at runtime without a restart.
- Add a Light theme alongside Dark on both mobile apps, with a System / Light / Dark selector in Settings that persists across launches and follows the OS when set to System.
- Add iOS background render handoff with persisted active-job recovery, a Live Activity surface for render status, background URLSession completion fallback, APNs-backed Live Activity progress/end updates, and device-owned terminal notifications.

### Fixed
- Fix iOS Library completion timestamps continuously increasing after render, repair Preview theme/voice card layout, localize the server-default theme label, remove the inactive Library selection control, and simplify Live Activity to one unambiguous progress indicator.
- Localize iOS completion alerts, make APNs the Live Activity progress authority when enabled while keeping the same 8-step local fallback formula, remove the server-default theme magic string, make Preview playback affordances truthful and tappable, and retry transient status-poll failures without abandoning an active render.
- Prevent push-triggered physical-device iOS artifacts from silently embedding a loopback backend URL; resolve the backend from a repository variable (or manual dispatch override) and fail CI on empty/loopback endpoints.
- Make the on-device notification the single terminal-alert owner, add native in-app AVPlayer preview and file-based MP4 sharing/export, and serve MP4 byte ranges/HEAD metadata so native seeking and replay work without Safari.
- Harden Edge TTS against intermittent no-audio outages with a longer bounded retry window, surface a localized voice-service error when retries are exhausted, and dismiss failed Live Activities immediately so retries do not stack stale 0% cards.

### Changed
- Add optional progress callbacks to the existing Node/TypeScript pipeline while preserving its CLI inputs and generated artifacts.
- Replace mobile runtime mock generation and seeded projects with the real local HTTP generation/render path; missing backend configuration now fails explicitly.
- Keep the LLM provider swappable through environment configuration and validate/retry model JSON with the existing Zod `ScriptSchema` before rendering.
- Bound render-job retention and mobile polling duration/backoff so local API state, disk usage, and clients do not grow or poll indefinitely.
- Run the Cloudflare GLM gateway in non-thinking mode for deterministic JSON generation and lower Workers AI Neuron usage.
- Force Workers AI JSON mode for script generation, raise the completion budget to 8,192 tokens at low temperature, and fix mobile pipeline headers so failed generations are never labeled complete.
- Redesign the iOS and Android app UI with a shared light+dark design-token palette, a gradient brand mark and primary buttons, elevated glass cards with soft shadows, and tinted status pills for a more premium look.
- Switch the Android bottom navigation to native system tabs (expo-router NativeTabs, Material bottom navigation) instead of the JS-rendered tab bar; tab screens now handle the top safe-area inset and show an in-content page title since native tabs render without a JS header.
- Keep the iOS display awake only while generation is active, then restore normal Auto-Lock; server-side rendering itself remains independent of app foreground state.
