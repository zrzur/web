// Every part of the SDK's bot client against a real server, through the client
// itself: messages (send with embed, components, reply, silent, file; fetch,
// history, edit, react, pin, delete, bulk delete), members, roles, channels,
// invites, users and DMs, servers, emoji, webhooks (with their own token), slash
// commands one by one and in sync, status, typing, voice, and the gateway events
// a bot listens to. No browser, so no language or size.
// Seeded accounts 1 (owner) and 2 (member); own server, deleted at the end; the
// shared test bot gets a role with the permissions it needs.
import {
  API,
  botSdk,
  call,
  checks,
  closeSessions,
  deleteServer,
  seededAccounts,
  session,
  sleep,
  WS,
} from "./lib/stack.mjs";

const { Client, EmbedBuilder, ButtonBuilder, ButtonStyle, Permissions, SlashCommandBuilder, ApiError } = await botSdk();
const { record, finish } = checks("bot-surface-e2e");
const [ownerAccount, memberAccount] = seededAccounts(2);
const acc = { a: ownerAccount, b: memberAccount };
/** Run one library call; a thrown API error is a FAIL with its type */
async function step(area, name, fn, check = () => true) {
  try {
    const value = await fn();
    const ok = await check(value);
    record(area, name, ok, ok === true ? "" : JSON.stringify(value)?.slice(0, 160));
    return value;
  } catch (error) {
    record(area, name, false, error instanceof ApiError ? `${error.status} ${error.type}${error.detail ? " " + error.detail : ""}` : String(error?.message ?? error));
    return undefined;
  }
}
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

const A = await session(acc.a);
const B = await session(acc.b);
const A_ID = (await call("GET", "/users/@me", undefined, A)).json._id;
const B_ID = (await call("GET", "/users/@me", undefined, B)).json._id;
const { server } = (await call("POST", "/servers/create", { name: "Bot surface" }, A)).json;
const S = server._id, CH = server.channels[0];
let code = (await call("POST", `/channels/${CH}/invites`, undefined, A)).json._id;
await call("POST", `/invites/${code}`, undefined, B);
const { testBot, addTestBot } = await import("./lib/test-bot.mjs");
const made = await testBot();
await addTestBot(made, S, A);
// the bot's role: everything it needs here
const all = Object.values(Permissions).reduce((sum, bit) => sum + bit, 0);
const botRole = (await call("POST", `/servers/${S}/roles`, { name: "Bot", rank: 1 }, A)).json.id;
await call("PUT", `/servers/${S}/permissions/${botRole}`, { permissions: { allow: all, deny: 0 } }, A);
await call("PATCH", `/servers/${S}/members/${made.id}`, { roles: [botRole] }, A);

const bot = new Client({ token: made.token, apiUrl: API, wsUrl: WS, onError: (e) => record("bot", "handler error", false, e?.message) });
const events = [];
bot.onMessage((m) => events.push({ type: "message", author: m.author, content: m.content }));
bot.onReaction((e) => events.push({ type: "react", ...e }));
bot.onMemberJoin((e) => events.push({ type: "join", ...e }));
bot.onMemberLeave((e) => events.push({ type: "leave", ...e }));
bot.on("MessageUpdate", (p) => events.push({ type: "update", id: p.id }));
bot.on("MessageDelete", (p) => events.push({ type: "delete", id: p.id }));
const waitEvent = async (pred, ms = 8000) => {
  for (let t = 0; t < ms / 150; t++) {
    const hit = events.find(pred);
    if (hit) return hit;
    await sleep(150);
  }
  return undefined;
};

try {
  await step("gateway", "login and ready", () => bot.login(), (b) => !!b.user?._id);

  // --- messages
  const M = "messages";
  const rich = await step(M, "send text + embed + buttons + menu", () =>
    bot.messages.send(CH, {
      content: "**Surface test** · العربية ✓",
      embeds: [new EmbedBuilder().title("EmbedBuilder").description("With a field").field("Field", "Value", true).colour("#E0195F")],
      components: [
        new ButtonBuilder().setCustomId("ok").setLabel("OK").setStyle(ButtonStyle.Primary),
        { type: "select", customId: "pick", options: [{ label: "A", value: "a" }, { label: "B", value: "b" }] },
      ],
    }), (m) => m?._id && m.embeds?.length === 1 && m.components?.length === 2);
  const plain = await step(M, "send plain text", () => bot.messages.send(CH, "plain"), (m) => m?.content === "plain");
  await step(M, "reply without a ping", () => bot.messages.reply(plain, "a reply"), (m) => m?.replies?.[0] === plain?._id);
  await step(M, "send silent", () => bot.messages.send(CH, { content: "quiet", silent: true }), (m) => !!m?._id);
  await step(M, "send with a file", () => bot.messages.send(CH, { content: "file", files: [{ name: "dot.png", data: PNG, type: "image/png" }] }), (m) => m?.attachments?.length === 1);
  await step(M, "fetch one", () => bot.messages.fetch(CH, plain._id), (m) => m?._id === plain._id);
  await step(M, "fetch history (latest first)", () => bot.messages.fetchMany(CH, { limit: 3 }), (list) => Array.isArray(list) && list.length === 3);
  await step(M, "edit", () => bot.messages.edit(CH, plain._id, { content: "plain (edited)", embeds: [new EmbedBuilder().title("Added")] }), (m) => m?.content === "plain (edited)" && m?.edited);
  await step("events", "MessageUpdate reaches the bot", () => waitEvent((e) => e.type === "update" && e.id === plain._id), Boolean);
  await step(M, "react", () => bot.messages.react(CH, plain._id, "🎮"));
  await step(M, "remove own reaction", () => bot.messages.unreact(CH, plain._id, "🎮"));
  await call("PUT", `/channels/${CH}/messages/${plain._id}/reactions/${encodeURIComponent("👍")}`, undefined, B);
  await step("events", "someone's reaction reaches the bot", () => waitEvent((e) => e.type === "react" && e.userId === B_ID), Boolean);
  await step(M, "remove someone's reaction", () => bot.messages.unreact(CH, plain._id, "👍", B_ID));
  await step(M, "clear reactions", () => bot.messages.clearReactions(CH, plain._id));
  await step(M, "pin", () => bot.messages.pin(CH, plain._id));
  // bots have no message search (people do)
  const search = await bot.rest.request("POST", `/channels/${CH}/search`, { query: "plain" }).catch((e) => e);
  record(M, "search is for people, not bots", search instanceof ApiError && search.type === "IsBot", search?.type ?? "allowed");
  await step(M, "unpin", () => bot.messages.unpin(CH, plain._id));
  const fromA = (await call("POST", `/channels/${CH}/messages`, { content: "hello from a" }, A)).json;
  await step("events", "a person's message reaches onMessage", () => waitEvent((e) => e.type === "message" && e.content === "hello from a" && e.author === A_ID), Boolean);
  await step(M, "delete someone's message (Manage Messages)", () => bot.messages.delete(CH, fromA._id));
  await step("events", "MessageDelete reaches the bot", () => waitEvent((e) => e.type === "delete" && e.id === fromA._id), Boolean);
  const junk = [];
  for (const n of [1, 2, 3]) junk.push((await bot.messages.send(CH, `junk ${n}`))._id);
  await step(M, "bulk delete", () => bot.messages.bulkDelete(CH, junk));
  await step(M, "deleted messages are gone", () => bot.messages.fetch(CH, junk[0]).then(() => false, (e) => e.status === 404));

  // --- channels, permissions, invites
  const C = "channels";
  const voice = await step(C, "create a voice channel", () => bot.channels.create(S, { name: "match-voice", type: "Voice" }), (c) => !!c?._id);
  const text = await step(C, "create a text channel", () => bot.channels.create(S, { name: "bot-made", description: "made by the bot" }), (c) => c?.name === "bot-made");
  await step(C, "fetch", () => bot.channels.fetch(text._id), (c) => c?._id === text._id);
  await step(C, "edit", () => bot.channels.edit(text._id, { name: "bot-edited", nsfw: false }), (c) => c?.name === "bot-edited");
  await step(C, "hide from everyone (default permissions)", () => bot.channels.setPermissions(text._id, "default", 0, Permissions.ViewChannel));
  await step(C, "create an invite", () => bot.channels.createInvite(CH), (i) => typeof i?._id === "string");

  // --- roles
  const R = "roles";
  const role = await step(R, "create", () => bot.roles.create(S, "Helpers"), (r) => !!(r?.id ?? r?._id));
  const roleId = role?.id ?? role?._id;
  await step(R, "edit name and colour", () => bot.roles.edit(S, roleId, { name: "Helpers ✓", colour: "#55DCC8", hoist: true }), (r) => r?.name === "Helpers ✓");
  await step(R, "set permissions", () => bot.roles.setPermissions(S, roleId, Permissions.SendMessage | Permissions.React));
  await step(C, "role permissions on a channel", () => bot.channels.setPermissions(text._id, roleId, Permissions.ViewChannel, 0));

  // --- members
  const MB = "members";
  await step(MB, "fetch one", () => bot.members.fetch(S, B_ID), (m) => m?._id?.user === B_ID);
  await step(MB, "fetch all", () => bot.members.fetchAll(S), (list) => (list?.members ?? list)?.length >= 3);
  await step(MB, "nickname", () => bot.members.edit(S, B_ID, { nickname: "Falcon" }), (m) => m?.nickname === "Falcon");
  await step(MB, "add role", () => bot.members.addRole(S, B_ID, roleId), (m) => m?.roles?.includes(roleId));
  await step(MB, "remove role", () => bot.members.removeRole(S, B_ID, roleId), (m) => !m?.roles?.includes(roleId));
  await step(MB, "time out 60 s", () => bot.members.timeout(S, B_ID, 60), (m) => !!m?.timeout);
  await step(MB, "end the time-out", () => bot.members.timeout(S, B_ID, 0), (m) => !m?.timeout);
  await step(MB, "kick", () => bot.members.kick(S, B_ID));
  await step("events", "the leave reaches the bot", () => waitEvent((e) => e.type === "leave" && e.userId === B_ID), Boolean);
  await call("POST", `/invites/${code}`, undefined, B);
  await step("events", "a join reaches the bot", () => waitEvent((e) => e.type === "join" && e.userId === B_ID), Boolean);
  await step(MB, "ban", () => bot.members.ban(S, B_ID, { reason: "test" }));
  const banned = await call("POST", `/invites/${code}`, undefined, B);
  record(MB, "a banned person can't rejoin", banned.status >= 400, banned.status);
  await step(MB, "unban", () => bot.members.unban(S, B_ID));
  const rejoin = await call("POST", `/invites/${code}`, undefined, B);
  record(MB, "after unban they can rejoin", rejoin.status === 200, rejoin.status);

  // --- users, DMs, server
  const U = "users";
  await step(U, "fetch a user", () => bot.users.fetch(A_ID), (u) => u?._id === A_ID);
  await step(U, "open a DM", () => bot.users.openDM(A_ID), (c) => c?.channel_type === "DirectMessage");
  await step(U, "send a DM", () => bot.users.sendDM(A_ID, "hi from the bot"), (m) => m?.content === "hi from the bot");
  await step("servers", "fetch the server", () => bot.servers.fetch(S), (s) => s?._id === S);
  await step("status", "set a status", () => bot.setStatus("Playing tests"), (u) => u?.status?.text === "Playing tests");
  await step("status", "clear it", () => bot.setStatus(null), (u) => !u?.status?.text);
  await step("status", "typing", () => bot.typing(CH));

  // --- emoji
  const E = "emoji";
  const emoji = await step(E, "upload a server emoji", () => bot.emojis.create(S, "zrzur_test", PNG), (e) => e?.name === "zrzur_test");
  await step(E, "list", () => bot.emojis.list(S), (list) => list?.some((e) => e._id === emoji?._id));
  await step(E, "find by name", () => bot.emojis.find(S, "zrzur_test"), (e) => e?._id === emoji?._id);
  await step(M, "react with the custom emoji", () => bot.messages.react(CH, rich._id, emoji._id));
  await step(E, "delete", () => bot.emojis.delete(emoji._id));

  // --- webhooks
  const W = "webhooks";
  const hook = await step(W, "create", () => bot.webhooks.create(CH, { name: "Scores" }), (w) => !!w?.id && !!w?.token);
  await step(W, "list", () => bot.webhooks.list(CH), (list) => list?.some((w) => w.id === hook?.id));
  await step(W, "fetch", () => bot.webhooks.fetch(hook.id), (w) => w?.id === hook.id);
  await step(W, "rename", () => bot.webhooks.edit(hook.id, { name: "Live scores" }), (w) => w?.name === "Live scores");
  const posted = await step(W, "post with embed and a link button", () =>
    bot.webhooks.send(hook, { content: "via webhook", embeds: [new EmbedBuilder().title("Score").description("2 : 1")], components: [new ButtonBuilder().setLabel("Match page").setURL("https://zrzur.com").setStyle(ButtonStyle.Link)] }),
    (m) => m?.webhook?.name === "Live scores" && m?.embeds?.length === 1);
  await step(W, "edit the webhook's message", () => bot.webhooks.editMessage(hook, posted._id, { content: "via webhook (edited)" }), (m) => m?.content === "via webhook (edited)");
  await step(W, "delete the webhook's message", () => bot.webhooks.deleteMessage(hook, posted._id));
  const wrong = await bot.webhooks.send({ id: hook.id, token: "wrong-token" }, "x").catch((e) => e);
  record(W, "a wrong token is refused and never printed", wrong instanceof ApiError && wrong.status === 401 || wrong.status === 404 || wrong.status === 403 ? !wrong.message.includes("wrong-token") : false, wrong?.message);
  await step(W, "delete", () => bot.webhooks.delete(hook.id));

  // --- commands
  const K = "commands";
  const cmd = await step(K, "create one (server)", () => bot.createCommand(new SlashCommandBuilder("score", "Show the score"), { serverId: S }), (c) => c?.name === "score");
  await step(K, "fetch one", () => bot.fetchCommand(cmd._id, { serverId: S }), (c) => c?._id === cmd._id);
  await step(K, "edit (id stays)", () => bot.editCommand(cmd._id, { description: "Show the live score" }, { serverId: S }), (c) => c?._id === cmd._id && c?.description === "Show the live score");
  await step(K, "list", () => bot.fetchCommands({ serverId: S }), (list) => list?.some((c) => c._id === cmd._id));
  await step(K, "delete one", () => bot.deleteCommand(cmd._id, { serverId: S }));
  await step(K, "sync a set", () => bot.syncCommands([new SlashCommandBuilder("a", "First"), new SlashCommandBuilder("b", "Second")], { serverId: S }), (list) => list?.length === 2);
  await step(K, "sync to empty", () => bot.syncCommands([], { serverId: S }), (list) => list?.length === 0);
  const listed = await call("GET", `/servers/${S}/commands`, undefined, A);
  record(K, "members see the server's command list", listed.status === 200, listed.status);

  // --- voice (needs LiveKit on this stack)
  const nodes = await step("voice", "voice nodes", () => bot.voice.nodes(), Array.isArray);
  if (nodes?.length) await step("voice", "join ticket", () => bot.voice.join(voice._id), (t) => !!t?.token);
  else record("voice", "join ticket", true, "NOT TESTED: voice is off on this stack");

  // --- cleanup through the library
  await step(C, "delete a channel", () => bot.channels.delete(text._id));
  await step(R, "delete a role", () => bot.roles.delete(S, roleId));
} finally {
  bot.destroy();
  await deleteServer(S, acc.a, A);
  await closeSessions();
  finish();
}
