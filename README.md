<!-- zrzur-publication -->
# Zrzur Web

The browser app of [Zrzur](https://zrzur.com), also installable as a PWA. Built with Solid.js; it talks to the [backend](https://github.com/zrzur/backend) over HTTP and WebSocket.

Part of Zrzur 26. Versions and the other components: [ZRZUR_RELEASE.md](./ZRZUR_RELEASE.md).

## Quick start

```bash
git clone --recurse-submodules https://github.com/zrzur/web.git
cd web
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @zrzur/sdk build
pnpm --filter solid-livekit-components build
pnpm --filter client exec node scripts/copyAssets.mjs
cd packages/client
pnpm exec lingui compile --typescript
pnpm exec tsc --noEmit
pnpm run test:unit
VITE_HOST=localhost VITE_API_URL=http://127.0.0.1:14702 VITE_INVITE_ORIGIN=https://zrzur.cc pnpm exec vite build
```

Needs Git and Node.js 24. The build stops if the `VITE_*` values are missing. Output: `packages/client/dist`.

`packages/stoat.js` is a Git submodule of [zrzur/sdk-js](https://github.com/zrzur/sdk-js). After a pull that moves it: `git submodule update --init`.

## Development

The repository's tasks run with [mise](https://mise.jdx.dev/), which also installs the pinned tools.

```bash
mise install:frozen
mise build:deps
cp packages/client/.env.example packages/client/.env
mise dev
```

Open http://127.0.0.1:5173, or the port Vite prints. In development the app uses the API at `http://127.0.0.1:14702` unless `.env` says otherwise.

| Task | What it does |
| --- | --- |
| `mise dev` | Development server |
| `mise check` | Everything CI runs: install, build, lint, format, tests |
| `mise build` | Development build |
| `mise build:prod` | Production build |

Code style: [GUIDELINES.md](./GUIDELINES.md).

## Configuration

Copy `packages/client/.env.example` to `packages/client/.env`.

| Variable | Notes |
| --- | --- |
| `VITE_HOST` | Host of the app. Required for production builds. |
| `VITE_API_URL` | Address of the API. Required for production builds. |
| `VITE_DEV_WS_URL` | WebSocket address, development only |
| `VITE_DEV_MEDIA_URL` | Media address, development only |
| `VITE_DEV_PROXY_URL` | Proxy address, development only |
| `VITE_DEV_GIFBOX_URL` | Gifbox address, development only |
| `VITE_EMOJI_CDN` | Emoji CDN, optional |
| `VITE_SENTRY_DSN` | Sentry, optional |

## What is inside

| Path | Role |
| --- | --- |
| [`packages/client`](packages/client) | The Solid.js app. Routes are in `src/index.tsx`. |
| [`packages/stoat.js`](https://github.com/zrzur/sdk-js) | API client (`@zrzur/sdk`), a submodule |
| `packages/solid-livekit-components` | Voice and video helpers |

Translations use Lingui; the catalogs are in `packages/client/components/i18n/catalogs`.

Package names such as `stoat.js` and `@revolt/*` are kept so the existing protocol and tools keep working.

## Contributing and security

- Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md). Keep changes focused and keep the attribution.
- Security reports: [SECURITY.md](./SECURITY.md).
- Changes: [CHANGELOG.md](./CHANGELOG.md).

## Licence and origin

Zrzur is an independent, Arabic-first chat platform based on the open-source Stoat software (formerly Revolt), licensed under AGPL-3.0 or later. Zrzur is not affiliated with Stoat, stoat.chat or Revolt Platforms Ltd. Please do not report Zrzur issues to the Stoat team.

- Licence: AGPL-3.0-or-later, see [LICENSE](./LICENSE).
- Upstream: [stoatchat/for-web](https://github.com/stoatchat/for-web), basis tag `stoat-for-web-v0.16.3`.
- Notices and changes: [NOTICE](./NOTICE), [MODIFICATIONS.md](./MODIFICATIONS.md), [THIRD-PARTY-LICENSES.md](./THIRD-PARTY-LICENSES.md).
