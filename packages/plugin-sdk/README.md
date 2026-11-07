# Zrzur plugin SDK

Build plugins for Zrzur (زرزور): themes, shortcuts, notification rules,
accessibility helpers and small tools. A plugin is a **manifest** that
declares what it adds; Zrzur applies it through reviewed, permission-checked
extension points. Plugins never get your session, tokens, password, private
messages, files or Node.js.

This package is private to the Zrzur repository and is not published to npm.

## Quickstart

Requires Node.js 22.6 or newer (no `npm install` needed).

```bash
node bin/zrzur-plugin.ts init ../my-theme --template theme
node bin/zrzur-plugin.ts validate ../my-theme
node bin/zrzur-plugin.ts pack ../my-theme
```

Then in Zrzur: **Settings → Advanced → Plugins → Developer**

1. **Create plugin** with the same id as your manifest (e.g. `yourname.my-theme`).
2. **Choose a package**: pick the `.zplugin.json` file. Zrzur checks it on this
   device and on the server and lists every problem.
3. **Preview here** runs it on your device only (not installed, gone after reload).
4. **Submit for review**. A Zrzur reviewer approves or rejects it. Creating a
   plugin or submitting a release never makes it installable by itself.

Templates: `theme`, `productivity`, `notifications`, `accessibility`.

## How plugins run

| Entrypoint | What it can do | Who can publish |
|---|---|---|
| `declarative` | Everything below, described as data in the manifest. No code runs. | Any Zrzur account in good standing |
| `worker` | Code in an isolated sandbox: an opaque-origin `<iframe sandbox>` with a strict CSP (no network, no eval), running a dedicated Worker. It talks to Zrzur only through the `zrzur` API, one permission-checked call at a time. | Official Zrzur plugins only, until the sandbox has had an external security review |

## Manifest

See `schema/plugin-manifest.v1.schema.json` for the structure and
`src/manifest.ts` (`validateManifest`) for every rule. Unknown fields are
errors everywhere.

```json
{
  "manifest_version": 1,
  "id": "yourname.midnight",
  "name": "Midnight",
  "version": "1.0.0",
  "description": "A deep blue theme.",
  "author": { "name": "You" },
  "category": "appearance",
  "icon": "palette",
  "api_version": 1,
  "min_app_version": "26.0.0",
  "platforms": ["web", "pwa", "desktop"],
  "entrypoint": { "type": "declarative" },
  "permissions": ["theme.colors"],
  "contributes": {
    "theme": { "colors": { "primary": "#7aa2ff", "surface": "#0b1020", "on-surface": "#e6e9f5" } }
  },
  "locales": { "ar": { "name": "منتصف الليل", "description": "سمة زرقاء داكنة." } }
}
```

- `id`: lowercase, 2–5 dot-separated parts, max 64 characters. `zrzur.*` is reserved.
- `name`, `author.name`, `locales.*.name`: only official plugins may use "Zrzur" (any spelling, also زرزور) or "official" (رسمي, offiziell). Spaces, dashes and letter case don't change that.
- `version`, `min_app_version`: `MAJOR.MINOR.PATCH[-pre]`. Each release must be newer.
- `platforms`: `web`, `pwa`, `desktop`. Zrzur shows "Not supported here" elsewhere.
- `icon`: a Zrzur icon name (no images or URLs).
- Text can be a string or `{ "en": "…", "ar": "…" }` (an `en` entry is required).
- Values in `theme`, `accessibility` and `notifications` can be `"$setting:<key>"`
  to follow one of your settings.

### Contributions

| Section | Permission | Notes |
|---|---|---|
| `theme.colors` | `theme.colors` | `--md-sys-color-*` tokens only, `#rrggbb`. Error/warning colours are refused. Text/background pairs must keep WCAG contrast (4.5:1 text, 3:1 accents), checked again at run time against the live theme. |
| `accessibility` | `accessibility.display` | `font_scale` 0.85–1.5, `line_height` 1.2–2, `letter_spacing` 0–0.12em, `underline_links`, `focus_ring`, `reduce_motion`. |
| `notifications` | `notifications.display` | `quiet_hours {start,end}`, `quiet_hours_enabled`, `hide_previews`, `mute_sound`. Zrzur evaluates the rules; the plugin never sees a notification. |
| `commands` | `ui.commands` | Actions: `setting.toggle` (compact mode, needs `app.preferences`), `theme.toggle`, `accessibility.toggle`, `panel.open`, `notify` (`notifications.show`), `composer.insert` (`composer.insert`, never sends), `navigate` (`home`/`friends`/`discover`), `worker`. |
| `keybinds` | `keybinds` | `Ctrl+Shift+X`, `Alt+Shift+X` or `Ctrl+Alt+X`; browser/devtools shortcuts are refused. |
| `settings` | `storage.settings` | `boolean`, `text`, `number`, `select`, `color`, `time`; saved per user, max 8 KB, checked on the server. |
| `panels` | `ui.panels` | Blocks: `heading`, `text`, `divider`, `button` (runs a command), `setting` (a boolean toggle). Always labelled with your plugin's name. |
| `message_actions` | `context.message.selected` | Worker only. You get one message, only when the user picks your action on it. |
| `events` | `context.channel` for `channel.switch` | Worker only: `channel.switch`, `app.locale_change`, `app.theme_change`. |

### Permissions

Low: `ui.commands`, `ui.panels`, `keybinds`, `theme.colors`, `accessibility.display`,
`app.preferences`, `storage.settings`, `notifications.show`.
Medium: `notifications.display`, `composer.insert`, `context.channel`,
`context.message.selected`, `devtools.diagnostics` (development builds only).
Reserved, refused for now: `network.fetch`, `integration.oauth`.
Never grantable: tokens, sessions, passwords, MFA, bot tokens, payments, files,
shell, Node/IPC, eval, DOM, cookies, raw storage, reading all messages or hidden
channels.

Users see every permission before installing and again when an update adds one.

## Worker API

Types: `src/worker.d.ts`. Example: `examples/word-count`.

```js
zrzur.messageActions.register("count", (message) => {
  const words = message.content.trim().split(/\s+/).filter(Boolean).length;
  zrzur.notifications.show(`${words} words`);
});
```

Limits: handlers answer within 3 s, heartbeats within 2.5 s, max 60 messages
per second of at most 64 KB each, 3 notices per 10 s. Breaking them stops the
plugin; three failures in ten minutes quarantine it until the user retries.

## Packages and review

`pack` writes `<id>-<version>.zplugin.json` (`{ manifest, code? }`) and, for
worker plugins, `integrity.sha256` of the code. The server refuses packages
that are invalid, too large, change the code after packing, reuse a version,
ask for unknown or forbidden permissions, or contain secrets (private keys,
cloud and chat tokens, Zrzur auth headers). Everything else goes to a human
reviewer with the scanner's notes. Approved releases can later be **revoked**;
users then fall back to the previous safe version.

## Examples

| Folder | Type | Shows |
|---|---|---|
| `examples/midnight-theme` | Theme | colours, a colour setting, toggle command + shortcut |
| `examples/focus-tools` | Productivity | compact-mode toggle, code-block snippet, navigation, a help panel |
| `examples/quiet-hours` | Notifications | quiet hours and hidden previews bound to settings |
| `examples/reading-comfort` | Accessibility | text size, spacing, underlines, focus ring, less motion, a panel |
| `examples/word-count` | Worker (official only) | a sandboxed message action and a dynamic panel |

## Official plugins

`official/` holds the plugins Zrzur ships in Browse. Together they use
every extension point; each one is in Arabic, English and German.

| Folder | Type | Uses |
|---|---|---|
| `official/markdown-kit` | Declarative | `composer.insert` commands, six shortcuts, a cheat-sheet panel with buttons |
| `official/quick-replies` | Worker | text settings read from code (defaults included), dynamic panel, `Alt+Shift+1…5` |
| `official/focus-timer` | Worker | timers, `storage`, notices, and a setting the code flips that is bound to `notifications.mute_sound` / `hide_previews` |
| `official/time-tracker` | Worker | `channel.switch` events (`context.channel`), device storage, a daily reminder |
| `official/message-tools` | Worker | four message actions, `<t:unix:F>` time stamps |
| `official/dice` | Worker | `crypto` randomness, select and number settings, a panel of buttons |
| `official/plugin-inspector` | Worker | `devtools.diagnostics` (development builds), all three events, `log` |
| `official/desert-dawn` | Theme | colours bound to a colour setting, `theme.toggle` |
| `official/paper` | Theme | a light theme over the dark app |
| `official/high-contrast` | Theme + accessibility | number and boolean bindings, `accessibility.toggle`, a panel with a `setting` block |
| `official/community-night-owl` | Declarative, third party | quiet hours bound to time settings, a `notify` command; published by a normal account |

Worker code reads translated strings from its own manifest
(`zrzur.manifest.locales[lang].strings`), as these plugins show.

Run `node --test test/manifest.test.ts` to test the validator; it also checks
every manifest in `official/`.
