// Creates throwaway accounts on an ISOLATED local API for the plugin E2E
// (developer, reviewer, user) and writes their tokens plus test packages
// to the given folder. Refuses anything that isn't a loopback API.
//
//   node e2e/plugins-setup.mjs http://127.0.0.1:24712 <out-dir>
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [api, out] = process.argv.slice(2);
const url = new URL(api);
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
  console.error("refusing a non-local API");
  process.exit(1);
}
mkdirSync(out, { recursive: true });

async function call(method, path, body, token) {
  const response = await fetch(api + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-session-token": token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok)
    throw new Error(`${method} ${path} → ${response.status} ${text}`);
  return text ? JSON.parse(text) : undefined;
}

const tag = randomBytes(4).toString("hex");
const accounts = {};
for (const role of ["dev", "reviewer", "user", "other"]) {
  const email = `zplug-${role}-${tag}@localhost.test`;
  const password = randomBytes(18).toString("base64url");
  await call("POST", "/auth/account/create", { email, password });
  const session = await call("POST", "/auth/session/login", {
    email,
    password,
    friendly_name: "plugin e2e",
  });
  await call(
    "POST",
    "/onboard/complete",
    { username: `zplug${role}${tag}` },
    session.token,
  );
  accounts[role] = {
    email,
    password,
    token: session.token,
    user_id: session.user_id,
  };
}

// test packages built from the official examples, under the developer's id
const sdk = join(import.meta.dirname, "..", "..", "plugin-sdk");
const example = (name) =>
  JSON.parse(
    readFileSync(join(sdk, "examples", name, "manifest.json"), "utf8"),
  );
const id = `dev.z${tag}.midnight`;
const v1 = { ...example("midnight-theme"), id, name: "Midnight Test" };
v1.permissions = ["theme.colors", "storage.settings"];
delete v1.contributes.commands;
delete v1.contributes.keybinds;
const v2 = {
  ...example("midnight-theme"),
  id,
  name: "Midnight Test",
  version: "1.1.0",
};
writeFileSync(
  join(out, "v1.zplugin.json"),
  JSON.stringify({ manifest: v1 }, null, 2),
);
// the four declarative examples under developer ids, for the performance run
for (const name of [
  "midnight-theme",
  "focus-tools",
  "quiet-hours",
  "reading-comfort",
]) {
  const manifest = { ...example(name), id: `dev.z${tag}.${name}` };
  writeFileSync(
    join(out, `perf-${name}.zplugin.json`),
    JSON.stringify({ manifest }, null, 2),
  );
}
const wordCount = example("word-count");
const wordCode = readFileSync(
  join(sdk, "examples", "word-count", "main.js"),
  "utf8",
);
writeFileSync(
  join(out, "word-count.zplugin.json"),
  JSON.stringify(
    {
      manifest: {
        ...wordCount,
        id: `dev.z${tag}.word-count`,
        integrity: {
          sha256: (await import("node:crypto"))
            .createHash("sha256")
            .update(wordCode)
            .digest("hex"),
        },
      },
      code: wordCode,
    },
    null,
    2,
  ),
);
writeFileSync(
  join(out, "v2.zplugin.json"),
  JSON.stringify({ manifest: v2 }, null, 2),
);
// Hostile worker plugins for the sandbox audit. They only ever run as a
// developer's local preview in a development build, against this stack.
const { createHash } = await import("node:crypto");
const worker = (name, code, permissions) => {
  const manifest = {
    manifest_version: 1,
    id: `dev.z${tag}.${name}`,
    name: `Attack ${name}`,
    version: "1.0.0",
    description: "Sandbox audit plugin (local test only).",
    author: { name: "audit" },
    category: "developer",
    api_version: 1,
    min_app_version: "26.0.0",
    platforms: ["web", "pwa", "desktop"],
    entrypoint: { type: "worker", file: "main.js" },
    permissions,
    integrity: { sha256: createHash("sha256").update(code).digest("hex") },
  };
  writeFileSync(
    join(out, `${name}.zplugin.json`),
    JSON.stringify({ manifest, code }, null, 2),
  );
};

worker(
  "probe",
  `
(async () => {
const r = {};
async function attempt(name, fn) {
  try {
    const value = await fn();
    r[name] = "ALLOWED: " + String(value).slice(0, 120);
  } catch (e) {
    r[name] = "blocked: " + String((e && (e.name + " " + e.message)) || e).slice(0, 120);
  }
}
await attempt("fetch", () => fetch("${api}/users/@me").then((x) => x.status));
await attempt("fetch_from_prototype", () => {
  const f = (typeof WorkerGlobalScope !== "undefined" && WorkerGlobalScope.prototype.fetch) ||
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Object.getPrototypeOf(navigator)) || {}, "fetch");
  if (!f) throw new Error("not reachable");
  return f.call(undefined, "${api}/users/@me").then((x) => x.status);
});
await attempt("xhr", () => { const x = new XMLHttpRequest(); x.open("GET", "${api}/"); x.send(); return "sent"; });
await attempt("websocket", () => new WebSocket("ws://127.0.0.1:24713"));
await attempt("import_scripts", () => importScripts("${api}/x.js"));
await attempt("dynamic_import", () => import("${api}/x.js"));
await attempt("eval", () => eval("1 + 1"));
await attempt("function_constructor", () => (function () {}).constructor("return 1")());
await attempt("global_via_function", () => (function () { return this; })().location.href);
await attempt("indexeddb", () => indexedDB.open("localforage"));
await attempt("caches", () => caches.keys());
await attempt("storage_estimate", () => navigator.storage.estimate().then((e) => e.quota));
await attempt("raw_postmessage", () => postMessage("hi"));
await attempt("parent_window", () => parent.document.cookie);
await attempt("composer_without_permission", () => zrzur.composer.insert("leak"));
await attempt("diagnostics_without_permission", () => zrzur.diagnostics.get());
await attempt("other_plugin_storage", async () => {
  // keys are namespaced by the host; a path-like key can not reach another plugin
  const value = await zrzur.storage.get("../zrzur:plugin-storage:dev.other.plugin");
  if (value === null) throw new Error("isolated (null)");
  return value;
});
await attempt("oversized_message", () => zrzur.ui.showPanel({ title: "x", blocks: [{ type: "text", text: "x".repeat(70000) }] }));
await attempt("undeclared_command", () => zrzur.commands.register("nope", () => 1));
r.done = true;
await zrzur.storage.set("results", r);
})();
`,
  ["storage.settings", "ui.panels", "ui.commands"],
);
worker("loop", `setTimeout(() => { for (;;) {} }, 200);`, []);
worker("flood", `for (let i = 0; i < 500; i++) zrzur.log("flood " + i);`, []);
worker("crash", `throw new Error("boom at start");`, []);

writeFileSync(
  join(out, "accounts.json"),
  JSON.stringify({ tag, id, accounts }, null, 2),
);
console.log(JSON.stringify({ tag, id, reviewer: accounts.reviewer.user_id }));
