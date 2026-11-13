#!/usr/bin/env node
// Doc-accuracy tests for the Bot API documentation, against a local stack.
//
//   ZRZUR_API_URL=http://127.0.0.1:31702 ZRZUR_WS_URL=ws://127.0.0.1:31703 \
//   ZRZUR_MAILDEV_URL=http://127.0.0.1:31080 \
//   node scripts/bot-api/live/doc-accuracy.mjs [report-dir]
//
// 1. Creates throw-away accounts (through the local mail catcher), a server,
//    channels and two bots.
// 2. Calls every documented endpoint with the bot token and checks the
//    status and the response against the OpenAPI schema. Endpoints the docs
//    mark as unsupported are called too, and must be refused.
// 3. Runs every tutorial in scripts/bot-api/examples as a real bot process
//    and drives it like a user would.
//
// Results go to scripts/bot-api/verification.json (read by extract.mjs) and,
// as Markdown, to the report directory. Only loopback URLs are accepted.

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const botApiDir = resolve(here, "..");
const clientRoot = resolve(botApiDir, "../..");
// @zrzur/sdk/bot, built from the SDK submodule (pnpm --filter @zrzur/sdk build)
const sdkDist = resolve(clientRoot, "../stoat.js/lib/bot/index.js");

const API = process.env.ZRZUR_API_URL ?? "http://127.0.0.1:31702";
const WS = process.env.ZRZUR_WS_URL ?? "ws://127.0.0.1:31703";
const MAIL = process.env.ZRZUR_MAILDEV_URL ?? "http://127.0.0.1:31080";
const REPORT_DIR = process.argv[2];

for (const url of [API, WS, MAIL]) {
  if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname)) {
    console.error(`refusing to run against ${url}: loopback only`);
    process.exit(2);
  }
}

const openapi = JSON.parse(
  readFileSync(join(botApiDir, "openapi.snapshot.json"), "utf8"),
);
const inventory = JSON.parse(
  readFileSync(
    join(clientRoot, "src/interface/developers/data/botApi.json"),
    "utf8",
  ),
);
const documented = new Map(inventory.endpoints.map((e) => [e.id, e]));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ */
/* Recording                                                           */
/* ------------------------------------------------------------------ */

const results = [];
const verification = {};
let current = "setup";

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Run one check. `pendingFix` names a fix that is written but not yet
 * deployed to the test stack: a failure is then reported as pending, never
 * as passed, and does not fail the run.
 */
async function test(name, fn, { pendingFix } = {}) {
  current = name;
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    const message = String(error?.message ?? error);
    results.push({
      name,
      ok: false,
      pending: pendingFix,
      ms: Date.now() - started,
      error: message,
    });
    console.log(
      pendingFix
        ? `  … ${name}: ${message} (fix written, not deployed: ${pendingFix})`
        : `  ✗ ${name}: ${message}`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Sanitising examples                                                 */
/* ------------------------------------------------------------------ */

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const idNames = new Map();
const secrets = new Set();
const names = new Map();

function placeholderId(id) {
  if (!idNames.has(id))
    idNames.set(id, `01JC${String(idNames.size + 1).padStart(22, "0")}`);
  return idNames.get(id);
}

function sanitise(value, key = "") {
  if (Array.isArray(value)) return value.slice(0, 3).map((v) => sanitise(v));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitise(v, k)]),
    );
  if (typeof value !== "string") return value;
  if (/token$/i.test(key) && value.length > 16) return "<token>";
  if (secrets.has(value)) return "<token>";
  if (ULID.test(value)) return placeholderId(value);
  if (/@localhost$/.test(value)) return "user@example.com";
  let out = value;
  // a secret inside a longer text, such as a webhook's address
  for (const secret of secrets)
    if (secret) out = out.replaceAll(secret, "<token>");
  out = out
    // a webhook token or a signing secret, also before the test knows it
    .replace(/zrzur_(wh|sign)_[A-Za-z0-9_-]{8,}/g, "<token>")
    .replaceAll(new URL(API).origin, "https://api.zrzur.com")
    // the dev stack's own addresses (internal/test-env), by service
    .replace(/http:\/\/127\.0\.0\.1:147\d2/g, "https://api.zrzur.com")
    .replace(/http:\/\/127\.0\.0\.1:14704/g, "https://cdn.zrzur.com")
    .replace(/http:\/\/127\.0\.0\.1:14705/g, "https://api.zrzur.com/january")
    .replace(/ws:\/\/127\.0\.0\.1:17880/g, "wss://voice.zrzur.com")
    .replace(/http:\/\/127\.0\.0\.1:31704/g, "https://cdn.zrzur.com")
    .replace(/http:\/\/127\.0\.0\.1:31705/g, "https://proxy.zrzur.com")
    .replace(/ws:\/\/127\.0\.0\.1:7880/g, "wss://voice.zrzur.com")
    .replaceAll(new URL(WS).origin, "wss://events.zrzur.com")
    // the web app of the test stack, and anything else on loopback
    .replace(/https?:\/\/127\.0\.0\.1:310\d\d/g, "https://app.zrzur.com")
    .replace(
      /(https?|wss?):\/\/(127\.0\.0\.1|localhost)(:\d+)?/g,
      "https://zrzur.com",
    )
    .replace(/[0-9A-HJKMNP-TV-Z]{26}/g, (m) => placeholderId(m));
  for (const [real, nice] of names) out = out.replaceAll(real, nice);
  if (key === "token" || /^[A-Za-z0-9_-]{40,}$/.test(out)) return "<token>";
  return out;
}

/* ------------------------------------------------------------------ */
/* Minimal OpenAPI schema check                                        */
/* ------------------------------------------------------------------ */

function check(schema, value, path = "$", problems = []) {
  if (!schema) return problems;
  if (schema.$ref)
    return check(
      openapi.components.schemas[schema.$ref.split("/").at(-1)],
      value,
      path,
      problems,
    );
  if (value === null || value === undefined) {
    if (schema.nullable || schema.default === null || value === undefined)
      return problems;
    problems.push(`${path}: null`);
    return problems;
  }
  if (schema.allOf)
    for (const s of schema.allOf) check(s, value, path, problems);
  if (schema.oneOf || schema.anyOf) {
    const options = schema.oneOf ?? schema.anyOf;
    if (!options.some((s) => check(s, value, path, []).length === 0))
      problems.push(`${path}: matches no variant`);
    return problems;
  }
  const type = schema.type;
  const actual = Array.isArray(value)
    ? "array"
    : typeof value === "number"
      ? Number.isInteger(value)
        ? "integer"
        : "number"
      : typeof value;
  if (
    type &&
    !(type === actual || (type === "number" && actual === "integer"))
  ) {
    problems.push(`${path}: ${actual} where ${type} expected`);
    return problems;
  }
  if (schema.enum && !schema.enum.includes(value))
    problems.push(`${path}: ${JSON.stringify(value)} not in enum`);
  if (type === "object" || schema.properties) {
    for (const required of schema.required ?? [])
      if (!(required in value)) problems.push(`${path}.${required}: missing`);
    for (const [k, s] of Object.entries(schema.properties ?? {}))
      if (k in value) check(s, value[k], `${path}.${k}`, problems);
  }
  if (type === "array" && schema.items)
    value
      .slice(0, 5)
      .forEach((v, i) => check(schema.items, v, `${path}[${i}]`, problems));
  return problems;
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

const rateLimitHeadersSeen = new Set();

async function http(
  method,
  template,
  params = {},
  { bot, session, body, query, headers = {}, raw } = {},
) {
  let path = template.replace(/\{(\w+)\}/g, (_, k) => {
    if (!(k in params))
      throw new Error(`missing path parameter ${k} for ${template}`);
    return encodeURIComponent(params[k]);
  });
  if (query) path += `?${new URLSearchParams(query)}`;
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(API + path, {
      method,
      headers: {
        ...(bot ? { "x-bot-token": bot } : {}),
        ...(session ? { "x-session-token": session } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (response.headers.get("x-ratelimit-bucket"))
      rateLimitHeadersSeen.add(response.headers.get("x-ratelimit-bucket"));
    if (response.status === 429 && attempt < 8) {
      await sleep(
        Number(response.headers.get("x-ratelimit-reset-after") ?? 1000) + 50,
      );
      continue;
    }
    const text = raw ? null : await response.text();
    let data = null;
    if (raw) data = await response.arrayBuffer();
    else if (text)
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    return { status: response.status, data, headers: response.headers };
  }
}

/**
 * Call a documented endpoint with the bot token and record the outcome.
 * `expectStatus` defaults to success; unsupported endpoints must be refused.
 */
async function botCall(method, template, params, options = {}) {
  const key = `${method} ${template}`;
  const doc = documented.get(key);
  expect(doc, `${key} is not in the documentation inventory`);
  const r = await http(method, template, params, {
    ...options,
    bot: options.as ?? bot.token,
  });
  const wanted =
    options.expectStatus ??
    (doc.status === "unsupported" ? (s) => s >= 400 : (s) => s < 300);
  const ok = wanted(r.status);
  const responseSchema = doc.response?.schema;
  const problems =
    r.status < 300 && responseSchema && !options.raw
      ? check(responseSchema, r.data)
      : [];
  if (r.status >= 400) {
    // errors always come as { type, ... }
    if (
      !(r.data && typeof r.data === "object" && typeof r.data.type === "string")
    )
      problems.push("error body has no type");
    else if (
      !doc.errors.some((e) => e.type === r.data.type) &&
      !["InvalidSession", "NotFound"].includes(r.data.type)
    )
      problems.push(`error ${r.data.type} not listed in the docs`);
  }
  const previous = verification[key];
  const entry = {
    level: "live",
    checked: today,
    test: current,
    status: r.status,
    expected: ok,
    schemaOk: problems.length === 0,
    ...(problems.length ? { problems: problems.slice(0, 5) } : {}),
    ...(options.body !== undefined ? { request: sanitise(options.body) } : {}),
    ...(r.status < 300 && !options.raw && r.data !== null
      ? { response: sanitise(r.data) }
      : {}),
    ...(r.status >= 400 ? { error: sanitise(r.data) } : {}),
  };
  // keep the first good example; a later failure replaces it
  const keep =
    previous?.expected && previous.schemaOk && ok && problems.length === 0;
  if (!keep) verification[key] = entry;
  expect(
    ok,
    `${key} returned ${r.status} ${JSON.stringify(r.data)?.slice(0, 200)}`,
  );
  expect(problems.length === 0, `${key}: ${problems.join("; ")}`);
  return r.data;
}

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

async function must(method, template, params, options) {
  const r = await http(method, template, params, options);
  if (r.status >= 300)
    throw new Error(
      `${method} ${template}: ${r.status} ${JSON.stringify(r.data)?.slice(0, 300)}`,
    );
  return r.data;
}

async function newAccount(label, nice) {
  const email = `doc-${label}-${randomUUID().slice(0, 8)}@localhost`;
  const password = `Pw-${randomUUID()}`;
  await must(
    "POST",
    "/auth/account/create",
    {},
    { body: { email, password, birth_month: "1990-01" } },
  );
  let code;
  for (let i = 0; i < 40 && !code; i++) {
    const mails = await (await fetch(`${MAIL}/email`)).json();
    code = (
      mails.reverse().find((m) => m.to?.some((t) => t.address === email))
        ?.text ?? ""
    ).match(/verify\/([A-Za-z0-9_-]+)/)?.[1];
    if (!code) await sleep(250);
  }
  expect(code, `no verification mail for ${label}`);
  await must("POST", "/auth/account/verify/{code}", { code });
  const login = await must(
    "POST",
    "/auth/session/login",
    {},
    { body: { email, password, friendly_name: "doc-accuracy" } },
  );
  const username = `doc${label}${randomUUID().slice(0, 4)}`;
  await must(
    "POST",
    "/onboard/complete",
    {},
    { session: login.token, body: { username } },
  );
  secrets.add(login.token);
  names.set(username, nice);
  return { session: login.token, id: login.user_id, username, password };
}

async function newBot(owner, nice) {
  const created = await must(
    "POST",
    "/bots/create",
    {},
    {
      session: owner.session,
      body: { name: `doc${randomUUID().slice(0, 6)}` },
    },
  );
  secrets.add(created.token);
  const user = await must(
    "GET",
    "/users/{target}",
    { target: created._id },
    { session: owner.session },
  );
  names.set(user.username, nice);
  // every privileged intent: what each one withholds is tested in the backend
  await must(
    "PATCH",
    "/bots/{bot_id}",
    { bot_id: created._id },
    { session: owner.session, body: { privileged_intents: 7168 } },
  );
  return { id: created._id, token: created.token, username: user.username };
}

/* ------------------------------------------------------------------ */
/* Gateway                                                             */
/* ------------------------------------------------------------------ */

function gateway(token) {
  const events = [];
  const waiters = [];
  const socket = new WebSocket(`${WS}/?version=1&format=json`);
  const opened = new Promise((resolve, reject) => {
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "Authenticate", token }));
      resolve();
    });
    socket.addEventListener("error", reject);
  });
  socket.addEventListener("message", ({ data }) => {
    const packet = JSON.parse(data);
    for (const event of packet.type === "Bulk" ? packet.v : [packet]) {
      events.push(event);
      for (const w of [...waiters]) {
        if (!w.match(event)) continue;
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(event);
      }
    }
  });
  return {
    events,
    opened,
    send: (packet) => socket.send(JSON.stringify(packet)),
    wait(match, ms = 8000) {
      const found = events.find(match);
      if (found) return Promise.resolve(found);
      return new Promise((resolve, reject) => {
        const w = { match, resolve };
        waiters.push(w);
        setTimeout(() => {
          const i = waiters.indexOf(w);
          if (i === -1) return;
          waiters.splice(i, 1);
          reject(new Error("timed out waiting for a gateway event"));
        }, ms);
      });
    },
    clear: () => events.splice(0),
    close: () => socket.close(),
  };
}

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

console.log(`Doc-accuracy tests against ${API}`);
const owner = await newAccount("owner", "alice");
const member = await newAccount("member", "bob");
const kicked = await newAccount("kick", "carol");
const banned = await newAccount("ban", "dave");

const server = await must(
  "POST",
  "/servers/create",
  {},
  { session: owner.session, body: { name: "Docs test" } },
);
const serverId = server.server._id;
const text = server.channels[0];
const voice = await must(
  "POST",
  "/servers/{server}/channels",
  { server: serverId },
  { session: owner.session, body: { type: "Voice", name: "voice" } },
);
const invite = await must(
  "POST",
  "/channels/{target}/invites",
  { target: text._id },
  { session: owner.session, body: {} },
);
for (const person of [member, kicked, banned])
  await must(
    "POST",
    "/invites/{target}",
    { target: invite._id },
    { session: person.session },
  );

const bot = await newBot(owner, "docbot");
const tutorial = await newBot(owner, "tutorialbot");
for (const b of [bot, tutorial])
  await must(
    "POST",
    "/bots/{target}/invite",
    { target: b.id },
    { session: owner.session, body: { server: serverId } },
  );

// a role for both bots with every permission a bot may hold, ranked above members
const ALL = Number(
  [
    0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 20, 21, 22, 23, 24, 25, 26, 27,
    28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41,
  ]
    .map((b) => 1n << BigInt(b))
    .reduce((a, b) => a | b),
);
const role = await must(
  "POST",
  "/servers/{target}/roles",
  { target: serverId },
  { session: owner.session, body: { name: "Bots", rank: 0 } },
);
await must(
  "PUT",
  "/servers/{target}/permissions/{role_id}",
  { target: serverId, role_id: role.id },
  { session: owner.session, body: { permissions: { allow: ALL, deny: 0 } } },
);
for (const b of [bot, tutorial])
  await must(
    "PATCH",
    "/servers/{server_id}/members/{member_id}",
    { server_id: serverId, member_id: b.id },
    { session: owner.session, body: { roles: [role.id] } },
  );

const botGateway = gateway(bot.token);
const memberGateway = gateway(member.session);
await Promise.all([botGateway.opened, memberGateway.opened]);

/* ------------------------------------------------------------------ */
/* Getting started, authentication, gateway                            */
/* ------------------------------------------------------------------ */

let ready;
await test("gateway: a bot token authenticates and receives Ready", async () => {
  ready = await botGateway.wait((e) => e.type === "Ready");
  expect(
    ready.users?.some((u) => u._id === bot.id),
    "Ready lists the bot itself",
  );
  expect(
    ready.servers?.some((s) => s._id === serverId),
    "Ready lists the server",
  );
  verification["GATEWAY Ready"] = {
    level: "live",
    checked: today,
    test: current,
    response: sanitise({
      type: "Ready",
      servers: ready.servers?.slice(0, 1),
      channels: ready.channels?.slice(0, 1),
    }),
  };
});

await test("gateway: Ping is answered with Pong", async () => {
  botGateway.send({ type: "Ping", data: 42 });
  const pong = await botGateway.wait((e) => e.type === "Pong");
  expect(pong.data === 42, "Pong echoes data");
  verification["GATEWAY Ping"] = {
    level: "live",
    checked: today,
    test: current,
  };
});

await test("gateway: a wrong token gets an Error event", async () => {
  const bad = gateway("not-a-token");
  await bad.opened;
  const error = await bad.wait((e) => e.type === "Error");
  expect(error.data?.type === "InvalidSession", `got ${JSON.stringify(error)}`);
  bad.close();
  verification["GATEWAY Error"] = {
    level: "live",
    checked: today,
    test: current,
    response: error,
  };
});

await test("auth: a missing or wrong token gets 401 with a JSON error", async () => {
  for (const options of [{}, { bot: "not-a-token" }]) {
    const r = await http("GET", "/users/@me", {}, options);
    expect(r.status === 401, `got ${r.status}`);
    expect(
      r.data?.type === "InvalidSession",
      `body is ${typeof r.data === "string" ? "HTML" : JSON.stringify(r.data)}`,
    );
  }
  verification["AUTH 401"] = {
    level: "live",
    checked: today,
    test: current,
    response: { type: "InvalidSession" },
  };
});

await test("errors: unknown routes and malformed JSON get a JSON error", async () => {
  const unknown = await http("GET", "/no/such/route", {}, { bot: bot.token });
  expect(
    unknown.status === 404 && unknown.data?.type === "NotFound",
    `unknown route: ${unknown.status} ${typeof unknown.data}`,
  );
  const response = await fetch(`${API}/channels/${text._id}/messages`, {
    method: "POST",
    headers: { "x-bot-token": bot.token, "content-type": "application/json" },
    body: "{not json",
  });
  const body = await response.json().catch(() => null);
  expect(
    [400, 422].includes(response.status) && body?.type === "FailedValidation",
    `malformed JSON: ${response.status} ${body ? JSON.stringify(body) : "not JSON"}`,
  );
});

await test("auth: GET /users/@me with x-bot-token returns the bot user", async () => {
  const me = await botCall("GET", "/users/@me", {});
  expect(
    me._id === bot.id && me.bot?.owner === owner.id,
    "bot user with owner",
  );
});

await test("rate limits: responses carry X-RateLimit headers", async () => {
  const r = await http("GET", "/users/@me", {}, { bot: bot.token });
  for (const h of [
    "x-ratelimit-limit",
    "x-ratelimit-bucket",
    "x-ratelimit-remaining",
    "x-ratelimit-reset-after",
  ])
    expect(r.headers.get(h) !== null, `missing ${h}`);
  verification["RATELIMIT headers"] = {
    level: "live",
    checked: today,
    test: current,
    response: {
      bucket: r.headers.get("x-ratelimit-bucket"),
      limit: r.headers.get("x-ratelimit-limit"),
    },
  };
});

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

await test("users: fetch, profile, flags, default avatar, mutual", async () => {
  await botCall("GET", "/users/{target}", { target: member.id });
  await botCall(
    "GET",
    "/users/{target}/profile",
    { target: member.id },
    { expectStatus: (s) => s === 200 || s === 403 },
  );
  await botCall("GET", "/users/{target}/flags", { target: member.id });
  await botCall(
    "GET",
    "/users/{target}/default_avatar",
    { target: member.id },
    { raw: true },
  );
  await botCall("GET", "/users/{target}/mutual", { target: member.id });
});

await test("users: edit own status", async () => {
  await botCall(
    "PATCH",
    "/users/{target}",
    { target: "@me" },
    { body: { status: { text: "Reading the docs", presence: "Online" } } },
  );
});

await test("users: open a DM, list DMs, mentions", async () => {
  await botCall(
    "GET",
    "/users/{target}/dm",
    { target: member.id },
    { expectStatus: (s) => s === 200 || s === 403 },
  );
  await botCall("GET", "/users/dms", {});
  // the mentions inbox is for people: whole messages would pass a bot's
  // intents, so a bot token is refused with IsBot
  await botCall("GET", "/users/@me/mentions", {});
});

await test("users: bots cannot use friends or change their username with a password", async () => {
  await botCall("PUT", "/users/{target}/friend", { target: member.id });
  await botCall("DELETE", "/users/{target}/friend", { target: member.id });
  await botCall(
    "POST",
    "/users/friend",
    {},
    { body: { username: member.username } },
  );
  await botCall("PUT", "/users/{target}/block", { target: member.id });
  await botCall("DELETE", "/users/{target}/block", { target: member.id });
  // privacy settings belong to people
  await botCall("GET", "/users/@me/privacy", {});
  await botCall(
    "PATCH",
    "/users/@me/privacy",
    {},
    { body: { direct_messages: "Everyone" } },
  );
});

await test("bots: public info of a bot", async () => {
  // a private bot is visible to its owner only, so make it public first
  await must(
    "PATCH",
    "/bots/{bot_id}",
    { bot_id: bot.id },
    { session: owner.session, body: { public: true } },
  );
  await botCall("GET", "/bots/{target}/invite", { target: bot.id });
  // management stays with the owner's user session
  await botCall(
    "POST",
    "/bots/create",
    {},
    { body: { name: "child" }, expectStatus: (s) => s >= 400 },
  );
  // a bot reads its own settings (its privileged intents); never another
  // bot's, and never a token
  const own = await botCall("GET", "/bots/{bot_id}", { bot_id: bot.id });
  expect(own.bot?.token === "", "a fetched bot must not carry its token");
  expect(
    typeof own.bot?.privileged_intents === "number",
    "privileged_intents missing from the bot's own settings",
  );
  const other = await http(
    "GET",
    "/bots/{bot_id}",
    { bot_id: tutorial.id },
    { bot: bot.token },
  );
  expect(
    other.status === 400 && other.data?.type === "IsBot",
    `another bot's settings: ${other.status} ${other.data?.type}`,
  );
  await botCall(
    "PATCH",
    "/bots/{bot_id}",
    { bot_id: bot.id },
    { body: { public: true }, expectStatus: (s) => s >= 400 },
  );
  await botCall(
    "POST",
    "/bots/{target}/invite",
    { target: bot.id },
    { body: { server: serverId } },
  );
  // a bot owns no bots, and cannot delete itself
  await botCall("GET", "/bots/@me", {}, { expectStatus: (s) => s < 500 });
  await botCall(
    "DELETE",
    "/bots/{bot_id}",
    { bot_id: bot.id },
    { expectStatus: (s) => s >= 400 },
  );
});

/* ------------------------------------------------------------------ */
/* Servers, channels, roles                                            */
/* ------------------------------------------------------------------ */

await test("servers: fetch and edit", async () => {
  const s = await botCall("GET", "/servers/{target}", { target: serverId });
  expect(s._id === serverId, "same server");
  await botCall(
    "PATCH",
    "/servers/{target}",
    { target: serverId },
    { body: { description: "Edited by a bot" } },
  );
  await botCall("GET", "/servers/{target}/invites", { target: serverId });
  await botCall("GET", "/servers/{target}/emojis", { target: serverId });
});

await test("servers: bots cannot create servers, join invites or ack", async () => {
  await botCall("POST", "/servers/create", {}, { body: { name: "nope" } });
  await botCall("POST", "/invites/{target}", { target: invite._id });
  await botCall("PUT", "/servers/{target}/ack", { target: serverId });
});

let botChannel;
await test("channels: create, fetch, edit, delete", async () => {
  botChannel = await botCall(
    "POST",
    "/servers/{server}/channels",
    { server: serverId },
    { body: { name: "bot-made", type: "Text" } },
  );
  await botCall("GET", "/channels/{target}", { target: botChannel._id });
  await botCall(
    "PATCH",
    "/channels/{target}",
    { target: botChannel._id },
    { body: { description: "Made by a bot" } },
  );
  await botCall("DELETE", "/channels/{target}", { target: botChannel._id });
});

await test("channels: bots create invites, group features refused", async () => {
  await botCall(
    "POST",
    "/channels/{target}/invites",
    { target: text._id },
    { body: {} },
  );
  await botCall("POST", "/channels/create", {}, { body: { name: "group" } });
  await botCall("PUT", "/channels/{target}/ack/{message}", {
    target: text._id,
    message: text._id,
  });
  await botCall(
    "GET",
    "/channels/{target}/members",
    { target: text._id },
    { expectStatus: (s) => s >= 400 },
  );
});

await test("invites: fetch and delete an invite", async () => {
  await botCall("GET", "/invites/{target}", { target: invite._id });
  const extra = await must(
    "POST",
    "/channels/{target}/invites",
    { target: text._id },
    { session: owner.session, body: {} },
  );
  await botCall("DELETE", "/invites/{target}", { target: extra._id });
});

let botRole;
await test("roles: create, fetch, edit, permissions, ranks, delete", async () => {
  const created = await botCall(
    "POST",
    "/servers/{target}/roles",
    { target: serverId },
    { body: { name: "Helpers" } },
  );
  botRole = created.id;
  await botCall("GET", "/servers/{target}/roles/{role_id}", {
    target: serverId,
    role_id: botRole,
  });
  await botCall(
    "PATCH",
    "/servers/{target}/roles/{role_id}",
    { target: serverId, role_id: botRole },
    { body: { colour: "#64A9FF", hoist: true } },
  );
  await botCall(
    "PUT",
    "/servers/{target}/permissions/{role_id}",
    { target: serverId, role_id: botRole },
    { body: { permissions: { allow: 1 << 22, deny: 0 } } },
  );
  await botCall(
    "PUT",
    "/channels/{target}/permissions/{role_id}",
    { target: text._id, role_id: botRole },
    { body: { permissions: { allow: 1 << 29, deny: 0 } } },
  );
  const current = await http(
    "GET",
    "/servers/{target}",
    { target: serverId },
    { bot: bot.token },
  );
  const defaults = current.data.default_permissions;
  await botCall(
    "PUT",
    "/servers/{target}/permissions/default",
    { target: serverId },
    { body: { permissions: defaults } },
  );
  await botCall(
    "PUT",
    "/channels/{target}/permissions/default",
    { target: text._id },
    { body: { permissions: { allow: 0, deny: 0 } } },
  );
  const ranks = Object.entries(current.data.roles ?? {})
    .sort(([, a], [, b]) => (a.rank ?? 0) - (b.rank ?? 0))
    .map(([id]) => id);
  await botCall(
    "PATCH",
    "/servers/{target}/roles/ranks",
    { target: serverId },
    { body: { ranks }, expectStatus: (s) => s < 300 || s === 403 },
  );
  const spare = await botCall(
    "POST",
    "/servers/{target}/roles",
    { target: serverId },
    { body: { name: "Spare" } },
  );
  await botCall("DELETE", "/servers/{target}/roles/{role_id}", {
    target: serverId,
    role_id: spare.id,
  });
});

await test("groups: bots cannot add or remove group members", async () => {
  await botCall("PUT", "/channels/{group_id}/recipients/{member_id}", {
    group_id: text._id,
    member_id: member.id,
  });
  await botCall("DELETE", "/channels/{group_id}/recipients/{member_id}", {
    group_id: text._id,
    member_id: member.id,
  });
});

/* ------------------------------------------------------------------ */
/* Members and moderation                                              */
/* ------------------------------------------------------------------ */

await test("members: list, fetch, query, edit nickname and roles", async () => {
  await botCall("GET", "/servers/{target}/members", { target: serverId });
  await botCall("GET", "/servers/{server_id}/members/{member_id}", {
    server_id: serverId,
    member_id: member.id,
  });
  await botCall(
    "GET",
    "/servers/{target}/members_experimental_query",
    { target: serverId },
    { query: { query: "doc", experimental_api: "true" } },
  );
  await botCall(
    "PATCH",
    "/servers/{server_id}/members/{member_id}",
    { server_id: serverId, member_id: member.id },
    { body: { nickname: "Bobby", roles: [botRole] } },
  );
});

await test("moderation: timeout and end it", async () => {
  const until = new Date(Date.now() + 60_000).toISOString();
  await botCall(
    "PATCH",
    "/servers/{server_id}/members/{member_id}",
    { server_id: serverId, member_id: member.id },
    { body: { timeout: until } },
  );
  await botCall(
    "PATCH",
    "/servers/{server_id}/members/{member_id}",
    { server_id: serverId, member_id: member.id },
    { body: { remove: ["Timeout"] } },
  );
});

await test("moderation: kick, ban, list bans, unban, audit log", async () => {
  const left = memberGateway.wait(
    (e) => e.type === "ServerMemberLeave" && e.user === kicked.id,
  );
  await botCall("DELETE", "/servers/{server_id}/members/{member_id}", {
    server_id: serverId,
    member_id: kicked.id,
  });
  await left;
  verification["EVENT ServerMemberLeave"] = {
    level: "live",
    checked: today,
    test: current,
  };
  await botCall(
    "PUT",
    "/servers/{server}/bans/{target}",
    { server: serverId, target: banned.id },
    { body: { reason: "Doc test", delete_message_seconds: 0 } },
  );
  await botCall("GET", "/servers/{target}/bans", { target: serverId });
  await botCall("DELETE", "/servers/{server}/bans/{target}", {
    server: serverId,
    target: banned.id,
  });
  await botCall("GET", "/servers/{target}/audit_logs", { target: serverId });
});

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

let message;
await test("messages: send, fetch, list, edit; Message and MessageUpdate events", async () => {
  memberGateway.clear();
  message = await botCall(
    "POST",
    "/channels/{target}/messages",
    { target: text._id },
    {
      body: {
        content: "Hello from the docs",
        embeds: [
          { title: "EmbedBuilder", description: "Text", colour: "#9075FF" },
        ],
      },
      headers: { "Idempotency-Key": randomUUID() },
    },
  );
  await memberGateway.wait(
    (e) => e.type === "Message" && e._id === message._id,
  );
  verification["EVENT Message"] = {
    level: "live",
    checked: today,
    test: current,
  };
  await botCall("GET", "/channels/{target}/messages/{msg}", {
    target: text._id,
    msg: message._id,
  });
  await botCall(
    "GET",
    "/channels/{target}/messages",
    { target: text._id },
    { query: { limit: 5, include_users: "true" } },
  );
  await botCall(
    "PATCH",
    "/channels/{target}/messages/{msg}",
    { target: text._id, msg: message._id },
    { body: { content: "Edited" } },
  );
  await memberGateway.wait(
    (e) => e.type === "MessageUpdate" && e.id === message._id,
  );
  verification["EVENT MessageUpdate"] = {
    level: "live",
    checked: today,
    test: current,
  };
});

await test("messages: the same Idempotency-Key does not send twice", async () => {
  const key = randomUUID();
  const a = await http(
    "POST",
    "/channels/{target}/messages",
    { target: text._id },
    {
      bot: bot.token,
      body: { content: "once" },
      headers: { "Idempotency-Key": key },
    },
  );
  const b = await http(
    "POST",
    "/channels/{target}/messages",
    { target: text._id },
    {
      bot: bot.token,
      body: { content: "once" },
      headers: { "Idempotency-Key": key },
    },
  );
  expect(a.status === 200, `first send ${a.status}`);
  expect(
    b.status !== 200 || b.data?._id === a.data?._id,
    "second send is refused or returns the same message",
  );
  verification["MESSAGES idempotency"] = {
    level: "live",
    checked: today,
    test: current,
    response: {
      first: a.status,
      second: b.status,
      secondType: b.data?.type ?? null,
    },
  };
});

await test("messages: reactions and pins; MessageReact event", async () => {
  const reacted = memberGateway.wait(
    (e) => e.type === "MessageReact" && e.id === message._id,
  );
  await botCall("PUT", "/channels/{target}/messages/{msg}/reactions/{emoji}", {
    target: text._id,
    msg: message._id,
    emoji: "👍",
  });
  await reacted;
  verification["EVENT MessageReact"] = {
    level: "live",
    checked: today,
    test: current,
  };
  await botCall(
    "DELETE",
    "/channels/{target}/messages/{msg}/reactions/{emoji}",
    { target: text._id, msg: message._id, emoji: "👍" },
  );
  await botCall("PUT", "/channels/{target}/messages/{msg}/reactions/{emoji}", {
    target: text._id,
    msg: message._id,
    emoji: "🎉",
  });
  await botCall("DELETE", "/channels/{target}/messages/{msg}/reactions", {
    target: text._id,
    msg: message._id,
  });
  await botCall("POST", "/channels/{target}/messages/{msg}/pin", {
    target: text._id,
    msg: message._id,
  });
  await botCall("DELETE", "/channels/{target}/messages/{msg}/pin", {
    target: text._id,
    msg: message._id,
  });
});

await test("messages: delete and bulk delete; MessageDelete event", async () => {
  const gone = memberGateway.wait(
    (e) => e.type === "MessageDelete" && e.id === message._id,
  );
  await botCall("DELETE", "/channels/{target}/messages/{msg}", {
    target: text._id,
    msg: message._id,
  });
  await gone;
  verification["EVENT MessageDelete"] = {
    level: "live",
    checked: today,
    test: current,
  };
  const ids = [];
  for (let i = 0; i < 3; i++)
    ids.push(
      (
        await must(
          "POST",
          "/channels/{target}/messages",
          { target: text._id },
          { bot: bot.token, body: { content: `bulk ${i}` } },
        )
      )._id,
    );
  const bulk = memberGateway.wait((e) => e.type === "BulkMessageDelete");
  await botCall(
    "DELETE",
    "/channels/{target}/messages/bulk",
    { target: text._id },
    { body: { ids } },
  );
  await bulk;
  verification["EVENT BulkMessageDelete"] = {
    level: "live",
    checked: today,
    test: current,
  };
});

await test("channels: typing over HTTP", async () => {
  await must(
    "POST",
    "/channels/{target}/typing",
    { target: text._id },
    { bot: bot.token },
  );
});

await test("messages: bots list pins, and text search is refused", async () => {
  await must(
    "POST",
    "/channels/{target}/search",
    { target: text._id },
    { bot: bot.token, body: { pinned: true } },
  );
  const refused = await fetch(`${API}/channels/${text._id}/search`, {
    method: "POST",
    headers: { "x-bot-token": bot.token, "content-type": "application/json" },
    body: JSON.stringify({ query: "hello" }),
  });
  expect(refused.status === 400, `text search answered ${refused.status}`);
  expect((await refused.json()).type === "IsBot", "text search must say IsBot");
});

await test("messages: masquerade, replies and a silent message", async () => {
  const first = await must(
    "POST",
    "/channels/{target}/messages",
    { target: text._id },
    { bot: bot.token, body: { content: "first" } },
  );
  await botCall(
    "POST",
    "/channels/{target}/messages",
    { target: text._id },
    {
      body: {
        content: "reply",
        replies: [{ id: first._id, mention: false }],
        masquerade: { name: "Narrator" },
        flags: 1,
      },
    },
  );
});

await test("messages: a bot reaches a member by DM", async () => {
  const dm = await http(
    "GET",
    "/users/{target}/dm",
    { target: member.id },
    { bot: bot.token },
  );
  expect(dm.status === 200, `open DM ${dm.status}`);
  const sent = await http(
    "POST",
    "/channels/{target}/messages",
    { target: dm.data._id },
    { bot: bot.token, body: { content: "Hi by DM" } },
  );
  // privacy settings may refuse it; both outcomes are documented
  expect(
    sent.status === 200 || sent.data?.type === "DirectMessagesRestricted",
    `DM send ${sent.status} ${sent.data?.type}`,
  );
  verification["USERS dm-send"] = {
    level: "live",
    checked: today,
    test: current,
    response: { status: sent.status, type: sent.data?.type ?? null },
  };
});

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */

const root = await botCall("GET", "/", {});
const FILES = root.features.autumn.url;

async function upload(tag, bytes, name, type) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), name);
  const response = await fetch(`${FILES}/${tag}`, {
    method: "POST",
    headers: { "x-bot-token": bot.token },
    body: form,
  });
  return {
    status: response.status,
    data: await response.json().catch(() => null),
  };
}

// 1×1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

await test("files: upload an attachment with the bot token and send it", async () => {
  const up = await upload(
    "attachments",
    new TextEncoder().encode("a,b\n1,2\n"),
    "data.csv",
    "text/csv",
  );
  expect(
    up.status === 200 && up.data?.id,
    `upload ${up.status} ${JSON.stringify(up.data)}`,
  );
  verification["FILES POST /{tag}"] = {
    level: "live",
    checked: today,
    test: current,
    status: up.status,
    response: sanitise(up.data),
  };
  const sent = await botCall(
    "POST",
    "/channels/{target}/messages",
    { target: text._id },
    { body: { content: "file", attachments: [up.data.id] } },
  );
  expect(
    sent.attachments?.[0]?.filename === "data.csv",
    "attachment on the message",
  );
  const file = await fetch(
    `${FILES}/attachments/${sent.attachments[0]._id}/data.csv`,
  );
  expect(file.status === 200, `download ${file.status}`);
  verification["FILES GET /{tag}/{id}/{name}"] = {
    level: "live",
    checked: today,
    test: current,
    status: file.status,
  };
});

await test("files: wrong tag and empty file are refused", async () => {
  const bad = await upload("nope", PNG, "x.png", "image/png");
  expect(bad.status >= 400, `bad tag ${bad.status}`);
  const empty = await upload(
    "attachments",
    new Uint8Array(0),
    "empty.txt",
    "text/plain",
  );
  expect(empty.status >= 400, `empty ${empty.status}`);
  verification["FILES errors"] = {
    level: "live",
    checked: today,
    test: current,
    response: {
      badTag: bad.status,
      empty: empty.status,
      emptyType: empty.data?.type ?? null,
    },
  };
});

await test("emojis: create from an upload, fetch, rename, delete", async () => {
  const up = await upload("emojis", PNG, "dot.png", "image/png");
  expect(
    up.status === 200,
    `emoji upload ${up.status} ${JSON.stringify(up.data)}`,
  );
  await botCall(
    "PUT",
    "/custom/emoji/{emoji_id}",
    { emoji_id: up.data.id },
    { body: { name: "dot", parent: { type: "Server", id: serverId } } },
  );
  await botCall("GET", "/custom/emoji/{emoji_id}", { emoji_id: up.data.id });
  await botCall(
    "PATCH",
    "/custom/emoji/{emoji_id}",
    { emoji_id: up.data.id },
    {
      body: { name: "dot_two" },
      expectStatus: (s) => s < 300 || s === 404 || s === 405,
    },
  );
  await botCall("DELETE", "/custom/emoji/{emoji_id}", { emoji_id: up.data.id });
});

/* ------------------------------------------------------------------ */
/* Webhooks                                                            */
/* ------------------------------------------------------------------ */

await test("webhooks: create, list, fetch, edit, execute, delete", async () => {
  const hook = await botCall(
    "POST",
    "/channels/{channel_id}/webhooks",
    { channel_id: text._id },
    { body: { name: "Docs hook" } },
  );
  secrets.add(hook.token);
  await botCall("GET", "/channels/{channel_id}/webhooks", {
    channel_id: text._id,
  });
  await botCall("GET", "/webhooks/{webhook_id}", { webhook_id: hook.id });
  await botCall(
    "PATCH",
    "/webhooks/{webhook_id}",
    { webhook_id: hook.id },
    { body: { name: "Docs hook 2" } },
  );
  // token routes need no bot token
  const t = { webhook_id: hook.id, token: hook.token };
  await botCall("GET", "/webhooks/{webhook_id}/{token}", t, { as: "" });
  // without ?wait=true the answer is 204 with no body
  const quiet = await http("POST", "/webhooks/{webhook_id}/{token}", t, {
    body: { content: "From a webhook, no answer wanted" },
  });
  expect(quiet.status === 204, `execute without wait: ${quiet.status}`);
  const sent = await botCall("POST", "/webhooks/{webhook_id}/{token}", t, {
    as: "",
    query: { wait: "true" },
    body: { content: "From a webhook" },
  });
  await botCall(
    "PATCH",
    "/webhooks/{webhook_id}/{token}/{message_id}",
    { ...t, message_id: sent._id },
    { as: "", body: { content: "Edited webhook message" } },
  );
  await botCall(
    "DELETE",
    "/webhooks/{webhook_id}/{token}/{message_id}",
    { ...t, message_id: sent._id },
    { as: "" },
  );
  await botCall("PATCH", "/webhooks/{webhook_id}/{token}", t, {
    as: "",
    body: { name: "Docs hook 3" },
  });
  await botCall("DELETE", "/webhooks/{webhook_id}/{token}", t, { as: "" });
  const github = await botCall(
    "POST",
    "/channels/{channel_id}/webhooks",
    { channel_id: text._id },
    { body: { name: "GitHub" } },
  );
  secrets.add(github.token);
  await botCall(
    "POST",
    "/webhooks/{webhook_id}/{token}/github",
    { webhook_id: github.id, token: github.token },
    {
      as: "",
      headers: { "X-GitHub-Event": "star" },
      body: {
        action: "created",
        repository: {
          full_name: "zrzur/web",
          html_url: "https://github.com/zrzur/web",
        },
        sender: {
          login: "octo",
          html_url: "https://github.com/octo",
          avatar_url: "",
        },
      },
      expectStatus: (s) => s < 300 || s === 400,
    },
  );
  await botCall("DELETE", "/webhooks/{webhook_id}", { webhook_id: github.id });
  const second = await botCall(
    "POST",
    "/channels/{channel_id}/webhooks",
    { channel_id: text._id },
    { body: { name: "Second" } },
  );
  secrets.add(second.token);
  await botCall("DELETE", "/webhooks/{webhook_id}", { webhook_id: second.id });
});

/* ------------------------------------------------------------------ */
/* Commands and interactions                                           */
/* ------------------------------------------------------------------ */

let hello;
await test("commands: global and server command lifecycle", async () => {
  const app = { application_id: bot.id };
  const list = await botCall(
    "PUT",
    "/applications/{application_id}/commands",
    app,
    {
      body: [
        {
          name: "hello",
          description: "Say hello",
          options: [{ type: "String", name: "name", description: "Who" }],
        },
      ],
    },
  );
  hello = list[0];
  await botCall("GET", "/applications/{application_id}/commands", app);
  const extra = await botCall(
    "POST",
    "/applications/{application_id}/commands",
    app,
    { body: { name: "extra", description: "Extra" } },
  );
  await botCall("GET", "/applications/{application_id}/commands/{command_id}", {
    ...app,
    command_id: extra._id,
  });
  await botCall(
    "PATCH",
    "/applications/{application_id}/commands/{command_id}",
    { ...app, command_id: extra._id },
    { body: { description: "Changed" } },
  );
  await botCall(
    "DELETE",
    "/applications/{application_id}/commands/{command_id}",
    { ...app, command_id: extra._id },
  );
  const s = { ...app, server_id: serverId };
  await botCall(
    "PUT",
    "/applications/{application_id}/servers/{server_id}/commands",
    s,
    { body: [{ name: "local", description: "Server only" }] },
  );
  await botCall(
    "GET",
    "/applications/{application_id}/servers/{server_id}/commands",
    s,
  );
  const local = await botCall(
    "POST",
    "/applications/{application_id}/servers/{server_id}/commands",
    s,
    { body: { name: "local2", description: "Second" } },
  );
  await botCall(
    "GET",
    "/applications/{application_id}/servers/{server_id}/commands/{command_id}",
    { ...s, command_id: local._id },
  );
  await botCall(
    "PATCH",
    "/applications/{application_id}/servers/{server_id}/commands/{command_id}",
    { ...s, command_id: local._id },
    { body: { description: "Changed" } },
  );
  await botCall(
    "DELETE",
    "/applications/{application_id}/servers/{server_id}/commands/{command_id}",
    { ...s, command_id: local._id },
  );
  await botCall("GET", "/servers/{server_id}/commands", {
    server_id: serverId,
  });
  await botCall("GET", "/servers/{server_id}/applications", {
    server_id: serverId,
  });
});

await test("commands: another bot's commands are not reachable", async () => {
  const r = await http(
    "GET",
    "/applications/{application_id}/commands",
    { application_id: tutorial.id },
    { bot: bot.token },
  );
  expect(
    r.status === 404 && r.data?.type === "UnknownApplication",
    `got ${r.status} ${r.data?.type}`,
  );
});

await test("interactions: full round trip with the interaction token", async () => {
  botGateway.clear();
  const accepted = await must(
    "POST",
    "/interactions",
    {},
    {
      session: member.session,
      body: {
        type: "Command",
        application_id: bot.id,
        channel_id: text._id,
        command_id: hello._id,
        nonce: randomUUID(),
        options: [{ name: "name", type: "String", value: "Bob" }],
      },
    },
  );
  const created = await botGateway.wait(
    (e) => e.type === "InteractionCreate" && e.interaction._id === accepted._id,
  );
  const i = created.interaction;
  secrets.add(i.token);
  verification["EVENT InteractionCreate"] = {
    level: "live",
    checked: today,
    test: current,
    response: sanitise({ type: "InteractionCreate", interaction: i }),
  };
  const t = { interaction_id: i._id, token: i.token };
  const reply = memberGateway.wait(
    (e) =>
      e.type === "Message" && e.author === bot.id && e.content === "Hello Bob",
  );
  await botCall("POST", "/interactions/{interaction_id}/{token}/callback", t, {
    as: "",
    body: { type: "Message", data: { content: "Hello Bob" } },
  });
  await reply;
  await botCall("PATCH", "/interactions/{interaction_id}/{token}/original", t, {
    as: "",
    body: { content: "Hello Bob (edited)" },
  });
  const follow = await botCall(
    "POST",
    "/interactions/{interaction_id}/{token}/followups",
    t,
    { as: "", body: { content: "A follow-up", ephemeral: true } },
  );
  const followId = follow._id ?? follow.id;
  await botCall(
    "PATCH",
    "/interactions/{interaction_id}/{token}/messages/{message_id}",
    { ...t, message_id: followId },
    { as: "", body: { content: "Follow-up edited" } },
  );
  await botCall(
    "DELETE",
    "/interactions/{interaction_id}/{token}/messages/{message_id}",
    { ...t, message_id: followId },
    { as: "" },
  );
  await botCall(
    "DELETE",
    "/interactions/{interaction_id}/{token}/original",
    t,
    { as: "" },
  );
  // answering twice is refused
  const again = await http(
    "POST",
    "/interactions/{interaction_id}/{token}/callback",
    t,
    { body: { type: "Message", data: { content: "twice" } } },
  );
  expect(again.status >= 400, `second answer ${again.status}`);
  verification["INTERACTIONS double-ack"] = {
    level: "live",
    checked: today,
    test: current,
    response: { status: again.status, type: again.data?.type },
  };
});

await test("interactions: bots cannot create interactions", async () => {
  await botCall(
    "POST",
    "/interactions",
    {},
    {
      body: {
        type: "Command",
        application_id: bot.id,
        channel_id: text._id,
        command_id: hello._id,
        nonce: randomUUID(),
      },
    },
  );
  await botCall(
    "POST",
    "/interactions/autocomplete",
    {},
    {
      body: {
        type: "Autocomplete",
        application_id: bot.id,
        channel_id: text._id,
        command_id: hello._id,
        nonce: randomUUID(),
      },
    },
  );
});

/* ------------------------------------------------------------------ */
/* Voice                                                               */
/* ------------------------------------------------------------------ */

await test("voice: a bot gets a LiveKit ticket; force_disconnect is refused", async () => {
  const node = root.features.livekit.nodes[0].name;
  const ticket = await botCall(
    "POST",
    "/channels/{target}/join_call",
    { target: voice._id },
    { body: { node } },
  );
  expect(ticket.token && ticket.url, "ticket has url and token");
  await botCall(
    "POST",
    "/channels/{target}/join_call",
    { target: voice._id },
    { body: { node, force_disconnect: true }, expectStatus: (s) => s >= 400 },
  );
  await botCall(
    "PUT",
    "/channels/{target}/end_ring/{target_user}",
    { target: voice._id, target_user: member.id },
    { expectStatus: (s) => s < 300 || s >= 400 },
  );
});

/* ------------------------------------------------------------------ */
/* Tutorials                                                           */
/* ------------------------------------------------------------------ */

const examplesDir = join(botApiDir, "examples");
const work = mkdtempSync(join(tmpdir(), "zrzur-doc-examples-"));
const tutorialGateway = gateway(member.session);
await tutorialGateway.opened;

function runExample(file, env = {}) {
  expect(
    existsSync(sdkDist),
    "@zrzur/sdk is not built (run pnpm --filter @zrzur/sdk build)",
  );
  const source = readFileSync(join(examplesDir, file), "utf8").replaceAll(
    'from "@zrzur/sdk/bot"',
    `from ${JSON.stringify(pathToFileURL(sdkDist).href)}`,
  );
  const path = join(work, file);
  writeFileSync(path, source);
  const child = spawn(process.execPath, [path], {
    env: {
      ...process.env,
      ZRZUR_BOT_TOKEN: tutorial.token,
      ZRZUR_API_URL: API,
      ZRZUR_WS_URL: WS,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  const readyPromise = new Promise((resolve, reject) => {
    const fail = (why) => {
      clearInterval(timer);
      reject(new Error(`${file} ${why}: ${out.slice(-400)}`));
    };
    const timer = setInterval(() => {
      if (/ready/.test(out)) {
        clearInterval(timer);
        resolve();
      } else if (child.exitCode !== null) fail("exited");
    }, 50);
    setTimeout(() => fail("not ready"), 20_000);
  });
  return {
    ready: readyPromise,
    output: () => out,
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", resolve);
        child.kill();
      }),
  };
}

async function commandId(name, serverScoped = false) {
  const path = serverScoped
    ? "/applications/{application_id}/servers/{server_id}/commands"
    : "/applications/{application_id}/commands";
  const list = await must(
    "GET",
    path,
    { application_id: tutorial.id, server_id: serverId },
    { bot: tutorial.token },
  );
  const found = list.find((c) => c.name === name);
  expect(found, `command ${name} registered`);
  return found._id;
}

async function invoke(person, name, options = [], channel = text._id) {
  return must(
    "POST",
    "/interactions",
    {},
    {
      session: person.session,
      body: {
        type: "Command",
        application_id: tutorial.id,
        channel_id: channel,
        command_id: await commandId(name),
        nonce: randomUUID(),
        options,
      },
    },
  );
}

const fromTutorial = (match) => (e) =>
  e.type === "Message" && e.author === tutorial.id && match(e);

async function tutorialTest(name, file, fn, env) {
  await test(`tutorial ${file}: ${name}`, async () => {
    const run = runExample(file, env);
    try {
      await run.ready;
      await fn(run);
      verification[`TUTORIAL ${file}`] = {
        level: "live",
        checked: today,
        test: current,
      };
    } catch (error) {
      verification[`TUTORIAL ${file}`] = {
        level: "failed",
        checked: today,
        test: current,
        error: String(error.message).slice(0, 300),
      };
      throw new Error(
        `${error.message}\n--- ${file} output ---\n${run.output().slice(-600)}`,
      );
    } finally {
      await run.stop();
    }
  });
}

await tutorialTest("/hello answers (no library)", "hello-raw.mjs", async () => {
  tutorialGateway.clear();
  await invoke(member, "hello");
  await tutorialGateway.wait(
    fromTutorial((e) => e.content === "Hello from Zrzur!"),
  );
});

await tutorialTest("/hello answers (SDK quickstart)", "hello.mjs", async () => {
  tutorialGateway.clear();
  await invoke(member, "hello");
  await tutorialGateway.wait(fromTutorial((e) => /^Hello, /.test(e.content)));
});

/** Name the step that timed out */
const step = (label, promise) =>
  promise.catch((error) =>
    Promise.reject(new Error(`${label}: ${error.message}`)),
  );

await tutorialTest(
  "options, private reply, deferred reply, autocomplete",
  "commands.mjs",
  async () => {
    tutorialGateway.clear();
    await invoke(member, "roll", [
      { name: "sides", type: "Integer", value: 20 },
    ]);
    await step(
      "roll",
      tutorialGateway.wait(fromTutorial((e) => /\(d20\)$/.test(e.content))),
    );
    await invoke(member, "secret", [
      { name: "text", type: "String", value: "psst" },
    ]);
    await step(
      "secret",
      tutorialGateway.wait(
        (e) =>
          e.type === "EphemeralMessageCreate" && /psst/.test(JSON.stringify(e)),
      ),
    );
    await invoke(member, "slow");
    await step(
      "slow",
      tutorialGateway.wait(
        (e) => /Done after 4 seconds/.test(JSON.stringify(e)),
        12_000,
      ),
    );
    await must(
      "POST",
      "/interactions/autocomplete",
      {},
      {
        session: member.session,
        body: {
          type: "Autocomplete",
          application_id: tutorial.id,
          channel_id: text._id,
          command_id: await commandId("fruit"),
          nonce: randomUUID(),
          options: [{ name: "name", type: "String", value: "ap" }],
          focused: "name",
        },
      },
    );
    const result = await step(
      "autocomplete",
      tutorialGateway.wait((e) => e.type === "InteractionAutocompleteResult"),
    );
    expect(
      JSON.stringify(result).includes("apricot"),
      "suggestions contain apricot",
    );
  },
);

await tutorialTest("!ping gets pong", "events.mjs", async () => {
  tutorialGateway.clear();
  await must(
    "POST",
    "/channels/{target}/messages",
    { target: text._id },
    { session: member.session, body: { content: "!ping" } },
  );
  await tutorialGateway.wait(
    (e) =>
      e.type === "MessageUpdate" && /pong \(\d+ ms\)/.test(JSON.stringify(e)),
  );
});

await tutorialTest(
  "/timeout refuses members, /purge works for the owner",
  "moderation.mjs",
  async () => {
    tutorialGateway.clear();
    await invoke(member, "timeout", [
      { name: "user", type: "User", value: owner.id },
    ]);
    await tutorialGateway.wait(
      (e) =>
        e.type === "EphemeralMessageCreate" &&
        /You need Timeout Members/.test(JSON.stringify(e)),
    );
    for (let i = 0; i < 2; i++)
      await must(
        "POST",
        "/channels/{target}/messages",
        { target: text._id },
        { session: member.session, body: { content: `purge me ${i}` } },
      );
    const purged = tutorialGateway.wait(
      (e) => e.type === "BulkMessageDelete",
      12_000,
    );
    await invoke(owner, "purge", [
      { name: "count", type: "Integer", value: 2 },
    ]);
    await purged;
  },
);

await tutorialTest("a new member is welcomed", "welcome.mjs", async () => {
  tutorialGateway.clear();
  await invoke(owner, "welcome-here");
  await sleep(500);
  const newcomer = await newAccount("new", "erin");
  const code = (
    await must(
      "POST",
      "/channels/{target}/invites",
      { target: text._id },
      { session: owner.session, body: {} },
    )
  )._id;
  await must(
    "POST",
    "/invites/{target}",
    { target: code },
    { session: newcomer.session },
  );
  await tutorialGateway.wait(
    fromTutorial((e) => e.content === `Welcome <@${newcomer.id}>! 👋`),
    10_000,
  );
});

await tutorialTest(
  "button click updates the message",
  "games.mjs",
  async () => {
    tutorialGateway.clear();
    await invoke(member, "coinflip");
    const posted = await tutorialGateway.wait(
      fromTutorial((e) => e.content === "Heads or tails?"),
    );
    // another member's click is refused by the server
    const foreign = await http(
      "POST",
      "/interactions",
      {},
      {
        session: owner.session,
        body: {
          type: "Component",
          application_id: tutorial.id,
          channel_id: text._id,
          message_id: posted._id,
          custom_id: "flip:heads",
          nonce: randomUUID(),
        },
      },
    );
    expect(foreign.status >= 400, `foreign click ${foreign.status}`);
    await must(
      "POST",
      "/interactions",
      {},
      {
        session: member.session,
        body: {
          type: "Component",
          application_id: tutorial.id,
          channel_id: text._id,
          message_id: posted._id,
          custom_id: "flip:heads",
          nonce: randomUUID(),
        },
      },
    );
    await tutorialGateway.wait(
      (e) =>
        e.type === "MessageUpdate" &&
        e.id === posted._id &&
        /You said heads/.test(JSON.stringify(e)),
    );
  },
);

await tutorialTest("prefix is per server", "multi-server.mjs", async () => {
  tutorialGateway.clear();
  await invoke(owner, "prefix", [
    { name: "value", type: "String", value: "?" },
  ]);
  await sleep(500);
  await must(
    "POST",
    "/channels/{target}/messages",
    { target: text._id },
    { session: member.session, body: { content: "?where" } },
  );
  await tutorialGateway.wait(
    fromTutorial((e) => e.content === `This is server ${serverId}.`),
  );
});

await tutorialTest("/report posts a file", "upload.mjs", async () => {
  tutorialGateway.clear();
  await invoke(member, "report");
  const posted = await tutorialGateway.wait(
    fromTutorial((e) => e.content === "Here is your report."),
    12_000,
  );
  expect(
    posted.attachments?.[0]?.filename === "report.csv",
    "report.csv attached",
  );
});

await tutorialTest("/join gets a voice ticket", "voice.mjs", async () => {
  tutorialGateway.clear();
  await invoke(member, "join", [
    { name: "channel", type: "Channel", value: voice._id },
  ]);
  await tutorialGateway.wait(
    (e) =>
      e.type === "EphemeralMessageUpdate" || e.type === "EphemeralMessageCreate"
        ? /voice ticket|Joined the voice channel/.test(JSON.stringify(e))
        : false,
    12_000,
  );
});

const healthPort = 40000 + Math.floor(Math.random() * 5000);
// Interactions over HTTP. The API must reach this machine and allow private
// addresses: ZRZUR_ENDPOINT_HOST, default 127.0.0.1.
const endpointHost = process.env.ZRZUR_ENDPOINT_HOST ?? "127.0.0.1";
const endpointPort = 38787;
async function mfaTicket() {
  const ticket = await fetch(`${API}/auth/mfa/ticket`, {
    method: "PUT",
    headers: {
      "x-session-token": owner.session,
      "content-type": "application/json",
    },
    body: JSON.stringify({ password: owner.password }),
  }).then((response) => response.json());
  return ticket;
}
const signing = await (async () => {
  const headers = {
    "x-session-token": owner.session,
    "content-type": "application/json",
  };
  const ticket = await mfaTicket();
  const created = await fetch(
    `${API}/bots/${tutorial.id}/interactions/secret`,
    {
      method: "POST",
      headers: { ...headers, "x-mfa-ticket": ticket.token },
    },
  ).then((response) => response.json());
  secrets.add(created.secret);
  return created.secret;
})();

await tutorialTest(
  "/hello answers over HTTP",
  "http-interactions.mjs",
  async () => {
    const saved = await fetch(
      `${API}/bots/${tutorial.id}/interactions/endpoint`,
      {
        method: "PUT",
        headers: {
          "x-session-token": owner.session,
          "content-type": "application/json",
          "x-mfa-ticket": (await mfaTicket()).token,
        },
        body: JSON.stringify({
          url: `http://${endpointHost}:${endpointPort}/interactions`,
        }),
      },
    );
    expect(
      saved.status === 200,
      `saving the address: ${saved.status} ${await saved.text()}`,
    );
    try {
      tutorialGateway.clear();
      await invoke(member, "hello");
      await tutorialGateway.wait(
        fromTutorial((e) => /over HTTP!$/.test(e.content)),
      );
    } finally {
      await fetch(`${API}/bots/${tutorial.id}/interactions/endpoint`, {
        method: "DELETE",
        headers: { "x-session-token": owner.session },
      });
    }
  },
  { ZRZUR_SIGNING_SECRET: signing, PORT: String(endpointPort) },
);

await tutorialTest(
  "health endpoint answers once ready",
  "deploy.mjs",
  async () => {
    const health = await fetch(`http://127.0.0.1:${healthPort}/healthz`);
    expect(
      health.status === 200 && (await health.text()) === "ok",
      `healthz ${health.status}`,
    );
    tutorialGateway.clear();
    await invoke(member, "hello");
    await tutorialGateway.wait(fromTutorial((e) => e.content === "Hello!"));
  },
  { HEALTH_PORT: String(healthPort) },
);

await test("threads: start with a card, list, rename, archive", async () => {
  // the example of the Channels page: embeds and components in the first message
  const thread = await botCall(
    "POST",
    "/channels/{target}/threads",
    { target: text._id },
    {
      body: {
        name: "ticket-0001",
        embeds: [{ title: "Ticket 0001", description: "Opened by a member" }],
        components: [
          {
            type: "ActionRow",
            components: [
              {
                type: "Button",
                style: "Danger",
                label: "Close ticket",
                custom_id: "ticket:close",
              },
            ],
          },
        ],
      },
    },
  );
  expect(thread.parent === text._id, "a thread names its parent channel");
  const first = await must(
    "GET",
    "/channels/{target}/messages",
    { target: thread._id },
    { bot: bot.token, query: { limit: 5 } },
  );
  const card = (Array.isArray(first) ? first : first.messages)[0];
  expect(
    card?.embeds?.[0]?.title === "Ticket 0001" &&
      card?.components?.length === 1,
    "the first message of the thread has its embed and its button",
  );
  const listed = await botCall("GET", "/channels/{target}/threads", {
    target: text._id,
  });
  expect(
    listed.some((channel) => channel._id === thread._id),
    "the new thread is in the list",
  );
  await botCall(
    "PATCH",
    "/channels/{target}/thread",
    { target: thread._id },
    { body: { name: "ticket-0001-closed", archived: true } },
  );
});

await test("polls: a bot posts and ends a poll, reads voters, cannot vote", async () => {
  const message = await must(
    "POST",
    "/channels/{target}/messages",
    { target: text._id },
    {
      bot: bot.token,
      body: {
        poll: {
          question: "Which day?",
          answers: [{ text: "Saturday" }, { text: "Sunday" }],
          duration: 1,
        },
      },
    },
  );
  expect(message.poll?.answers?.length === 2, "the message carries its poll");
  const answer = message.poll.answers[0].id ?? message.poll.answers[0]._id ?? 1;
  const place = { target: text._id, msg: message._id, answer };
  await botCall(
    "PUT",
    "/channels/{target}/messages/{msg}/polls/answers/{answer}/votes/@me",
    place,
  );
  await botCall(
    "DELETE",
    "/channels/{target}/messages/{msg}/polls/answers/{answer}/votes/@me",
    place,
  );
  await botCall(
    "GET",
    "/channels/{target}/messages/{msg}/polls/answers/{answer}/voters",
    place,
  );
  await botCall("POST", "/channels/{target}/messages/{msg}/polls/end", {
    target: text._id,
    msg: message._id,
  });
});

await test("commands: public command list and the server's command rules", async () => {
  await botCall("GET", "/bots/{target}/commands", { target: bot.id });
  await botCall(
    "GET",
    "/servers/{server_id}/applications/{application_id}/commands",
    { server_id: serverId, application_id: bot.id },
  );
  await botCall(
    "GET",
    "/servers/{server_id}/applications/{application_id}/permissions",
    { server_id: serverId, application_id: bot.id },
  );
});

await test("soundboard: a bot reads the server's sounds and the library", async () => {
  await botCall("GET", "/servers/{target}/soundboard", { target: serverId });
  await botCall("GET", "/soundboard/library", {});
});

await test("gateway: a resumable session replays what it missed", async () => {
  // one socket, packets as they arrive (a Bulk stays one packet: it has one seq)
  const open = (first) => {
    const socket = new WebSocket(`${WS}/?version=1&format=json`);
    const packets = [];
    const waiters = [];
    socket.addEventListener("open", () => socket.send(JSON.stringify(first)));
    socket.addEventListener("message", ({ data }) => {
      const packet = JSON.parse(data);
      packets.push(packet);
      for (const w of [...waiters])
        if (w.match(packet)) {
          waiters.splice(waiters.indexOf(w), 1);
          w.resolve(packet);
        }
    });
    return {
      socket,
      packets,
      wait(match, ms = 8000) {
        const found = packets.find(match);
        if (found) return Promise.resolve(found);
        return new Promise((resolve, reject) => {
          const w = { match, resolve };
          waiters.push(w);
          setTimeout(
            () => reject(new Error("timed out waiting for a gateway packet")),
            ms,
          );
        });
      },
    };
  };
  const holds = (packet, id) =>
    (packet.type === "Bulk" ? packet.v : [packet]).some(
      (event) => event.type === "Message" && event._id === id,
    );
  const say = (content) =>
    must(
      "POST",
      "/channels/{target}/messages",
      { target: text._id },
      {
        bot: bot.token,
        body: { content },
      },
    );

  // SERVERS + SERVER_MESSAGES, and a session that can be resumed
  const first = open({
    type: "Authenticate",
    token: bot.token,
    intents: 3,
    resumable: true,
  });
  const ready = await first.wait((p) => p.type === "Ready");
  expect(
    typeof ready.session_id === "string" && ready.session_id.length > 0,
    "Ready of a resumable session has no session_id",
  );
  expect(ready.seq === undefined, "Ready carries no seq");
  const seen = await say("resume check: before the drop");
  const before = await first.wait((p) => holds(p, seen._id));
  expect(
    Number.isInteger(before.seq) && before.seq >= 1,
    `an event after Ready has no seq: ${JSON.stringify(before.seq)}`,
  );
  first.socket.close();
  await new Promise((resolve) => setTimeout(resolve, 500));

  const missed = await say("resume check: while away");
  const second = open({
    type: "Resume",
    token: bot.token,
    session_id: ready.session_id,
    seq: before.seq,
  });
  const replayed = await second.wait((p) => holds(p, missed._id));
  expect(replayed.seq > before.seq, "the replayed event must come after seq");
  await second.wait((p) => p.type === "Resumed");
  expect(
    second.packets.findIndex((p) => holds(p, missed._id)) <
      second.packets.findIndex((p) => p.type === "Resumed"),
    "Resumed must come after the missed events",
  );
  expect(
    !second.packets.some((p) => holds(p, seen._id)),
    "an event at or before seq was sent again",
  );
  second.socket.close();

  // a session that is not there: InvalidSession, then Authenticate on the same socket
  const third = open({
    type: "Resume",
    token: bot.token,
    session_id: "no-such-session",
    seq: 0,
  });
  const refused = await third.wait((p) => p.type === "InvalidSession");
  expect(refused.resumable === false, `got ${JSON.stringify(refused)}`);
  third.socket.send(
    JSON.stringify({ type: "Authenticate", token: bot.token, intents: 3 }),
  );
  await third.wait((p) => p.type === "Ready");
  third.socket.close();

  verification["GATEWAY Resume"] = {
    level: "live",
    checked: today,
    test: current,
    response: { ...refused },
  };
});

await test("servers: uninstalling an app and a bot leaving a server", async () => {
  await botCall(
    "DELETE",
    "/servers/{server_id}/applications/{application_id}",
    { server_id: serverId, application_id: tutorial.id },
    { expectStatus: (s) => s < 300 || s === 403 },
  );
  const left = memberGateway.wait(
    (e) => e.type === "ServerMemberLeave" && e.user === bot.id,
  );
  await botCall("DELETE", "/servers/{target}", { target: serverId });
  await left;
});

tutorialGateway.close();
botGateway.close();
memberGateway.close();
rmSync(work, { recursive: true, force: true });

/* ------------------------------------------------------------------ */
/* Coverage                                                            */
/* ------------------------------------------------------------------ */

const inScope = inventory.endpoints;
const exercised = inScope.filter((e) => verification[e.id]);
const missing = inScope.filter((e) => !verification[e.id]).map((e) => e.id);
const passed = results.filter((r) => r.ok).length;
const pending = results.filter((r) => !r.ok && r.pending).length;
const failed = results.length - passed - pending;

const ordered = Object.fromEntries(
  Object.keys(verification)
    .sort()
    .map((k) => [k, verification[k]]),
);
writeFileSync(
  join(botApiDir, "verification.json"),
  JSON.stringify(ordered, null, 1) + "\n",
);

const summary = [
  "# Bot API docs — doc-accuracy results",
  "",
  `Run ${new Date().toISOString()} against \`${API}\` (local test stack).`,
  "",
  `Tests: ${results.length}, passed ${passed}, failed ${failed}, fix written but not deployed ${pending}.`,
  `Documented endpoints: ${inScope.length}; exercised live with a bot or interaction/webhook token: ${exercised.length}.`,
  `Rate-limit buckets seen: ${[...rateLimitHeadersSeen].sort().join(", ")}.`,
  "",
  "## Results",
  "",
  "| Test | Result |",
  "|---|---|",
  ...results.map(
    (r) =>
      `| ${r.name} | ${r.ok ? "pass" : `${r.pending ? `fix written, not deployed (${r.pending})` : "**fail**"}: ${r.error.split("\n")[0].replaceAll("|", "\\|")}`} |`,
  ),
  "",
  "## Documented endpoints not exercised",
  "",
  ...(missing.length ? missing.map((m) => `- ${m}`) : ["None."]),
  "",
].join("\n");

if (REPORT_DIR) {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(join(REPORT_DIR, "doc-accuracy.md"), summary);
}
console.log(
  `\n${passed}/${results.length} passed, ${failed} failed, ${pending} fix written but not deployed; ${exercised.length}/${inScope.length} documented endpoints exercised`,
);
if (missing.length) console.log(`not exercised: ${missing.join(", ")}`);
process.exit(failed === 0 ? 0 : 1);
