// node --test docker/csp.test.js
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  contentSecurityPolicy,
  folderOf,
  keepPolicyFresh,
  PLUGIN_SANDBOX_SCRIPT,
} = require("./csp.js");

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
  // the noise filter is the app's own copy: no public CDN at all
  assert.ok(!contentSecurityPolicy(production, root).includes("jsdelivr"));
  // the plugin sandbox's boot script, by its hash only
  assert.ok(p["script-src"].includes(PLUGIN_SANDBOX_SCRIPT));
  assert.match(PLUGIN_SANDBOX_SCRIPT, /^'sha256-[A-Za-z0-9+/]{43}='$/);
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
  assert.ok(p["frame-src"].includes("https://clips.twitch.tv"));
  assert.ok(p["frame-src"].includes("https://challenges.cloudflare.com"));
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
  assert.ok(p["connect-src"].includes("https://cdn.zrzur.com/rnnoise/"));
});

test("a folder given as a bare host works and never throws", () => {
  assert.equal(folderOf("cdn.example.org"), "https://cdn.example.org/");
  assert.equal(
    folderOf("https://cdn.example.org/a/b/file.js"),
    "https://cdn.example.org/a/b/",
  );
  for (const bad of [
    "",
    "   ",
    "http://",
    "::::",
    "javascript:alert(1)",
    "__VITE_X__",
    undefined,
  ])
    assert.equal(folderOf(bad), undefined, String(bad));
  const p = parse(
    contentSecurityPolicy({
      ...production,
      VITE_RNNOISE_WORKLET_CDN_URL: "cdn.example.org",
    }),
  );
  assert.ok(p["script-src"].includes("https://cdn.example.org/"));
});

test("games: frames from the sandbox domain's subdomains, checked like the client", () => {
  let p = parse(
    contentSecurityPolicy({
      ...production,
      VITE_SANDBOX_DOMAIN: "zrzur.games",
    }),
  );
  assert.ok(p["frame-src"].includes("https://*.zrzur.games"));
  p = parse(
    contentSecurityPolicy({
      ...production,
      VITE_SANDBOX_DOMAIN: "zrzur-games.localhost:14709",
    }),
  );
  assert.ok(p["frame-src"].includes("http://*.zrzur-games.localhost:14709"));
  for (const value of [
    "https://zrzur.games",
    "*.zrzur.games",
    "zrzur.games/path",
    "zrzur.games; script-src *",
    "zrzur.games https://evil.example",
    "Zrzur.Games",
    "zrzur.games.",
    "games",
    'zrzur.games"><script>',
    "__VITE_SANDBOX_DOMAIN__",
    "zrzur.com",
    "play.zrzur.com",
    "zrzur.cc",
  ]) {
    const policy = contentSecurityPolicy({
      ...production,
      VITE_SANDBOX_DOMAIN: value,
    });
    assert.deepEqual(
      parse(policy)["frame-src"],
      parse(contentSecurityPolicy(production))["frame-src"],
      value,
    );
  }
});

test("CSP_VOICE names voice nodes when the API root can't be read", () => {
  const p = parse(
    contentSecurityPolicy({
      ...production,
      CSP_VOICE: "wss://voice.example.org bad;value",
    }),
  );
  assert.ok(p["connect-src"].includes("wss://voice.example.org"));
  assert.ok(p["connect-src"].includes("https://voice.example.org"));
  assert.ok(!p["connect-src"].some((s) => s.includes("bad")));
});

test("every source in the policy passes one strict check, even from a hostile root", () => {
  const policy = contentSecurityPolicy(
    {
      ...production,
      CSP_IMG_EXTRA: "https://ok.example 'unsafe-eval' data:text/html",
    },
    {
      ws: "wss://evil.example/;script-src *",
      features: {
        autumn: { url: "https://files.example'; script-src 'unsafe-inline" },
        january: { url: "javascript:alert(1)" },
        livekit: {
          nodes: [{ public_url: "wss://v.example ;" }, { public_url: 42 }],
        },
      },
    },
  );
  const KEYWORDS = new Set([
    "'self'",
    "'none'",
    "'unsafe-inline'",
    "'wasm-unsafe-eval'",
    "data:",
    "blob:",
  ]);
  const SOURCE =
    /^(https?|wss?):\/\/(\*\.)?[a-z0-9.-]+(:[0-9]{1,5})?(\/[A-Za-z0-9._~/-]*)?$/;
  for (const [name, sources] of Object.entries(parse(policy)))
    for (const source of sources)
      assert.ok(
        KEYWORDS.has(source) ||
          SOURCE.test(source) ||
          /^'sha256-[A-Za-z0-9+/]{43}='$/.test(source),
        `${name}: ${source}`,
      );
  assert.ok(!parse(policy)["style-src"].includes("'unsafe-eval'"));
  assert.ok(!parse(policy)["img-src"].includes("data:text/html"));
});

test("the API root is read again every 15 to 30 s until it answers, then every 10 min", async () => {
  const delays = [];
  const pending = [];
  const policies = [];
  let calls = 0;
  const answers = [undefined, undefined, root, undefined];
  keepPolicyFresh({
    env: production,
    read: async () => answers[calls++],
    onPolicy: (policy) => policies.push(policy),
    setTimer: (fn, ms) => {
      delays.push(ms);
      pending.push(fn);
      return { unref() {} };
    },
    random: () => 0.5,
  });
  const step = async () => {
    await new Promise((r) => setImmediate(r));
    const next = pending.shift();
    if (next) next();
    await new Promise((r) => setImmediate(r));
  };
  // the first read runs at once and fails; then: fails, answers, fails
  await step();
  await step();
  await step();
  await new Promise((r) => setImmediate(r));
  assert.equal(calls, 4);
  assert.ok(delays[0] >= 15000 && delays[0] <= 30000, String(delays[0]));
  assert.ok(delays[1] >= 15000 && delays[1] <= 30000, String(delays[1]));
  assert.equal(delays[2], 600000);
  assert.equal(delays[3], 600000);
  assert.equal(policies.length, 1);
  assert.ok(policies[0].includes("wss://voice.zrzur.com"));
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
