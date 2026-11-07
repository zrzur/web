# Zrzur 26 — shared development version

This repository is one component of Zrzur. The shared product version is **26.0.0-dev**, on **main**. This is a development source snapshot, not a stable public-service release. Original dependency, SDK and protocol versions remain compatibility identifiers.

| Component | Source |
|---|---|
| Backend | https://github.com/zrzur/backend |
| Web | https://github.com/zrzur/web |
| Desktop | https://github.com/zrzur/desktop |
| Self-hosted | https://github.com/zrzur/self-hosted |
| JavaScript SDK | https://github.com/zrzur/sdk-js |
| Website | https://github.com/zrzur/website |

Upstream licences, copyright notices and attribution are retained (see NOTICE). Git history was not carried over: this repository starts with a single initial commit.

## Current limits

Local integration tests were exercised, but release readiness remains open: dependency advisories, production TLS/endpoints/email, attachment privacy policy, real multi-device voice, backups/restore, signed desktop installers/updates, and production acceptance require work. Do not publish development configuration or reuse demo credentials in production.

## SDK and local assets

Initialize only the public dependencies with `git submodule update --init packages/stoat.js packages/solid-livekit-components`, then run `mise build:deps`. The SDK submodule points at https://github.com/zrzur/sdk-js (package `@zrzur/sdk`, still imported as `stoat.js` through a pnpm workspace alias); it carries the Zrzur SDK changes directly, so no SDK patch is applied. Private upstream brand assets are not required; Zrzur public/brand assets are bundled. Backend production build requires an appropriate Rust/Linux toolchain. Web production builds require explicit VITE_HOST and VITE_API_URL. Desktop requires an explicit Zrzur application URL until a release default is approved.

The SDK pointer is a zrzur/sdk-js commit (d20286017b39d76e0c453f120f5efd74d54a4b58). The LiveKit components pointer uses a verified upstream pin (a67176da7f0580ea9fdad22e58a963668f047fca) and is built unmodified.
