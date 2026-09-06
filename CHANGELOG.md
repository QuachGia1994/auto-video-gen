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

### Changed
- Add optional progress callbacks to the existing Node/TypeScript pipeline while preserving its CLI inputs and generated artifacts.
- Replace mobile runtime mock generation and seeded projects with the real local HTTP generation/render path; missing backend configuration now fails explicitly.
- Keep the LLM provider swappable through environment configuration and validate/retry model JSON with the existing Zod `ScriptSchema` before rendering.
- Bound render-job retention and mobile polling duration/backoff so local API state, disk usage, and clients do not grow or poll indefinitely.
- Run the Cloudflare GLM gateway in non-thinking mode for deterministic JSON generation and lower Workers AI Neuron usage.
