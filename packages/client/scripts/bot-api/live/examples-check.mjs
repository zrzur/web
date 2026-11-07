#!/usr/bin/env node
// Runs every tutorial as a real bot process against a local dev stack, using
// two existing dev accounts instead of creating new ones.
//
//   ZRZUR_API_URL=http://127.0.0.1:14702 ZRZUR_WS_URL=ws://127.0.0.1:14703 \
//   ZRZUR_DEV_ACCOUNTS=<file with { accounts: [{ email, password }, ...] }> \
//   node scripts/bot-api/live/examples-check.mjs [only-this-example.mjs]
//
// It logs in, makes a server and a bot, drives the examples like a person
// would, then deletes what it made and logs out, also after a failure.
// Results go to verification.json (`TUTORIAL <file>`); gateway samples, with
// ids and secrets replaced, go to event-samples.json. Loopback URLs only.

import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createConnection, createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const botApiDir = resolve(here, "..");
const sdkDist = resolve(botApiDir, "../../../stoat.js/lib/bot/index.js");
const API = process.env.ZRZUR_API_URL ?? "http://127.0.0.1:14702";
const WS = process.env.ZRZUR_WS_URL ?? "ws://127.0.0.1:14703";
const ONLY = process.argv[2];
const accounts = JSON.parse(
  readFileSync(process.env.ZRZUR_DEV_ACCOUNTS, "utf8"),
).accounts;

for (const url of [API, WS])
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
    throw new Error(`refusing ${url}: loopback only`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);
const verificationFile = join(botApiDir, "verification.json");
const verification = JSON.parse(readFileSync(verificationFile, "utf8"));
const results = [];

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

/* HTTP as a person or as a bot */
async function http(method, path, { session, bot, body, headers } = {}) {
  const response = await fetch(API + path, {
    method,
    headers: {
      ...(session ? { "x-session-token": session } : {}),
      ...(bot ? { "x-bot-token": bot } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data, headers: response.headers };
}

async function must(method, path, options) {
  let r = await http(method, path, options);
  for (let i = 0; i < 3 && r.status === 429 && !r.data?.type; i++) {
    await sleep(r.data?.retry_after ?? 1000);
    r = await http(method, path, options);
  }
  if (r.status >= 300)
    throw new Error(
      `${method} ${path}: ${r.status} ${JSON.stringify(r.data)?.slice(0, 200)}`,
    );
  return r.data;
}

/* Gateway as a person, or as a bot for the samples */
function gateway(token, query = "") {
  const events = [];
  const waiters = [];
  const socket = new WebSocket(`${WS}/?version=1&format=json${query}`);
  // events only arrive after Ready: anything sooner reaches nobody
  let markReady;
  const opened = new Promise((res, rej) => {
    markReady = res;
    socket.addEventListener("open", () =>
      socket.send(JSON.stringify({ type: "Authenticate", token })),
    );
    socket.addEventListener("error", rej);
  });
  socket.addEventListener("message", ({ data }) => {
    const packet = JSON.parse(data);
    for (const event of packet.type === "Bulk" ? packet.v : [packet]) {
      events.push(event);
      if (event.type === "Ready") setTimeout(markReady, 300);
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
    clear: () => events.splice(0),
    close: () => socket.close(),
    wait(match, ms = 10_000) {
      const found = events.find(match);
      if (found) return Promise.resolve(found);
      return new Promise((res, rej) => {
        const w = { match, resolve: res };
        waiters.push(w);
        setTimeout(() => {
          const i = waiters.indexOf(w);
          if (i === -1) return;
          waiters.splice(i, 1);
          rej(new Error("timed out waiting for a gateway event"));
        }, ms);
      });
    },
  };
}

/** A relay in front of the gateway, so a test can cut the line */
function relay(target) {
  const { hostname, port } = new URL(target);
  const open = new Set();
  const server = createServer((client) => {
    const upstream = createConnection(Number(port), hostname);
    client.pipe(upstream).pipe(client);
    for (const side of [client, upstream]) {
      side.on("error", () => {});
      side.on("close", () => {
        client.destroy();
        upstream.destroy();
        open.delete(client);
      });
    }
    open.add(client);
  });
  return new Promise((res) =>
    server.listen(0, "127.0.0.1", () =>
      res({
        url: `ws://127.0.0.1:${server.address().port}`,
        cut: () => [...open].forEach((c) => c.destroy()),
        close: () => server.close(),
      }),
    ),
  );
}

/* The two people */
const people = [];
async function login(account) {
  const r = await must("POST", "/auth/session/login", {
    body: {
      email: account.email,
      password: account.password,
      friendly_name: "docs examples",
    },
  });
  const person = {
    session: r.token,
    id: r.user_id,
    password: account.password,
  };
  people.push(person);
  return person;
}

/* Replacing every id and secret in the samples */
const ULID = /\b[0-9A-HJKMNP-TV-Z]{26}\b/g;
const ids = new Map();
function sanitise(value, key = "") {
  if (typeof value === "string") {
    if (/token|secret|^vapid$/i.test(key)) return "YOUR_TOKEN_HERE";
    if (key === "email") return "user@example.com";
    if (key === "username") return "example_user";
    if (key === "discriminator") return "1234";
    return value.replace(ULID, (id) => {
      if (!ids.has(id))
        ids.set(id, `01JC${String(ids.size + 1).padStart(22, "0")}`);
      return ids.get(id);
    });
  }
  if (Array.isArray(value))
    return value.slice(0, 2).map((v) => sanitise(v, key));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [sanitise(k), sanitise(v, k)]),
    );
  return value;
}

const samples = {};
function collect(events) {
  for (const event of events) {
    if (event.type === "Ready")
      samples.Ready ??= sanitise({
        type: "Ready",
        users: event.users?.slice(0, 1),
        servers: event.servers?.slice(0, 1),
        channels: event.channels?.slice(0, 1),
        members: event.members?.slice(0, 1),
        emojis: event.emojis?.slice(0, 1),
      });
    else samples[event.type] ??= sanitise(event);
  }
}

/* Running one tutorial */
const work = mkdtempSync(join(tmpdir(), "zrzur-doc-examples-"));
let tutorialToken;
function runExample(file, env = {}) {
  const source = readFileSync(join(botApiDir, "examples", file), "utf8");
  if (source.includes("@zrzur/sdk/bot"))
    expect(existsSync(sdkDist), "@zrzur/sdk is not built");
  const path = join(work, file);
  writeFileSync(
    path,
    source.replaceAll(
      'from "@zrzur/sdk/bot"',
      `from ${JSON.stringify(pathToFileURL(sdkDist).href)}`,
    ),
  );
  const child = spawn(process.execPath, [path], {
    cwd: work,
    env: {
      ...process.env,
      ZRZUR_BOT_TOKEN: tutorialToken,
      ZRZUR_API_URL: API,
      ZRZUR_WS_URL: WS,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  const ready = new Promise((res, rej) => {
    const fail = (why) => {
      clearInterval(timer);
      rej(new Error(`${file} ${why}: ${out.slice(-400)}`));
    };
    const timer = setInterval(() => {
      if (/ready/.test(out)) {
        clearInterval(timer);
        res();
      } else if (child.exitCode !== null) fail("exited");
    }, 50);
    setTimeout(() => fail("not ready"), 20_000);
  });
  return {
    ready,
    output: () => out,
    stop: () =>
      new Promise((res) => {
        if (child.exitCode !== null) return res();
        child.once("exit", res);
        child.kill();
      }),
  };
}

async function tutorial(name, file, fn, env) {
  if (ONLY && ONLY !== file) return;
  const run = runExample(file, env);
  const started = Date.now();
  const entry = {
    level: "live",
    checked: today,
    test: `examples-check: ${name}`,
  };
  try {
    await run.ready;
    await fn(run);
    results.push({ file, name, ok: true, ms: Date.now() - started });
    console.log(`  ok   ${file}: ${name}`);
  } catch (error) {
    entry.level = "failed";
    entry.error = String(error.message).slice(0, 300);
    results.push({ file, name, ok: false, error: entry.error });
    console.log(
      `  FAIL ${file}: ${name}: ${error.message}\n${run.output().slice(-800)}`,
    );
  } finally {
    await run.stop();
    expect(!run.output().includes(tutorialToken), `${file} printed the token`);
    verification[`TUTORIAL ${file}`] = entry;
  }
}

const cleanup = [];
let owner, member, bot, serverId, text, voice, invite;

async function setup() {
  [owner, member] = await Promise.all(
    accounts.slice(0, 2).reverse().map(login),
  );

  const made = await must("POST", "/servers/create", {
    session: owner.session,
    body: { name: "Docs examples" },
  });
  serverId = made.server._id;
  text = made.channels[0];
  cleanup.push(async () => {
    await sleep(11_000); // the servers bucket: 5 in 10 seconds
    const ticket = await must("PUT", "/auth/mfa/ticket", {
      session: owner.session,
      body: { password: owner.password },
    });
    await must("DELETE", `/servers/${serverId}`, {
      session: owner.session,
      headers: { "x-mfa-ticket": ticket.token },
    });
  });
  voice = await must("POST", `/servers/${serverId}/channels`, {
    session: owner.session,
    body: { type: "Voice", name: "voice" },
  });
  invite = await must("POST", `/channels/${text._id}/invites`, {
    session: owner.session,
    body: {},
  });
  await must("POST", `/invites/${invite._id}`, { session: member.session });

  // creating bots is limited to 7 a week: keep one bot and renew its token
  const owned = await must("GET", "/bots/@me", { session: owner.session });
  const kept = owned.users?.find((u) => u.username.startsWith("docsreuse"));
  let created;
  if (kept) {
    const ticket = await must("PUT", "/auth/mfa/ticket", {
      session: owner.session,
      body: { password: owner.password },
    });
    const reset = await must("POST", `/bots/${kept._id}/token/reset`, {
      session: owner.session,
      headers: { "x-mfa-ticket": ticket.token },
    });
    created = { _id: kept._id, token: reset.token ?? reset.bot?.token };
    expect(created.token, "the reset answers with a new token");
  } else {
    created = await must("POST", "/bots/create", {
      session: owner.session,
      body: { name: `docsreuse${randomUUID().slice(0, 6)}` },
    });
  }
  tutorialToken = created.token;
  bot = created;
  await must("PATCH", `/bots/${created._id}`, {
    session: owner.session,
    body: { privileged_intents: 7168 },
  });
  await must("POST", `/bots/${created._id}/invite`, {
    session: owner.session,
    body: { server: serverId },
  });
  const role = await must("POST", `/servers/${serverId}/roles`, {
    session: owner.session,
    body: { name: "Bots", rank: 0 },
  });
  // everything but ManageJoinRequests
  const ALL = [
    0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 20, 21, 22, 23, 24, 25, 26, 27,
    28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41,
  ].reduce((sum, bit) => sum | (1n << BigInt(bit)), 0n);
  await must("PUT", `/servers/${serverId}/permissions/${role.id}`, {
    session: owner.session,
    body: { permissions: { allow: Number(ALL), deny: 0 } },
  });
  await must("PATCH", `/servers/${serverId}/members/${created._id}`, {
    session: owner.session,
    body: { roles: [role.id] },
  });
}

const commands = async (scoped) => {
  const path = scoped
    ? `/applications/${bot._id}/servers/${serverId}/commands`
    : `/applications/${bot._id}/commands`;
  return must("GET", path, { bot: tutorialToken });
};

async function invoke(person, name, options = [], scoped = false) {
  const found = (await commands(scoped)).find((c) => c.name === name);
  expect(found, `command ${name} registered`);
  return must("POST", "/interactions", {
    session: person.session,
    body: {
      type: "Command",
      application_id: bot._id,
      channel_id: text._id,
      command_id: found._id,
      nonce: randomUUID(),
      options,
    },
  });
}

const fromBot = (match) => (e) =>
  e.type === "Message" && e.author === bot._id && match(e);
const says = (type, pattern) => (e) =>
  e.type === type && pattern.test(JSON.stringify(e));

async function clearCommands() {
  await must("PUT", `/applications/${bot._id}/commands`, {
    bot: tutorialToken,
    body: [],
  });
  await must("PUT", `/applications/${bot._id}/servers/${serverId}/commands`, {
    bot: tutorialToken,
    body: [],
  });
}

/**
 * A proxy in front of the API: the first requests get a 502 HTML page, and
 * the first answer to an interaction gets a 429, so the paths that log and
 * retry really run.
 */
function flakyApi() {
  let failures = 2;
  let limited = false;
  const server = createHttpServer(async (request, response) => {
    if (failures > 0) {
      failures -= 1;
      response.writeHead(502, { "content-type": "text/html" });
      return response.end("<html><body>Bad gateway</body></html>");
    }
    if (!limited && /\/interactions\/.+\/callback$/.test(request.url)) {
      limited = true;
      response.writeHead(429, { "content-type": "application/json" });
      return response.end('{"retry_after":50,"global":false}');
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const headers = { ...request.headers };
    delete headers.host;
    delete headers["content-length"];
    const answer = await fetch(API + request.url, {
      method: request.method,
      headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
    });
    const text = await answer.text();
    response.writeHead(answer.status, {
      "content-type": answer.headers.get("content-type") ?? "application/json",
    });
    response.end(text);
  });
  return new Promise((res) =>
    server.listen(0, "127.0.0.1", () =>
      res({
        url: `http://127.0.0.1:${server.address().port}`,
        reset() {
          failures = 2;
          limited = false;
        },
        close: () => server.close(),
      }),
    ),
  );
}

async function fullBot() {
  const line = await relay(WS);
  const flaky = await flakyApi();
  cleanup.push(() => flaky.close());
  cleanup.push(() => line.close());
  const memberEvents = gateway(member.session);
  const ownerEvents = gateway(owner.session);
  await Promise.all([memberEvents.opened, ownerEvents.opened]);
  cleanup.push(
    () => memberEvents.close(),
    () => ownerEvents.close(),
  );
  const dataFile = join(work, "bot-data.json");
  const env = {
    ZRZUR_API_URL: flaky.url,
    ZRZUR_WS_URL: line.url,
    ZRZUR_TEST_SERVER: serverId,
    DATA_FILE: dataFile,
  };
  const ephemeral = (pattern) => says("EphemeralMessageCreate", pattern);

  await tutorial(
    "commands, form, buttons, moderation, data, errors",
    "full-bot.mjs",
    async () => {
      await invoke(member, "ping", [], true);
      await memberEvents.wait(ephemeral(/Pong!/));

      await invoke(
        member,
        "note",
        [{ name: "list", type: "SubCommand" }],
        true,
      );
      await memberEvents.wait(ephemeral(/No notes yet/));

      for (const title of ["First", "Second"]) {
        memberEvents.clear();
        const opened = await invoke(
          member,
          "note",
          [{ name: "add", type: "SubCommand" }],
          true,
        );
        await memberEvents.wait((e) => e.type === "InteractionModal");
        await must("POST", "/interactions", {
          session: member.session,
          body: {
            type: "ModalSubmit",
            application_id: bot._id,
            channel_id: text._id,
            parent_id: opened._id,
            custom_id: "note-form",
            nonce: randomUUID(),
            fields: [
              { custom_id: "title", value: title },
              { custom_id: "text", value: `Text of ${title}` },
            ],
          },
        });
        await memberEvents.wait(ephemeral(/Saved/));
      }
      expect(
        JSON.parse(readFileSync(dataFile, "utf8")).notes[serverId].length === 2,
        "two notes saved",
      );

      memberEvents.clear();
      await invoke(
        member,
        "note",
        [{ name: "list", type: "SubCommand" }],
        true,
      );
      const page = await memberEvents.wait(ephemeral(/Second/));
      await must("POST", "/interactions", {
        session: member.session,
        body: {
          type: "Component",
          application_id: bot._id,
          channel_id: text._id,
          message_id: page.message._id,
          custom_id: "note:0",
          nonce: randomUUID(),
        },
      });
      await memberEvents.wait(says("EphemeralMessageUpdate", /First/));

      // hidden from a member without the permission
      const refused = await http("POST", "/interactions", {
        session: member.session,
        body: {
          type: "Command",
          application_id: bot._id,
          channel_id: text._id,
          command_id: (await commands(true)).find((c) => c.name === "warn")._id,
          nonce: randomUUID(),
          options: [],
        },
      });
      expect(refused.status === 403, `member /warn: ${refused.status}`);

      // an Arabic name in the audit reason must reach the log intact
      await must("PATCH", `/servers/${serverId}/members/${owner.id}`, {
        session: owner.session,
        body: { nickname: "مشرف" },
      });
      await sleep(600);
      const who = [{ name: "member", type: "User", value: member.id }];
      await invoke(
        owner,
        "warn",
        [...who, { name: "reason", type: "String", value: "Spam" }],
        true,
      );
      await ownerEvents.wait(ephemeral(/1 warning/));

      await invoke(
        owner,
        "timeout",
        [...who, { name: "minutes", type: "Integer", value: 1 }],
        true,
      );
      await ownerEvents.wait((e) =>
        /is silent for 1 minute/.test(JSON.stringify(e)),
      );
      const silenced = await must(
        "GET",
        `/servers/${serverId}/members/${member.id}`,
        { session: owner.session },
      );
      expect(silenced.timeout, "the member is timed out");
      await sleep(10_500);
      const log = await must("GET", `/servers/${serverId}/audit_logs`, {
        session: owner.session,
      });
      expect(
        JSON.stringify(log).includes("Requested by مشرف"),
        "the audit log has the Arabic name",
      );
      await must("PATCH", `/servers/${serverId}/members/${member.id}`, {
        session: owner.session,
        body: { remove: ["Timeout"] },
      });

      // the error path: the owner cannot be timed out
      await invoke(
        owner,
        "timeout",
        [
          { name: "member", type: "User", value: owner.id },
          { name: "minutes", type: "Integer", value: 1 },
        ],
        true,
      );
      await ownerEvents.wait((e) =>
        /That member cannot be timed out/.test(JSON.stringify(e)),
      );

      // a moderator cannot time out someone above them
      await sleep(10_500);
      const mods = await must("POST", `/servers/${serverId}/roles`, {
        session: owner.session,
        body: { name: "Moderators" },
      });
      await must("PUT", `/servers/${serverId}/permissions/${mods.id}`, {
        session: owner.session,
        body: { permissions: { allow: 256, deny: 0 } },
      });
      await must("PATCH", `/servers/${serverId}/members/${member.id}`, {
        session: owner.session,
        body: { roles: [mods.id] },
      });
      memberEvents.clear();
      await invoke(
        member,
        "timeout",
        [
          { name: "member", type: "User", value: owner.id },
          { name: "minutes", type: "Integer", value: 1 },
        ],
        true,
      );
      await memberEvents.wait((e) =>
        /That member ranks at or above you/.test(JSON.stringify(e)),
      );
      const safe = await must(
        "GET",
        `/servers/${serverId}/members/${owner.id}`,
        { session: owner.session },
      );
      expect(!safe.timeout, "the owner was not timed out");
      await must("PATCH", `/servers/${serverId}/members/${member.id}`, {
        session: owner.session,
        body: { remove: ["Roles"] },
      });
    },
    env,
  );

  flaky.reset();
  await tutorial(
    "a 502 page is retried, a token never reaches the log",
    "full-bot.mjs",
    async (run) => {
      expect(/"commands registered"/.test(run.output()), "started");
      memberEvents.clear();
      await invoke(member, "ping", [], true);
      await memberEvents.wait(ephemeral(/Pong!/));
      const log = run.output();
      expect(
        /\/interactions\/\S+\/\*\*\*/.test(log),
        "the path was logged, masked",
      );
      expect(
        !/\/interactions\/[0-9A-Z]{26}\/[^*]/.test(log),
        "no interaction token in the log",
      );
    },
    env,
  );

  await tutorial(
    "notes survive a restart, a cut line reconnects",
    "full-bot.mjs",
    async (run) => {
      memberEvents.clear();
      await invoke(
        member,
        "note",
        [{ name: "list", type: "SubCommand" }],
        true,
      );
      await memberEvents.wait(ephemeral(/Second/));

      line.cut();
      const until = Date.now() + 15_000;
      while (
        Date.now() < until &&
        !/"ready"[\s\S]*"disconnected"[\s\S]*"ready"/.test(run.output())
      )
        await sleep(100);
      expect(
        /"disconnected"[\s\S]*"ready"/.test(run.output()),
        "reconnected after the line was cut",
      );
      memberEvents.clear();
      await invoke(member, "ping", [], true);
      await memberEvents.wait(ephemeral(/Pong!/));
    },
    env,
  );
  memberEvents.close();
  ownerEvents.close();
}

async function others() {
  const memberEvents = gateway(member.session);
  await memberEvents.opened;
  cleanup.push(() => memberEvents.close());
  const ephemeral = (pattern) => says("EphemeralMessageCreate", pattern);

  await tutorial("/hello answers (no library)", "hello-raw.mjs", async () => {
    await invoke(member, "hello");
    await memberEvents.wait(fromBot((e) => e.content === "Hello from Zrzur!"));
  });

  await tutorial("/hello answers (SDK)", "hello.mjs", async () => {
    memberEvents.clear();
    await invoke(member, "hello");
    await memberEvents.wait(fromBot((e) => /^Hello/.test(e.content)));
  });

  await tutorial(
    "options, private, deferred, autocomplete",
    "commands.mjs",
    async () => {
      memberEvents.clear();
      await invoke(member, "roll", [
        { name: "sides", type: "Integer", value: 20 },
      ]);
      await memberEvents.wait(fromBot((e) => /\(d20\)$/.test(e.content)));
      await invoke(member, "secret", [
        { name: "text", type: "String", value: "psst" },
      ]);
      await memberEvents.wait(ephemeral(/psst/));
      await invoke(member, "slow");
      await memberEvents.wait(
        (e) => /Done after 4 seconds/.test(JSON.stringify(e)),
        12_000,
      );
      await must("POST", "/interactions/autocomplete", {
        session: member.session,
        body: {
          type: "Autocomplete",
          application_id: bot._id,
          channel_id: text._id,
          command_id: (await commands()).find((c) => c.name === "fruit")._id,
          nonce: randomUUID(),
          options: [{ name: "name", type: "String", value: "ap" }],
          focused: "name",
        },
      });
      const result = await memberEvents.wait(
        (e) => e.type === "InteractionAutocompleteResult",
      );
      expect(
        /apricot/.test(JSON.stringify(result)),
        "suggestions contain apricot",
      );
    },
  );

  await tutorial("!ping gets pong", "events.mjs", async () => {
    memberEvents.clear();
    await must("POST", `/channels/${text._id}/messages`, {
      session: member.session,
      body: { content: "!ping" },
    });
    await memberEvents.wait(fromBot((e) => e.content === "pong"));
  });

  await tutorial(
    "timeout refused, purge deletes",
    "moderation.mjs",
    async () => {
      memberEvents.clear();
      await invoke(member, "timeout", [
        { name: "user", type: "User", value: owner.id },
      ]);
      await memberEvents.wait(ephemeral(/You need Timeout Members/));
      for (const i of [1, 2])
        await must("POST", `/channels/${text._id}/messages`, {
          session: member.session,
          body: { content: `purge me ${i}` },
        });
      const purged = memberEvents.wait(
        (e) => e.type === "BulkMessageDelete",
        12_000,
      );
      await invoke(owner, "purge", [
        { name: "count", type: "Integer", value: 2 },
      ]);
      await purged;
    },
  );

  await tutorial("a new member is welcomed", "welcome.mjs", async () => {
    await invoke(owner, "welcome-here");
    await sleep(500);
    await must("DELETE", `/servers/${serverId}`, { session: member.session });
    const code = (
      await must("POST", `/channels/${text._id}/invites`, {
        session: owner.session,
        body: {},
      })
    )._id;
    const ownerEvents = gateway(owner.session);
    await ownerEvents.opened;
    try {
      await must("POST", `/invites/${code}`, { session: member.session });
      await ownerEvents.wait(fromBot((e) => e.content?.startsWith("Welcome")));
    } finally {
      ownerEvents.close();
    }
  });

  await tutorial("a click changes the message", "games.mjs", async () => {
    memberEvents.clear();
    await invoke(member, "coinflip");
    const posted = await memberEvents.wait(
      fromBot((e) => e.content === "Heads or tails?"),
    );
    const click = (person) =>
      http("POST", "/interactions", {
        session: person.session,
        body: {
          type: "Component",
          application_id: bot._id,
          channel_id: text._id,
          message_id: posted._id,
          custom_id: "flip:heads",
          nonce: randomUUID(),
        },
      });
    expect((await click(owner)).status >= 400, "a foreign click is refused");
    expect((await click(member)).status < 300, "the click is accepted");
    await memberEvents.wait(says("MessageUpdate", /You said heads/));
  });

  await tutorial("the prefix is per server", "multi-server.mjs", async () => {
    memberEvents.clear();
    await invoke(owner, "prefix", [
      { name: "value", type: "String", value: "?" },
    ]);
    await sleep(500);
    await must("POST", `/channels/${text._id}/messages`, {
      session: member.session,
      body: { content: "?where" },
    });
    await memberEvents.wait(
      fromBot((e) => e.content === `This is server ${serverId}.`),
    );
  });

  await tutorial("/report posts a file", "upload.mjs", async () => {
    memberEvents.clear();
    await invoke(member, "report");
    const posted = await memberEvents.wait(
      fromBot((e) => e.content === "Here is your report."),
      12_000,
    );
    expect(
      posted.attachments?.[0]?.filename === "report.csv",
      "report.csv attached",
    );
  });

  await tutorial("/join gets a voice ticket", "voice.mjs", async () => {
    memberEvents.clear();
    await invoke(member, "join", [
      { name: "channel", type: "Channel", value: voice._id },
    ]);
    await memberEvents.wait(
      (e) =>
        (e.type === "EphemeralMessageUpdate" ||
          e.type === "EphemeralMessageCreate") &&
        /voice ticket|Joined the voice channel/.test(JSON.stringify(e)),
      12_000,
    );
  });

  const healthPort = 40000 + Math.floor(Math.random() * 5000);
  await tutorial(
    "health answers once ready",
    "deploy.mjs",
    async () => {
      const health = await fetch(`http://127.0.0.1:${healthPort}/healthz`);
      expect(
        health.status === 200 && (await health.text()) === "ok",
        `healthz ${health.status}`,
      );
      memberEvents.clear();
      await invoke(member, "hello");
      await memberEvents.wait(fromBot((e) => e.content === "Hello!"));
    },
    { HEALTH_PORT: String(healthPort) },
  );
}

/* Every event the page shows a sample of, with real data */
async function collectSamples() {
  const observer = gateway(tutorialToken, "&intents=7231");
  await observer.opened;
  const as = { session: owner.session };
  await observer.wait((e) => e.type === "Ready");
  const sent = await must("POST", `/channels/${text._id}/messages`, {
    ...as,
    body: { content: "Hello" },
  });
  await must("PATCH", `/channels/${text._id}/messages/${sent._id}`, {
    ...as,
    body: { content: "Hello again" },
  });
  await must(
    "PUT",
    `/channels/${text._id}/messages/${sent._id}/reactions/%F0%9F%91%8D`,
    as,
  );
  await must(
    "DELETE",
    `/channels/${text._id}/messages/${sent._id}/reactions/%F0%9F%91%8D`,
    as,
  );
  await must("DELETE", `/channels/${text._id}/messages/${sent._id}`, as);
  const channel = await must("POST", `/servers/${serverId}/channels`, {
    ...as,
    body: { type: "Text", name: "samples" },
  });
  await must("PATCH", `/channels/${channel._id}`, {
    ...as,
    body: { description: "Sample" },
  });
  await must("DELETE", `/channels/${channel._id}`, as);
  const role = await must("POST", `/servers/${serverId}/roles`, {
    ...as,
    body: { name: "Sample" },
  });
  await must("DELETE", `/servers/${serverId}/roles/${role.id}`, as);
  await must("PATCH", `/servers/${serverId}`, {
    ...as,
    body: { description: "Sample" },
  });
  await must("DELETE", `/servers/${serverId}`, { session: member.session });
  await must("POST", `/invites/${invite._id}`, { session: member.session });
  await must("PATCH", `/servers/${serverId}/members/${member.id}`, {
    ...as,
    body: { nickname: "Sample" },
  });
  await must("POST", `/channels/${text._id}/typing`, {
    bot: tutorialToken,
  }).catch(() => {});
  await must("POST", `/channels/${text._id}/typing`, as).catch(() => {});
  await sleep(1000);
  // and one real interaction, from a command made for this
  await must("PUT", `/applications/${bot._id}/commands`, {
    bot: tutorialToken,
    body: [
      {
        name: "sample",
        description: "Sample",
        options: [{ type: "User", name: "who", description: "Who" }],
      },
    ],
  });
  await invoke(member, "sample", [
    { name: "who", type: "User", value: owner.id },
  ]);
  await observer.wait((e) => e.type === "InteractionCreate");
  collect(observer.events);
  observer.close();

  const rate = await http("GET", "/users/@me", { bot: tutorialToken });
  samples.__headers = Object.fromEntries(
    [...rate.headers].filter(([k]) =>
      k.toLowerCase().startsWith("x-ratelimit"),
    ),
  );
  writeFileSync(
    join(botApiDir, "event-samples.json"),
    JSON.stringify(samples, null, 1) + "\n",
  );
}

/* The calls the guide pages show, as the pages write them */
async function pageChecks() {
  const bot_ = { bot: tutorialToken };
  const check = async (name, fn) => {
    try {
      const detail = await fn();
      results.push({ file: "pages", name, ok: true });
      console.log(`  ok   page: ${name}${detail ? ` (${detail})` : ""}`);
    } catch (error) {
      results.push({ file: "pages", name, ok: false, error: error.message });
      console.log(`  FAIL page: ${name}: ${error.message}`);
    }
  };
  const channel = text._id;
  const upload = async () => {
    const form = new FormData();
    form.set(
      "file",
      new Blob(["a,b\n1,2\n"], { type: "text/csv" }),
      "report.csv",
    );
    const root = await must("GET", "/", {});
    const r = await fetch(`${root.features.autumn.url}/attachments`, {
      method: "POST",
      headers: { "x-bot-token": tutorialToken },
      body: form,
    });
    expect(r.ok, `upload ${r.status}`);
    return (await r.json()).id;
  };

  await check("messages: send, reply, embed, edit, delete", async () => {
    const first = await must("POST", `/channels/${channel}/messages`, {
      ...bot_,
      body: { content: "Hello!" },
    });
    const replied = await must("POST", `/channels/${channel}/messages`, {
      ...bot_,
      body: {
        content: "Thanks!",
        replies: [{ id: first._id, mention: false }],
      },
    });
    expect(replied.replies?.[0] === first._id, "reply stored");
    const embed = await must("POST", `/channels/${channel}/messages`, {
      ...bot_,
      body: {
        embeds: [
          {
            title: "Rules",
            description: "Be kind.",
            colour: "#E0195F",
            url: "https://example.com",
            fields: [{ name: "One", value: "Two", inline: true }],
            author: { name: "Author" },
            footer: { text: "Footer" },
          },
        ],
      },
    });
    expect(embed.embeds?.length === 1, "embed stored");
    await must("PATCH", `/channels/${channel}/messages/${first._id}`, {
      ...bot_,
      body: { content: "Edited" },
    });
    await must("DELETE", `/channels/${channel}/messages/${first._id}`, bot_);
    return "embed fields stored: " + Object.keys(embed.embeds[0]).join(",");
  });

  await check("messages: upload, then attach; an id works once", async () => {
    const id = await upload();
    const sent = await must("POST", `/channels/${channel}/messages`, {
      ...bot_,
      body: { content: "Here it is", attachments: [id] },
    });
    expect(sent.attachments?.[0]?.filename === "report.csv", "attached");
    const again = await http("POST", `/channels/${channel}/messages`, {
      ...bot_,
      body: { content: "Again", attachments: [id] },
    });
    return `second use: ${again.status} ${again.data?.type ?? ""}`;
  });

  await check("reactions, pins", async () => {
    const m = await must("POST", `/channels/${channel}/messages`, {
      ...bot_,
      body: { content: "React" },
    });
    await must(
      "PUT",
      `/channels/${channel}/messages/${m._id}/reactions/%F0%9F%91%8D`,
      bot_,
    );
    await must(
      "DELETE",
      `/channels/${channel}/messages/${m._id}/reactions/%F0%9F%91%8D`,
      bot_,
    );
    await must("POST", `/channels/${channel}/messages/${m._id}/pin`, bot_);
    const pinned = await must("POST", `/channels/${channel}/search`, {
      ...bot_,
      body: { pinned: true },
    });
    return `pinned listed: ${JSON.stringify(pinned).includes(m._id)}`;
  });

  await check("threads", async () => {
    const thread = await must("POST", `/channels/${channel}/threads`, {
      ...bot_,
      body: { name: "Release", content: "First message" },
    });
    const id = thread._id ?? thread.channel?._id;
    await must("POST", `/channels/${id}/messages`, {
      ...bot_,
      body: { content: "In the thread" },
    });
    const list = await must("GET", `/channels/${channel}/threads`, bot_);
    await must("PATCH", `/channels/${id}/thread`, {
      ...bot_,
      body: { archived: true },
    });
    return `listed ${Array.isArray(list) ? list.length : Object.keys(list)}`;
  });

  await check(
    "moderation: timeout, end, kick, ban, unban with a reason",
    async () => {
      const until = new Date(Date.now() + 60_000).toISOString();
      await must("PATCH", `/servers/${serverId}/members/${member.id}`, {
        ...bot_,
        body: { timeout: until },
        headers: { "X-Audit-Log-Reason": "Spam" },
      });
      await must("PATCH", `/servers/${serverId}/members/${member.id}`, {
        ...bot_,
        body: { remove: ["Timeout"] },
      });
      await sleep(10_500);
      await must("DELETE", `/servers/${serverId}/members/${member.id}`, {
        ...bot_,
        headers: { "X-Audit-Log-Reason": "Spam" },
      });
      await must("POST", `/invites/${invite._id}`, { session: member.session });
      await must("PUT", `/servers/${serverId}/bans/${member.id}`, {
        ...bot_,
        body: { reason: "Spam", delete_message_seconds: 86400 },
      });
      await must("DELETE", `/servers/${serverId}/bans/${member.id}`, bot_);
      await must("POST", `/invites/${invite._id}`, { session: member.session });
      await sleep(10_500);
      const log = await must("GET", `/servers/${serverId}/audit_logs`, bot_);
      return `audit log has the reason: ${JSON.stringify(log).includes("Spam")}`;
    },
  );

  await check("one command name in both scopes", async () => {
    const list = [{ name: "both", description: "Both scopes" }];
    await must("PUT", `/applications/${bot._id}/commands`, {
      ...bot_,
      body: list,
    });
    await must("PUT", `/applications/${bot._id}/servers/${serverId}/commands`, {
      ...bot_,
      body: list,
    });
    const seen = await must("GET", `/servers/${serverId}/commands`, {
      session: member.session,
    });
    return `a member sees ${seen.commands.filter((c) => c.name === "both").length}`;
  });

  await check("two connections with one token", async () => {
    const [a, b] = [gateway(tutorialToken), gateway(tutorialToken)];
    await Promise.all([a.opened, b.opened]);
    await invoke(member, "both");
    await a.wait((e) => e.type === "InteractionCreate");
    await b.wait((e) => e.type === "InteractionCreate");
    a.close();
    b.close();
    return "both received it";
  });

  await check("an interaction nobody answers; a late answer", async () => {
    const socket = gateway(tutorialToken);
    await socket.opened;
    await invoke(member, "both");
    const { interaction } = await socket.wait(
      (e) => e.type === "InteractionCreate",
    );
    socket.close();
    await sleep(3500);
    const late = await http(
      "POST",
      `/interactions/${interaction._id}/${interaction.token}/callback`,
      { body: { type: "Message", data: { content: "Late" } } },
    );
    return `late answer: ${late.status} ${late.data?.type}`;
  });

  await check(
    "follow-ups: first answer, 5 more, the sixth refused",
    async () => {
      const socket = gateway(tutorialToken);
      await socket.opened;
      await invoke(member, "both");
      const { interaction: i } = await socket.wait(
        (e) => e.type === "InteractionCreate",
      );
      socket.close();
      const route = `/interactions/${i._id}/${i.token}`;
      await must("POST", `${route}/callback`, {
        body: { type: "DeferredMessage", data: { ephemeral: true } },
      });
      const edited = await http("PATCH", `${route}/original`, {
        body: { content: "Done." },
      });
      let last;
      for (let n = 0; n < 6; n++)
        last = await http("POST", `${route}/followups`, {
          body: { content: `n${n}` },
        });
      const second = await http("POST", `${route}/callback`, {
        body: { type: "Message", data: { content: "again" } },
      });
      return `edit ${edited.status}, sixth ${last.status} ${last.data?.type}, second answer ${second.status} ${second.data?.type}`;
    },
  );

  await check("errors the pages name", async () => {
    const wrong = await http("GET", "/users/@me", { bot: "wrong" });
    const empty = await http("POST", `/channels/${channel}/messages`, {
      ...bot_,
      body: {},
    });
    const long = await http("POST", `/channels/${channel}/messages`, {
      ...bot_,
      body: { content: "x".repeat(2001) },
    });
    return [wrong, empty, long]
      .map((r) => `${r.status} ${r.data?.type}`)
      .join("; ");
  });

  await check(
    "OAuth2: the page's PKCE, code, token, refresh, revoke",
    async () => {
      const as = { session: owner.session };
      const redirect = "http://localhost:3000/callback";
      await must("PATCH", `/applications/${bot._id}/oauth`, {
        ...as,
        body: { redirect_uris: [redirect] },
      });
      const verifier = randomBytes(32).toString("base64url");
      const challenge = createHash("sha256")
        .update(verifier)
        .digest("base64url");
      const approved = await must("POST", "/oauth2/authorize", {
        ...as,
        body: {
          client_id: bot._id,
          redirect_uri: redirect,
          response_type: "code",
          scope: "identify servers.read",
          state: "docs",
          code_challenge: challenge,
          code_challenge_method: "S256",
          approve: true,
        },
      });
      const back = new URL(approved.redirect);
      expect(back.searchParams.get("state") === "docs", "state comes back");
      const form = async (path, fields) => {
        const r = await fetch(API + path, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(fields),
        });
        const text = await r.text();
        return { status: r.status, data: text ? JSON.parse(text) : null };
      };
      const bad = await form("/oauth2/token", {
        grant_type: "authorization_code",
        client_id: bot._id,
        code: back.searchParams.get("code"),
        redirect_uri: redirect,
        code_verifier: "wrong".repeat(10),
      });
      expect(
        bad.data?.error === "invalid_grant",
        `wrong verifier: ${JSON.stringify(bad.data)}`,
      );

      // a code works once, also after a failure: ask again
      const again = await must("POST", "/oauth2/authorize", {
        ...as,
        body: {
          client_id: bot._id,
          redirect_uri: redirect,
          response_type: "code",
          scope: "identify servers.read",
          state: "docs",
          code_challenge: challenge,
          code_challenge_method: "S256",
          approve: true,
        },
      });
      const tokens = await form("/oauth2/token", {
        grant_type: "authorization_code",
        client_id: bot._id,
        code: new URL(again.redirect).searchParams.get("code"),
        redirect_uri: redirect,
        code_verifier: verifier,
      });
      expect(
        tokens.data?.access_token,
        `token: ${JSON.stringify(tokens.data?.error)}`,
      );
      const bearer = { Authorization: `Bearer ${tokens.data.access_token}` };
      const me = await must("GET", "/oauth2/@me", { headers: bearer });
      const servers = await must("GET", "/oauth2/@me/servers", {
        headers: bearer,
      });
      const renewed = await form("/oauth2/token", {
        grant_type: "refresh_token",
        client_id: bot._id,
        refresh_token: tokens.data.refresh_token,
      });
      const revoked = await form("/oauth2/revoke", {
        client_id: bot._id,
        token: renewed.data.refresh_token,
      });
      return `@me ${!!me.username}, servers ${Array.isArray(servers) ? servers.length : "?"}, refresh ${renewed.status}, revoke ${revoked.status}`;
    },
  );

  await check("verification: the page's body", async () => {
    const as = { session: owner.session };
    const short = await http("POST", `/bots/${bot._id}/verification`, {
      ...as,
      body: { statement: "Too short" },
    });
    const body = {
      statement: "Keeps notes and warnings for one gaming community.",
      website: "https://example.com/bot",
      support: "https://example.com/help",
      privacy_policy_url: "https://example.com/privacy",
      terms_of_service_url: "https://example.com/terms",
      intents: 0,
    };
    const sent = await http("POST", `/bots/${bot._id}/verification`, {
      ...as,
      body,
    });
    const state = await must("GET", `/bots/${bot._id}/verification`, as);
    return `short ${short.status} ${short.data?.type}; sent ${sent.status} ${sent.data?.type ?? ""}; status ${state.request?.status}`;
  });

  await check("a button in a direct message with the bot", async () => {
    const socket = gateway(tutorialToken);
    await socket.opened;
    const dm = await must("GET", `/users/${member.id}/dm`, bot_);
    const posted = await must("POST", `/channels/${dm._id}/messages`, {
      ...bot_,
      body: {
        content: "Press",
        components: [
          {
            type: "ActionRow",
            components: [
              {
                type: "Button",
                style: "Primary",
                label: "Go",
                custom_id: "dm:go",
              },
            ],
          },
        ],
      },
    });
    const click = await http("POST", "/interactions", {
      session: member.session,
      body: {
        type: "Component",
        application_id: bot._id,
        channel_id: dm._id,
        message_id: posted._id,
        custom_id: "dm:go",
        nonce: randomUUID(),
      },
    });
    const { interaction } = await socket.wait(
      (e) => e.type === "InteractionCreate",
    );
    socket.close();
    return `click ${click.status}, server_id ${interaction.server_id ?? "absent"}, member ${interaction.member ? "present" : "absent"}`;
  });

  await check("a command in a direct message is refused", async () => {
    const dm = await must("GET", `/users/${owner.id}/dm`, {
      session: member.session,
    }).catch(() => null);
    const channel = (await must("GET", `/users/${member.id}/dm`, bot_))._id;
    const used = await http("POST", "/interactions", {
      session: member.session,
      body: {
        type: "Command",
        application_id: bot._id,
        channel_id: channel,
        command_id: (await commands()).find((c) => c.name === "both")._id,
        nonce: randomUUID(),
        options: [],
      },
    });
    return `${used.status} ${used.data?.type} ${dm ? "" : ""}`;
  });

  await check("HTTP interactions on this stack", async () => {
    const ticket = await must("PUT", "/auth/mfa/ticket", {
      session: owner.session,
      body: { password: owner.password },
    });
    const secret = await http("POST", `/bots/${bot._id}/interactions/secret`, {
      session: owner.session,
      headers: { "x-mfa-ticket": ticket.token },
    });
    return `make a secret: ${secret.status} ${secret.data?.type ?? "ok"} ${secret.data?.feature ?? ""}`;
  });

  await check("the server's public addresses", async () => {
    const root = await must("GET", "/", {});
    const openapi = await http("GET", "/openapi.json");
    const schema = await http("GET", "/gateway/schema");
    expect(openapi.status === 200 && schema.status === 200, "documents answer");
    return `limits present: ${!!root.features.limits}`;
  });
}

/* What the rate limiter really answers */
async function rateLimits() {
  for (let i = 0; i < 60; i++) {
    const r = await http("GET", "/users/@me", { bot: tutorialToken });
    if (r.status === 429) {
      console.log(
        "  route 429",
        JSON.stringify(r.data),
        Object.fromEntries(
          [...r.headers].filter(([k]) => /rate|retry/i.test(k)),
        ),
      );
      break;
    }
  }
  await sleep(11_000);
  const burst = await Promise.all(
    // 69 requests over buckets with room for all of them
    [
      ...Array(20).fill("/users/@me"),
      ...Array(15).fill(`/channels/${text._id}`),
      ...Array(15).fill(`/channels/${voice._id}`),
      ...Array(19).fill(`/applications/${bot._id}/commands`),
    ].map((path) => http("GET", path, { bot: tutorialToken })),
  );
  const global = burst.find((r) => r.status === 429 && r.data?.global);
  console.log(
    "  global 429",
    global ? JSON.stringify(global.data) : "not reached",
    global
      ? Object.fromEntries(
          [...global.headers].filter(([k]) => /rate|retry/i.test(k)),
        )
      : "",
  );
  await sleep(1500);
}

let failed = false;
try {
  await setup();
  await fullBot();
  await clearCommands();
  await others();
  if (!ONLY) {
    await clearCommands();
    await collectSamples();
    await pageChecks();
    await clearCommands();
    await rateLimits();
  }
} catch (error) {
  failed = true;
  console.error("stopped:", error.message);
} finally {
  for (const step of cleanup.reverse())
    await Promise.resolve()
      .then(step)
      .catch((error) => console.error("cleanup:", error.message));
  for (const person of people)
    await http("POST", "/auth/session/logout", { session: person.session });
  writeFileSync(verificationFile, JSON.stringify(verification, null, 1) + "\n");
}

const bad = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - bad} passed, ${bad} failed`);
process.exit(bad || failed ? 1 : 0);
