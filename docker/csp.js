// The page policy (Content-Security-Policy) of the web app.
//
// Built from the same runtime configuration the container already has: the
// VITE_* addresses inject.js writes into the build, plus what the API's root
// (GET <api>/) says about the services it uses (files, link proxy, events,
// voice nodes, captcha). So a self-hosted instance gets a policy for its own
// hosts without writing one.
//
// - script-src 'self': no inline scripts, no eval. 'wasm-unsafe-eval' lets
//   the noise filter compile its WebAssembly (it runs in an audio worklet,
//   which follows this policy); it does not allow eval of JavaScript. The
//   noise filter's files are the app's own (/assets/rnnoise/). One hash: the
//   boot script of the plugin sandbox (a srcdoc frame inherits this policy).
// - style-src keeps 'unsafe-inline': libraries add <style> elements at run
//   time (the virtual list, the text editor) and the UI sets style
//   attributes in markup; without it a signed-in page logs violations
//   (e2e/stack-runner/csp.mjs, tried 2026-11-10). Styles cannot run code.
// - frame-src: the media players the app embeds after a click, the captcha,
//   and game subdomains of VITE_SANDBOX_DOMAIN.
// - Extra origins: CSP_CONNECT_EXTRA, CSP_FRAME_EXTRA, CSP_IMG_EXTRA
//   (space separated), for services this file can't know about; CSP_VOICE
//   names voice nodes (wss://...) for when the API root can't be read.
// - Every computed source passes one strict check (isSource) before it is
//   written, whatever its origin: env, the API root or the defaults.

/** Media players of SpecialEmbed.tsx and the SDK's MessageEmbed.embedURL */
const PLAYER_ORIGINS = [
  "https://www.youtube-nocookie.com",
  "https://player.twitch.tv",
  // Twitch serves clip embeds here; the SDK's player.twitch.tv/?clip= may
  // lead to it
  "https://clips.twitch.tv",
  "https://new.lightspeed.tv",
  "https://open.spotify.com",
  "https://w.soundcloud.com",
  "https://bandcamp.com",
  "https://streamable.com",
  "https://embed.music.apple.com",
  // the "Player" kind: the same hosts as PLAYER_HOSTS in the SDK
  "https://player.vimeo.com",
  "https://www.dailymotion.com",
  "https://www.tiktok.com",
  "https://www.instagram.com",
  "https://widget.deezer.com",
  "https://embed.podcasts.apple.com",
  "https://player.kick.com",
  "https://www.mixcloud.com",
  "https://embed.tidal.com",
  "https://www.loom.com",
  "https://player.bilibili.com",
  "https://embed.ted.com",
  "https://coub.com",
  "https://store.steampowered.com",
  "https://www.facebook.com",
];

/** Cloudflare Turnstile hosts (sign-up, password reset, sign-in step-up) */
const CAPTCHA_ORIGINS = ["https://challenges.cloudflare.com"];

/**
 * SHA-256 of the inline boot script of the plugin sandbox document
 * (packages/client/components/plugins/sandbox.ts, sandboxDocument). The
 * frame's own policy allows it by nonce; this lets it past the inherited
 * app policy too. components/plugins/sandboxCsp.test.ts recomputes it.
 */
const PLUGIN_SANDBOX_SCRIPT =
  "'sha256-A+6Nzw3Ccu+j5Gp3MDFcfp9auKCnYudOK4bZLWXkdsA='";

/** Keywords the policy may contain */
const KEYWORDS = new Set([
  "'self'",
  "'none'",
  "'unsafe-inline'",
  "'wasm-unsafe-eval'",
  "data:",
  "blob:",
]);

/** scheme://host[:port][/path], lower-case host, an optional leading "*." */
const SOURCE =
  /^(https?|wss?):\/\/(\*\.)?[a-z0-9.-]+(:[0-9]{1,5})?(\/[A-Za-z0-9._~/-]*)?$/;
const HASH = /^'sha256-[A-Za-z0-9+/]{43}='$/;

/** The one check every source goes through */
const isSource = (s) =>
  typeof s === "string" && (KEYWORDS.has(s) || SOURCE.test(s) || HASH.test(s));

const PLACEHOLDER = /^__VITE_[A-Z_]+__$/;

/** A URL object for a value with or without a scheme, or undefined */
function parseUrl(value) {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw || PLACEHOLDER.test(raw)) return undefined;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (!/^(https?|wss?):$/.test(url.protocol) || !url.host) return undefined;
    if (url.username || url.password) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

/** The origin of a URL (http, https, ws, wss), or undefined */
function originOf(value) {
  const url = parseUrl(value);
  if (!url) return undefined;
  const origin = `${url.protocol}//${url.host}`;
  return isSource(origin) ? origin : undefined;
}

/** A URL's folder (origin + path up to the last "/"), for path-limited sources */
function folderOf(value) {
  const url = parseUrl(value);
  if (!url) return undefined;
  const folder = `${url.protocol}//${url.host}${url.pathname.replace(/[^/]*$/, "")}`;
  return isSource(folder) ? folder : undefined;
}

/** The http(s) twin of a ws(s) origin and the other way round */
function twin(origin) {
  const [, scheme, rest] = /^([a-z]+):(.*)$/.exec(origin);
  const other = { https: "wss", http: "ws", wss: "https", ws: "http" }[scheme];
  return other + ":" + rest;
}

const words = (value) =>
  (typeof value === "string" ? value : "").split(/\s+/).filter(Boolean);

/** Origins from a space-separated variable, each checked */
const origins = (value) => words(value).map(originOf);

const unique = (list) => [...new Set(list.filter(isSource))];

/** Same rule as the client (activities/domain.ts): the app's domains never host a game */
const FORBIDDEN_DOMAINS = ["zrzur.com", "zrzur.cc"];
const LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/**
 * `frame-src` source for games from VITE_SANDBOX_DOMAIN, validated like
 * sandboxFrameSource in the client: lower-case labels, an optional port, no
 * scheme, path or trailing dot, not a Zrzur domain. http only for a
 * *.localhost name. An invalid value is left out (logged by the server).
 */
function sandboxFrameSource(value) {
  const domain = typeof value === "string" ? value.trim() : "";
  if (!domain) return undefined;
  const [host, port, ...rest] = domain.split(":");
  if (rest.length > 0) return undefined;
  if (port !== undefined && !/^[0-9]{1,5}$/.test(port)) return undefined;
  const labels = host.split(".");
  if (labels.length < 2 || !labels.every((label) => LABEL.test(label)))
    return undefined;
  if (FORBIDDEN_DOMAINS.some((f) => host === f || host.endsWith(`.${f}`)))
    return undefined;
  const scheme = host.endsWith(".localhost") ? "http" : "https";
  const source = `${scheme}://*.${domain}`;
  return isSource(source) ? source : undefined;
}

/**
 * What the API root says: `{ ws, features: { autumn, january, livekit,
 * captcha } }`. Anything missing or malformed is ignored.
 */
function fromRoot(root) {
  const features = root?.features ?? {};
  const nodes = Array.isArray(features.livekit?.nodes)
    ? features.livekit.nodes
    : [];
  return {
    events: originOf(root?.ws),
    media:
      features.autumn?.enabled === false
        ? undefined
        : originOf(features.autumn?.url),
    proxy:
      features.january?.enabled === false
        ? undefined
        : originOf(features.january?.url),
    voice:
      features.livekit?.enabled === false
        ? []
        : nodes.map((n) => originOf(n?.public_url)),
  };
}

/**
 * The policy for `env` (process.env of the container) and `root` (the API
 * root's JSON, or undefined when it couldn't be read).
 */
function contentSecurityPolicy(env = process.env, root = undefined) {
  const found = fromRoot(root);
  const api = originOf(env.VITE_API_URL);
  // without the root: the events socket is VITE_DEV_WS_URL, else the usual
  // name next to the API (api.example.com -> events.example.com)
  const guessedEvents =
    api && /^https?:\/\/api\./.test(api)
      ? twin(api.replace("//api.", "//events."))
      : undefined;
  const events = [
    originOf(env.VITE_DEV_WS_URL),
    found.events,
    root ? undefined : guessedEvents,
  ];
  const media = [originOf(env.VITE_DEV_MEDIA_URL), found.media];
  const proxy = [originOf(env.VITE_DEV_PROXY_URL), found.proxy];
  const gifs = [originOf(env.VITE_DEV_GIFBOX_URL)];
  const voice = [...found.voice, ...origins(env.CSP_VOICE)].flatMap((origin) =>
    origin ? [origin, twin(origin)] : [],
  );
  // the app's own copy (/assets/rnnoise/) is 'self'; a configured folder
  // elsewhere is allowed for that folder only
  const rnnoise = folderOf(env.VITE_RNNOISE_WORKLET_CDN_URL);
  // the captcha's hosts stay in even when the root says it is off: the
  // owner may switch it on without restarting this server
  const captcha = CAPTCHA_ORIGINS;
  const buildTime = [
    env.VITE_ASSISTANT_URL,
    env.VITE_EMOJI_CDN,
    env.VITE_GEO_URL,
    env.VITE_SENTRY_TUNNEL,
    env.VITE_SENTRY_DSN,
  ].map(originOf);

  const directives = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'wasm-unsafe-eval'",
      PLUGIN_SANDBOX_SCRIPT,
      rnnoise,
      ...captcha,
    ],
    "style-src": ["'self'", "'unsafe-inline'", ...captcha],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      api,
      ...media,
      ...proxy,
      ...gifs,
      originOf(env.VITE_EMOJI_CDN),
      ...origins(env.CSP_IMG_EXTRA),
    ],
    "media-src": ["'self'", "blob:", "data:", ...media, ...proxy, ...gifs],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      api,
      ...events,
      ...media,
      ...proxy,
      ...gifs,
      ...voice,
      rnnoise,
      ...captcha,
      ...buildTime,
      ...origins(env.CSP_CONNECT_EXTRA),
    ],
    "frame-src": [
      sandboxFrameSource(env.VITE_SANDBOX_DOMAIN),
      ...PLAYER_ORIGINS,
      ...captcha,
      ...origins(env.CSP_FRAME_EXTRA),
    ],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${unique(sources).join(" ")}`)
    .join("; ");
}

/**
 * Read the API root, for the policy. Uses CSP_API_URL when the container
 * reaches the API under another (internal) address; gives up after `ms`.
 */
async function readRoot(env = process.env, ms = 4000) {
  const base = (env.CSP_API_URL || env.VITE_API_URL || "").trim();
  if (!originOf(base)) return undefined;
  try {
    const response = await fetch(base.replace(/\/+$/, "") + "/", {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(ms),
    });
    if (!response.ok) return undefined;
    return await response.json();
  } catch {
    return undefined;
  }
}

/** Until the root has answered once: a new try after 15 to 30 seconds */
const RETRY_MS = [15_000, 30_000];
/** After that: every ten minutes (a failed read keeps the last policy) */
const REFRESH_MS = 10 * 60 * 1000;

/**
 * Read the root now and keep reading it: every 15-30 s until the first
 * answer, then every 10 min. `onPolicy` gets each policy built from an
 * answer.
 */
function keepPolicyFresh({
  env = process.env,
  read = readRoot,
  onPolicy,
  onFirst = () => {},
  setTimer = setTimeout,
  random = Math.random,
}) {
  let answered = false;
  const attempt = async () => {
    const root = await read(env).catch(() => undefined);
    if (root) {
      onPolicy(contentSecurityPolicy(env, root));
      if (!answered) onFirst(true);
      answered = true;
    } else if (!answered) {
      onFirst(false);
    }
    const delay = answered
      ? REFRESH_MS
      : Math.round(RETRY_MS[0] + random() * (RETRY_MS[1] - RETRY_MS[0]));
    setTimer(attempt, delay).unref?.();
  };
  attempt();
}

module.exports = {
  contentSecurityPolicy,
  readRoot,
  keepPolicyFresh,
  originOf,
  folderOf,
  sandboxFrameSource,
  PLAYER_ORIGINS,
  CAPTCHA_ORIGINS,
  PLUGIN_SANDBOX_SCRIPT,
};
