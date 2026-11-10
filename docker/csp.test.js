// node --test docker/csp.test.js
const test = require("node:test");
const assert = require("node:assert/strict");

const { contentSecurityPolicy, RNNOISE_DEFAULT } = require("./csp.js");

/** The policy as { directive: [sources] } */
function parse(policy) {
  return Object.fromEntries(
    policy.split(";").map((part) => {
      const [name, ...sources] = part.trim().split(/\s+/);
      return [name, sources];
    }),
  );
}

const production = {
  VITE_HOST: "app.zrzur.com",
  VITE_API_URL: "https://api.zrzur.com",
  VITE_DEV_WS_URL: "wss://events.zrzur.com",
  VITE_DEV_MEDIA_URL: "https://cdn.zrzur.com",
  VITE_DEV_PROXY_URL: "https://api.zrzur.com/january",
  VITE_DEV_GIFBOX_URL: "https://api.zrzur.com/gifbox",
};

const root = {
  ws: "wss://ws.zrzur.com",
  features: {
    captcha: { enabled: true, key: "site-key" },
    autumn: { enabled: true, url: "https://cdn.zrzur.com" },
    january: { enabled: true, url: "https://proxy.zrzur.com" },
    livekit: {
      enabled: true,
      nodes: [{ name: "eu", public_url: "wss://voice.zrzur.com" }],
    },
  },
};

test("scripts only from the app itself: no inline scripts, no eval", () => {
  const p = parse(contentSecurityPolicy(production, root));
  assert.ok(p["script-src"].includes("'self'"));
  assert.ok(!p["script-src"].includes("'unsafe-inline'"));
  assert.ok(!p["script-src"].includes("'unsafe-eval'"));
  assert.ok(
    !p["script-src"].some(
      (s) => s === "https:" || s === "*" || s === "data:" || s === "blob:",
    ),
  );
  // a public CDN only for the one pinned folder of the noise filter
  assert.ok(p["script-src"].includes(RNNOISE_DEFAULT));
  assert.ok(!p["script-src"].includes("https://cdn.jsdelivr.net"));
});

test("the fixed parts lock framing, plugins, base and forms", () => {
  const p = parse(contentSecurityPolicy(production));
  assert.deepEqual(p["default-src"], ["'self'"]);
  assert.deepEqual(p["object-src"], ["'none'"]);
  assert.deepEqual(p["base-uri"], ["'self'"]);
  assert.deepEqual(p["form-action"], ["'self'"]);
  assert.deepEqual(p["frame-ancestors"], ["'none'"]);
});

test("connections go to this instance's services and its voice nodes", () => {
  const p = parse(contentSecurityPolicy(production, root));
  for (const origin of [
    "'self'",
    "https://api.zrzur.com",
    "wss://events.zrzur.com",
    "wss://ws.zrzur.com",
    "https://cdn.zrzur.com",
    "https://proxy.zrzur.com",
    "wss://voice.zrzur.com",
    "https://voice.zrzur.com",
  ])
    assert.ok(p["connect-src"].includes(origin), origin);
  assert.ok(
    !p["connect-src"].some((s) => s === "*" || s === "https:" || s === "wss:"),
  );
});

test("images and media from the app, the files service, the link proxy and GIFs", () => {
  const p = parse(contentSecurityPolicy(production, root));
  for (const origin of [
    "'self'",
    "data:",
    "blob:",
    "https://cdn.zrzur.com",
    "https://proxy.zrzur.com",
  ])
    assert.ok(p["img-src"].includes(origin), origin);
  assert.ok(p["media-src"].includes("https://cdn.zrzur.com"));
  assert.ok(!p["img-src"].includes("*"));
});

test("frames: the media players the app embeds and the captcha, nothing else", () => {
  const p = parse(contentSecurityPolicy(production, root));
  assert.ok(p["frame-src"].includes("https://www.youtube-nocookie.com"));
  assert.ok(p["frame-src"].includes("https://*.hcaptcha.com"));
  assert.ok(!p["frame-src"].includes("*"));
  assert.ok(!p["frame-src"].includes("'self'"));
});

test("a self-hosted instance gets its own hosts, local addresses included", () => {
  const p = parse(
    contentSecurityPolicy(
      {
        VITE_API_URL: "http://127.0.0.1:14702",
        VITE_DEV_WS_URL: "ws://127.0.0.1:14703",
        VITE_DEV_MEDIA_URL: "http://127.0.0.1:14704",
        VITE_DEV_PROXY_URL: "http://127.0.0.1:14705",
      },
      {
        features: {
          livekit: {
            enabled: true,
            nodes: [{ public_url: "ws://127.0.0.1:17880" }],
          },
        },
      },
    ),
  );
  for (const origin of [
    "http://127.0.0.1:14702",
    "ws://127.0.0.1:14703",
    "http://127.0.0.1:14704",
    "http://127.0.0.1:14705",
    "ws://127.0.0.1:17880",
    "http://127.0.0.1:17880",
  ])
    assert.ok(p["connect-src"].includes(origin), origin);
  assert.ok(!p["connect-src"].some((s) => s.includes("zrzur.com")));
});

test("unset values, build placeholders and broken addresses add nothing", () => {
  const policy = contentSecurityPolicy({
    VITE_API_URL: "https://api.example.org",
    VITE_DEV_MEDIA_URL: "__VITE_MEDIA_URL__",
    VITE_DEV_PROXY_URL: "javascript:alert(1)",
    CSP_CONNECT_EXTRA:
      "https://ok.example.org 'unsafe-inline' https://x;script-src * data:",
  });
  assert.ok(!policy.includes("__VITE_"));
  assert.ok(!policy.includes("javascript"));
  assert.ok(!policy.includes("'unsafe-inline' https://x"));
  const p = parse(policy);
  assert.ok(!p["script-src"].some((s) => s === "*" || s === "data:"));
  assert.ok(p["connect-src"].includes("https://ok.example.org"));
  // without the root the events address is guessed next to the API
  assert.ok(p["connect-src"].includes("wss://events.example.org"));
});

test("a noise-filter folder of our own replaces the public CDN", () => {
  const p = parse(
    contentSecurityPolicy({
      ...production,
      VITE_RNNOISE_WORKLET_CDN_URL: "https://cdn.zrzur.com/rnnoise/",
    }),
  );
  assert.ok(p["script-src"].includes("https://cdn.zrzur.com/rnnoise/"));
  assert.ok(!p["script-src"].includes(RNNOISE_DEFAULT));
});

test("voice and services switched off in the root are left out", () => {
  const p = parse(
    contentSecurityPolicy(
      { VITE_API_URL: "https://api.example.org" },
      {
        features: {
          january: { enabled: false, url: "https://proxy.example.org" },
          livekit: {
            enabled: false,
            nodes: [{ public_url: "wss://voice.example.org" }],
          },
        },
      },
    ),
  );
  assert.ok(!p["connect-src"].includes("https://proxy.example.org"));
  assert.ok(!p["connect-src"].includes("wss://voice.example.org"));
});
