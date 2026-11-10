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
//   which follows this policy); it does not allow eval of JavaScript.
// - style-src keeps 'unsafe-inline': libraries add <style> elements at run
//   time (the virtual list, the text editor) and the UI sets style
//   attributes in markup; without it a signed-in page logs violations
//   (e2e/stack-runner/csp.mjs, tried 2026-11-10). Styles cannot run code.
// - frame-src: the media players the app embeds after a click, the captcha.
// - Extra origins: CSP_CONNECT_EXTRA, CSP_FRAME_EXTRA, CSP_IMG_EXTRA
//   (space separated), for services this file can't know about.

/** Media players of SpecialEmbed.tsx and the SDK's MessageEmbed.embedURL */
const PLAYER_ORIGINS = [
  "https://www.youtube-nocookie.com",
  "https://player.twitch.tv",
  "https://new.lightspeed.tv",
  "https://open.spotify.com",
  "https://w.soundcloud.com",
  "https://bandcamp.com",
  "https://streamable.com",
  "https://embed.music.apple.com",
];

/** hCaptcha's documented hosts (sign-up, password reset, sign-in step-up) */
const CAPTCHA_ORIGINS = ["https://hcaptcha.com", "https://*.hcaptcha.com"];

/** The noise filter's default files (livekit-rnnoise-processor, RNNoiseNode.js) */
const RNNOISE_DEFAULT =
  "https://cdn.jsdelivr.net/gh/dadadah/livekit-rnnoise-processor@5edbd8a06a95c2c1736d38458ed34793e8d90bae/dist/";

const PLACEHOLDER = /^__VITE_[A-Z_]+__$/;

/** The origin of a URL (http, https, ws, wss), or undefined */
function originOf(value) {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw || PLACEHOLDER.test(raw)) return undefined;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (!/^(https?|wss?):$/.test(url.protocol) || !url.host) return undefined;
    return `${url.protocol}//${url.host}`;
  } catch {
    return undefined;
  }
}

/** A URL's folder (origin + path up to the last "/"), for path-limited sources */
function folderOf(value) {
  const origin = originOf(value);
  if (!origin) return undefined;
  const url = new URL(value.trim());
  return origin + url.pathname.replace(/[^/]*$/, "");
}

/** The http(s) twin of a ws(s) origin and the other way round */
function twin(origin) {
  const [, scheme, rest] = /^([a-z]+):(.*)$/.exec(origin);
  const other = { https: "wss", http: "ws", wss: "https", ws: "http" }[scheme];
  return other + ":" + rest;
}

const words = (value) =>
  (typeof value === "string" ? value : "").split(/\s+/).filter(Boolean);

/** Keep CSP-safe source expressions only: no quotes, semicolons or commas */
const safeSources = (list) =>
  list.filter((s) =>
    /^[a-z]+:\/\/[A-Za-z0-9.*:[\]_-]+(\/[^\s;,'"]*)?$/.test(s),
  );

const unique = (list) => [...new Set(list.filter(Boolean))];

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
    captcha: features.captcha?.enabled === true,
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
  const events = unique([
    originOf(env.VITE_DEV_WS_URL),
    found.events,
    root ? undefined : guessedEvents,
  ]);
  const media = unique([originOf(env.VITE_DEV_MEDIA_URL), found.media]);
  const proxy = unique([originOf(env.VITE_DEV_PROXY_URL), found.proxy]);
  const gifs = unique([originOf(env.VITE_DEV_GIFBOX_URL)]);
  const voice = unique(
    found.voice.flatMap((origin) => (origin ? [origin, twin(origin)] : [])),
  );
  const rnnoise = folderOf(env.VITE_RNNOISE_WORKLET_CDN_URL) ?? RNNOISE_DEFAULT;
  // the captcha's hosts stay in even when the root says it is off: the
  // owner may switch it on without restarting this server
  const captcha = CAPTCHA_ORIGINS;
  const buildTime = unique(
    [
      env.VITE_ASSISTANT_URL,
      env.VITE_EMOJI_CDN,
      env.VITE_GEO_URL,
      env.VITE_SENTRY_TUNNEL,
    ].map(originOf),
  );
  const sentry = originOf(env.VITE_SENTRY_DSN);

  const connect = unique([
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
    sentry,
    ...safeSources(words(env.CSP_CONNECT_EXTRA)),
  ]);
  const images = unique([
    "'self'",
    "data:",
    "blob:",
    api,
    ...media,
    ...proxy,
    ...gifs,
    originOf(env.VITE_EMOJI_CDN),
    ...safeSources(words(env.CSP_IMG_EXTRA)),
  ]);
  const mediaSources = unique([
    "'self'",
    "blob:",
    "data:",
    ...media,
    ...proxy,
    ...gifs,
  ]);
  const frames = unique([
    ...PLAYER_ORIGINS,
    ...captcha,
    ...safeSources(words(env.CSP_FRAME_EXTRA)),
  ]);

  return [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' ${rnnoise} ${captcha.join(" ")}`,
    `style-src 'self' 'unsafe-inline' ${captcha.join(" ")}`,
    `img-src ${images.join(" ")}`,
    `media-src ${mediaSources.join(" ")}`,
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    `frame-src ${frames.join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
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

module.exports = {
  contentSecurityPolicy,
  readRoot,
  originOf,
  PLAYER_ORIGINS,
  CAPTCHA_ORIGINS,
  RNNOISE_DEFAULT,
};
