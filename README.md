<!-- zrzur-publication -->
# Quick start

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

Needs Git and Node.js 24. `packages/stoat.js` is a submodule of [zrzur/sdk-js](https://github.com/zrzur/sdk-js). The build fails closed without the `VITE_*` values.

Zrzur is an independent, Arabic-first chat platform based on the open-source Stoat software (formerly Revolt), licensed under AGPL-3.0 or later. Zrzur is not affiliated with Stoat, stoat.chat or Revolt Platforms Ltd. Please do not report Zrzur issues to the Stoat team.

Licence and origin: [LICENSE](./LICENSE), [NOTICE](./NOTICE), [MODIFICATIONS.md](./MODIFICATIONS.md). Security: [SECURITY.md](./SECURITY.md). Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md).

> **Zrzur 26.0.0 · main · first release.** See [shared release information](ZRZUR_RELEASE.md).

<div align="center">

# Zrzur Web

Solid.js progressive web client for **Zrzur 26**.

</div>

<br/>

## Purpose

Browser and PWA client for Zrzur. Talks to the backend over HTTP and WebSocket.

Package names such as `stoat.js` and `@revolt/*` are kept for protocol and tooling compatibility.

## Architecture

- Solid.js app: `packages/client`
- API client: `stoat.js` (`packages/stoat.js`)
- Voice helpers: `solid-livekit-components`
- Tooling: mise, pnpm, Vite, Lingui

## Requirements

- [Git](https://git-scm.com/install/)
- [mise](https://mise.jdx.dev/getting-started.html)

## Development

```bash
git clone --recursive https://github.com/zrzur/web.git
cd web

# git submodule init && git submodule update   # after pulls if needed

mise install:frozen
mise build:deps

# optional:
# pnpm --filter @zrzur/sdk run build

cp packages/client/.env.example packages/client/.env
mise dev
```

Open http://127.0.0.1:5173 (or the Vite port shown).

```bash
mise check
```

Style guide: [GUIDELINES.md](./GUIDELINES.md).

## Environment

Copy `packages/client/.env.example` to `.env`:

| Variable | Notes |
| --- | --- |
| `VITE_HOST` | App host (required for production builds) |
| `VITE_API_URL` | API base URL (required for production builds) |
| `VITE_DEV_WS_URL` | WebSocket override in development |
| `VITE_DEV_MEDIA_URL` | Media override in development |
| `VITE_DEV_PROXY_URL` | Proxy override in development |
| `VITE_DEV_GIFBOX_URL` | Gifbox override in development |
| `VITE_EMOJI_CDN` | Optional emoji CDN |
| `VITE_SENTRY_DSN` | Optional Sentry |

Development defaults to `http://127.0.0.1:14702` when `import.meta.env.DEV`.

## Build

```bash
mise install:frozen
mise build:deps
mise build
mise build:prod
```

Output: `packages/client/dist`.

### Routes

`/login`, `/pwa`, `/dev`, `/discover`, `/settings`, `/invite`, `/bot`, `/friends`, `/server`, `/channel` — see `packages/client/src/index.tsx`.

## Localization

Lingui in the client package.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Keep changes focused and preserve the attribution.

## License

[AGPL](./LICENSE).

## Upstream Project & Attribution

Zrzur Web is independently developed from the open-source Stoat web client. Stoat does not sponsor or endorse Zrzur.

- Upstream: https://github.com/stoatchat/for-web
- Basis tag: `stoat-for-web-v0.16.3`
- License: AGPL (see [LICENSE](./LICENSE))
