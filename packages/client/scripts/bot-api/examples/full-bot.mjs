// A complete Zrzur bot in one file: Node 22 or newer, nothing to install.
// Slash commands, buttons, a form, moderation, saved data, error handling
// and reconnects.
//
//   ZRZUR_BOT_TOKEN=YOUR_BOT_TOKEN node full-bot.mjs

import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";

const TOKEN = process.env.ZRZUR_BOT_TOKEN;
const API = process.env.ZRZUR_API_URL ?? "https://api.zrzur.com";
const GATEWAY = process.env.ZRZUR_WS_URL ?? "wss://ws.zrzur.com";
const DATA_FILE = process.env.DATA_FILE ?? "bot-data.json";
const TEST_SERVER = process.env.ZRZUR_TEST_SERVER; // optional, see register()

if (!TOKEN) {
  console.error("Set ZRZUR_BOT_TOKEN first.");
  process.exit(2);
}

/* ---------- Logging: one line of JSON per event, never the token ---------- */

const log = (level, message, fields = {}) =>
  console.log(
    JSON.stringify({
      time: new Date().toISOString(),
      level,
      message,
      ...fields,
    }),
  );

/* ---------- Saved data: a JSON file, replaced in one step ---------- */

let data = { notes: {}, warnings: {} };
try {
  data = JSON.parse(readFileSync(DATA_FILE, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error; // a broken file must stop the bot
}

function save() {
  // write to a second file, then rename: a crash never leaves half a file
  writeFileSync(`${DATA_FILE}.tmp`, JSON.stringify(data, null, 2));
  renameSync(`${DATA_FILE}.tmp`, DATA_FILE);
}

/* ---------- REST: rate limits and retries in one place ---------- */

class ApiError extends Error {
  constructor(status, body) {
    super(`${status} ${body?.type ?? "error"}`);
    this.status = status;
    this.type = body?.type;
    this.body = body;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** An interaction's token is in its path: it must never reach a log */
const masked = (path) =>
  path.replace(/(\/interactions\/[^/]+\/)[^/]+/, "$1***");
let globalPauseUntil = 0; // after a global 429 no request goes out

async function rest(method, path, body, headers = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const pause = globalPauseUntil - Date.now();
    if (pause > 0) await sleep(pause);

    let response;
    try {
      response = await fetch(API + path, {
        method,
        headers: {
          "x-bot-token": TOKEN,
          ...(body ? { "content-type": "application/json" } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      log("warn", "network error", {
        method,
        path: masked(path),
        reason: error.message,
      });
      await sleep(2 ** attempt * 500);
      continue;
    }

    const text = await response.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // a proxy in front of the API can answer with an HTML page
    }
    if (response.ok) return parsed;

    // a 429 with a type (InSlowmode) is a refusal; without one, wait it out
    if (response.status === 429 && !parsed?.type) {
      const wait = parsed?.retry_after ?? 1000; // milliseconds
      if (parsed?.global) globalPauseUntil = Date.now() + wait;
      log("warn", "rate limited", {
        path: masked(path),
        wait,
        global: !!parsed?.global,
      });
      await sleep(wait);
      continue;
    }

    if (response.status >= 500) {
      await sleep(2 ** attempt * 500);
      continue;
    }
    throw new ApiError(response.status, parsed);
  }
  throw new Error(`${method} ${masked(path)}: gave up after 5 tries`);
}

/* ---------- Commands ---------- */

const COMMANDS = [
  {
    name: "ping",
    description: "Check that the bot is awake",
    description_localizations: {
      ar: "تحقق من أن البوت يعمل",
      de: "Prüfen, ob der Bot läuft",
    },
  },
  {
    name: "note",
    description: "Notes for this server",
    options: [
      { type: "SubCommand", name: "add", description: "Write a new note" },
      { type: "SubCommand", name: "list", description: "Read the notes" },
    ],
  },
  {
    name: "warn",
    description: "Warn a member",
    // TimeoutMembers (bit 8): hidden from everyone who does not have it
    default_member_permissions: 256,
    options: [
      { type: "User", name: "member", description: "Who", required: true },
      { type: "String", name: "reason", description: "Why", required: true },
    ],
  },
  {
    name: "timeout",
    description: "Silence a member for a while",
    default_member_permissions: 256,
    options: [
      { type: "User", name: "member", description: "Who", required: true },
      {
        type: "Integer",
        name: "minutes",
        description: "How long",
        required: true,
        min_value: 1,
        max_value: 10080,
      },
    ],
  },
];

async function register(me) {
  // Global commands reach every server. While you test, set ZRZUR_TEST_SERVER
  // to register in one server only. PUT replaces the whole list.
  const path = TEST_SERVER
    ? `/applications/${me._id}/servers/${TEST_SERVER}/commands`
    : `/applications/${me._id}/commands`;
  await rest("PUT", path, COMMANDS);
  log("info", "commands registered", { count: COMMANDS.length });
}

/* ---------- Answering interactions ---------- */

const answer = (interaction, type, extra = {}) =>
  rest(
    "POST",
    `/interactions/${interaction._id}/${interaction.token}/callback`,
    { type, ...extra },
  );

const reply = (interaction, content, ephemeral = true) =>
  answer(interaction, "Message", { data: { content, ephemeral } });

// always read the *_string fields: a JavaScript number cannot hold every bit
const hasBit = (permissions, bit) => (BigInt(permissions) >> BigInt(bit)) & 1n;
const TIMEOUT_MEMBERS = 8;

/** Whether the person who asked ranks above the target; a lower number is higher */
async function outranks(interaction, targetId) {
  const server = await rest("GET", `/servers/${interaction.server_id}`);
  if (interaction.user._id === server.owner) return true;
  if (targetId === server.owner) return false;
  const rank = (member) =>
    Math.min(
      Infinity,
      ...(member?.roles ?? []).map(
        (id) => server.roles?.[id]?.rank ?? Infinity,
      ),
    );
  const target = interaction.command.resolved?.members?.[targetId];
  return rank(interaction.member) < rank(target);
}

/** The chosen sub-command and the values of a command, flat */
function optionsOf(command) {
  const options = command.options ?? [];
  const sub = options.find((option) => option.type === "SubCommand");
  const values = Object.fromEntries(
    (sub?.options ?? options)
      .filter((option) => option.type !== "SubCommand")
      .map((option) => [option.name, option.value]),
  );
  return { sub: sub?.name, values };
}

const notesOf = (serverId) => (data.notes[serverId] ??= []);

/** One note with Older and Newer buttons */
function notePage(serverId, index) {
  const notes = notesOf(serverId);
  const note = notes[index];
  return {
    content: `**${note.title}** (${index + 1} of ${notes.length})\n${note.text}`,
    ephemeral: true,
    components: [
      {
        type: "ActionRow",
        components: [
          {
            type: "Button",
            style: "Secondary",
            label: "Older",
            custom_id: `note:${index - 1}`,
            disabled: index === 0,
          },
          {
            type: "Button",
            style: "Primary",
            label: "Newer",
            custom_id: `note:${index + 1}`,
            disabled: index === notes.length - 1,
          },
        ],
      },
    ],
  };
}

const NOTE_FORM = {
  custom_id: "note-form",
  title: "New note",
  components: [
    {
      type: "Field",
      label: "Title",
      component: {
        type: "TextInput",
        custom_id: "title",
        style: "Short",
        max_length: 80,
      },
    },
    {
      type: "Field",
      label: "Text",
      description: "Everyone in this server can read it.",
      component: {
        type: "TextInput",
        custom_id: "text",
        style: "Paragraph",
        max_length: 1000,
      },
    },
  ],
};

async function onCommand(interaction) {
  const { command, server_id: serverId } = interaction;
  const { sub, values } = optionsOf(command);

  if (command.name === "ping") return reply(interaction, "Pong!");

  if (command.name === "note" && sub === "add")
    return answer(interaction, "Modal", { modal: NOTE_FORM });

  if (command.name === "note" && sub === "list") {
    if (!notesOf(serverId).length)
      return reply(interaction, "No notes yet. Write one with `/note add`.");
    const last = notesOf(serverId).length - 1;
    return answer(interaction, "Message", { data: notePage(serverId, last) });
  }

  if (command.name === "warn") {
    const key = `${serverId}:${values.member}`;
    const list = (data.warnings[key] ??= []);
    list.push({
      reason: values.reason,
      by: interaction.user._id,
      at: Date.now(),
    });
    save();
    return reply(
      interaction,
      `<@${values.member}> now has ${list.length} warning(s).`,
    );
  }

  if (command.name === "timeout") {
    if (!hasBit(interaction.app_permissions_string, TIMEOUT_MEMBERS))
      return reply(interaction, "I need the Timeout Members permission.");

    // this may take a moment: show "thinking" first, then edit the answer
    await answer(interaction, "DeferredMessage", { data: { ephemeral: true } });
    const original = `/interactions/${interaction._id}/${interaction.token}/original`;
    if (!(await outranks(interaction, values.member)))
      return rest("PATCH", original, {
        content: "That member ranks at or above you.",
      });

    const until = new Date(Date.now() + values.minutes * 60_000).toISOString();
    const who = interaction.member?.nickname ?? interaction.user.username;
    await rest(
      "PATCH",
      `/servers/${serverId}/members/${values.member}`,
      { timeout: until },
      // URL-encoded: a header cannot carry Arabic as it is
      { "X-Audit-Log-Reason": encodeURIComponent(`Requested by ${who}`) },
    );
    return rest("PATCH", original, {
      content: `<@${values.member}> is silent for ${values.minutes} minute(s).`,
    });
  }
}

async function onComponent(interaction) {
  const [kind, value] = interaction.component.custom_id.split(":");
  if (kind === "note") {
    const page = notePage(interaction.server_id, Number(value));
    return answer(interaction, "UpdateMessage", { data: page });
  }
}

async function onModal(interaction) {
  if (interaction.modal.custom_id !== "note-form") return;
  const field = (id) =>
    interaction.modal.fields.find((f) => f.custom_id === id)?.value ?? "";
  notesOf(interaction.server_id).push({
    id: randomUUID(),
    title: field("title"),
    text: field("text"),
    by: interaction.user._id,
  });
  save();
  return reply(interaction, "Saved. Read it with `/note list`.");
}

/** Plain words for the person, the technical part for your log */
function explain(error) {
  if (error.type === "MissingPermission")
    return `I am missing a permission: ${error.body.permission}.`;
  if (error.type === "NotElevated") return "That member ranks at or above me.";
  if (error.type === "InvalidOperation")
    return "That member cannot be timed out.";
  return "Something went wrong. Please try again.";
}

async function onInteraction(interaction) {
  const started = Date.now();
  let acknowledged = false;
  try {
    if (interaction.type === "Command") {
      acknowledged = interaction.command.name === "timeout";
      await onCommand(interaction);
    }
    if (interaction.type === "Component") await onComponent(interaction);
    if (interaction.type === "ModalSubmit") await onModal(interaction);
    log("info", "interaction", {
      kind: interaction.type,
      name: interaction.command?.name,
      ms: Date.now() - started,
    });
  } catch (error) {
    log("error", "interaction failed", {
      type: error.type,
      reason: error.message,
    });
    const message = explain(error);
    // answered already? edit that answer; if not, answer now
    await (
      acknowledged
        ? rest(
            "PATCH",
            `/interactions/${interaction._id}/${interaction.token}/original`,
            { content: message },
          )
        : reply(interaction, message)
    ).catch((failed) =>
      log("error", "could not tell the user", { reason: failed.message }),
    );
  }
}

/* ---------- Gateway: stay connected ---------- */

const INTENTS = 1 + 32; // SERVERS + INTERACTIONS: nothing the bot does not use
let socket;
let failures = 0;
let stopping = false;

function connect() {
  socket = new WebSocket(`${GATEWAY}/?version=1&format=json`);
  let pingTimer;
  let lastPong = Date.now();

  socket.addEventListener("open", () => {
    socket.send(
      JSON.stringify({ type: "Authenticate", token: TOKEN, intents: INTENTS }),
    );
    pingTimer = setInterval(() => {
      // no Pong for a while: the line is dead even if nothing says so
      if (Date.now() - lastPong > 60_000) return socket.close();
      socket.send(JSON.stringify({ type: "Ping", data: Date.now() }));
    }, 20_000);
  });

  socket.addEventListener("message", ({ data: raw }) => {
    const packet = JSON.parse(raw);
    // several events can arrive in one Bulk packet
    for (const event of packet.type === "Bulk" ? packet.v : [packet]) {
      if (event.type === "Pong") lastPong = Date.now();
      if (event.type === "Ready") {
        failures = 0;
        log("info", "ready", { servers: event.servers?.length ?? 0 });
      }
      if (event.type === "Error" && event.data?.type === "InvalidSession") {
        log("error", "the token was refused, stopping");
        process.exit(1);
      }
      if (event.type === "InteractionCreate") onInteraction(event.interaction);
    }
  });

  socket.addEventListener("close", ({ code }) => {
    clearInterval(pingTimer);
    if (stopping) return;
    if (code === 4014) {
      log("error", "a privileged intent is off for this bot, stopping");
      process.exit(1);
    }
    // 1 s, 2 s, 4 s ... 30 s, with a little randomness
    const delay = Math.min(1000 * 2 ** failures, 30_000) + Math.random() * 500;
    failures += 1;
    log("warn", "disconnected", { code, retryIn: Math.round(delay) });
    setTimeout(connect, delay);
  });
}

function shutdown() {
  stopping = true;
  socket?.close();
  log("info", "stopped");
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

/* ---------- Start ---------- */

try {
  const me = await rest("GET", "/users/@me");
  await register(me);
  connect();
} catch (error) {
  log("error", "could not start", { type: error.type, reason: error.message });
  process.exit(1);
}
