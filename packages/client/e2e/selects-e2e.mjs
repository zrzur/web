// Select menus: all five kinds at their limits (25 options, 100-character
// texts, 150-character placeholder, up to 25 picks), what the server refuses,
// and how they work and look in the app (keyboard, search, pick limit, closing
// without confirming, disabled, restricted, phone).
// Seeded accounts 1 (owner) and 2 (member); own server, deleted at the end; the
// shared test bot. LOCALE=ar|en|de; both sizes run in one process.
import { randomUUID } from "node:crypto";

import {
  API,
  botSdk,
  call,
  checks,
  closeSessions,
  deleteServer,
  goTo,
  launch,
  LOCALE,
  seededAccounts,
  session,
  shots,
  signIn,
  sleep,
  VIEWPORTS,
  WS,
} from "./lib/stack.mjs";

const { Client } = await botSdk();
const tag = LOCALE;
const L = (en, arText) => (LOCALE.startsWith("ar") ? arText : en);
const shot = shots("selects-e2e");
const { record, finish } = checks("selects-e2e", tag);
/** a sentence cut to exactly n characters */
const exactly = (text, n) => [...text.repeat(Math.ceil(n / [...text].length))].slice(0, n).join("");
const [ownerAccount, memberAccount] = seededAccounts(2);
const acc = { a: ownerAccount, b: memberAccount };
let browser;

const A = await session(acc.a);
const B = await session(acc.b);
const meB = (await call("GET", "/users/@me", undefined, B)).json;
const B_ID = meB._id;
const { server } = (await call("POST", "/servers/create", { name: L("Select lab", "مختبر القوائم") }, A)).json;
const S = server._id, CH = server.channels[0];
const code = (await call("POST", `/channels/${CH}/invites`, undefined, A)).json._id;
await call("POST", `/invites/${code}`, undefined, B);
const roles = [];
for (const [name, colour] of [[L("Red team", "الفريق الأحمر"), "#F27488"], [L("Blue team", "الفريق الأزرق"), "#64A9FF"], [L("Referees", "الحكّام"), "#F3B96B"]]) {
  const made = (await call("POST", `/servers/${S}/roles`, { name }, A)).json;
  await call("PATCH", `/servers/${S}/roles/${made.id}`, { colour }, A);
  roles.push({ id: made.id, name });
}
const voice = (await call("POST", `/servers/${S}/channels`, { type: "Voice", name: L("match-voice", "صوت-المباراة") }, A)).json;
const { testBot, addTestBot } = await import("./lib/test-bot.mjs");
const botMade = await testBot();
await addTestBot(botMade, S, A);

// --- the bot
const seen = [];
const bot = new Client({ token: botMade.token, apiUrl: API, wsUrl: WS });
const maps = Array.from({ length: 25 }, (_, i) => ({
  label: i === 1 ? exactly(L("A very long map name that keeps going ", "اسم خريطة طويل جدًا يستمر بلا توقف "), 100) : L(`Map ${i}`, `خريطة ${i}`),
  value: `m${i}`,
  ...(i === 0 ? { description: exactly(L("Long corridors, sniper heaven, three bomb sites ", "ممرات طويلة وجنة القنّاصين وثلاثة مواقع "), 100) } : {}),
  ...(i % 5 === 0 ? { emoji: ["🏜️", "⚓", "🏔️", "🌋", "🏙️"][i / 5] } : {}),
}));
const weapons = [L("Rifle", "بندقية"), L("Shotgun", "بندقية صيد"), L("Sniper", "قنّاصة"), L("Pistol", "مسدس"), L("Knife", "سكين"), L("Grenade", "قنبلة")];
const menus = {
  maps: { content: L("**Map vote** · 25 maps", "**تصويت الخريطة** · ٢٥ خريطة"), components: [
    { type: "select", customId: "maps", placeholder: L("Pick a map", "اختر خريطة"), options: maps },
  ] },
  team: { content: L("**Team setup**", "**إعداد الفريق**"), components: [
    { type: "select", customId: "loadout", placeholder: L("Choose up to 3 weapons", "اختر حتى ٣ أسلحة"), minValues: 1, maxValues: 3,
      options: weapons.map((label, i) => ({ label, value: `w${i}`, default: i === 0 })) },
    { type: "userSelect", customId: "captain", placeholder: L("Choose captains", "اختر القادة"), maxValues: 2 },
    { type: "roleSelect", customId: "teams", placeholder: L("Teams that can join", "الفرق التي يمكنها الانضمام"), minValues: 0, maxValues: 3 },
    { type: "channelSelect", customId: "voice", placeholder: L("Voice channel for the match", "القناة الصوتية للمباراة"), channelTypes: ["Voice"] },
    { type: "mentionableSelect", customId: "ping", placeholder: L("Who should we ping?", "من ننبّه؟"), maxValues: 5 },
  ] },
  locked: { content: L("**Closed menus**", "**قوائم مغلقة**"), components: [
    { type: "select", customId: "off", disabled: true, placeholder: exactly(L("Voting has closed for this round, results come at nine ", "انتهى التصويت في هذه الجولة والنتائج تصل عند التاسعة "), 150), options: maps.slice(0, 3) },
    { type: "select", customId: "only-b", placeholder: L("Referee only", "للحكم فقط"), restrict: { users: [B_ID] }, options: maps.slice(0, 3) },
  ] },
};
for (const id of ["maps", "loadout", "captain", "teams", "voice", "ping", "only-b"]) {
  bot.component(id, (i) => {
    seen.push({ id, user: i.user._id, values: i.values, resolved: i.resolved });
    return i.reply({ content: `picked ${id}: ${i.values.join(",") || "-"}`, ephemeral: true });
  });
}
await bot.login();
await sleep(1500);
const posted = {};
for (const [key, body] of Object.entries(menus)) posted[key] = (await bot.send(CH, body))._id;
const lastSeen = async (id, count) => {
  for (let i = 0; i < 40 && seen.filter((s) => s.id === id).length < count; i++) await sleep(250);
  return seen.filter((s) => s.id === id)[count - 1];
};

const pick = (headers, message, custom_id, values) =>
  call("POST", "/interactions", { type: "Component", channel_id: CH, message_id: message, custom_id, values, nonce: randomUUID() }, headers);
const botPost = (components) =>
  call("POST", `/channels/${CH}/messages`, { components }, { "x-bot-token": botMade.token });
const row = (component) => [{ type: "ActionRow", components: [component] }];
const ULID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

try {
  // --- limits the server keeps (bot side)
  const opts = (n) => Array.from({ length: n }, (_, i) => ({ label: `o${i}`, value: `v${i}` }));
  record("server", "25 options with 100-character texts accepted", !!posted.maps);
  for (const [name, components] of [
    ["26 options refused", row({ type: "StringSelect", custom_id: "x", options: opts(26) })],
    ["101-character label refused", row({ type: "StringSelect", custom_id: "x", options: [{ label: "x".repeat(101), value: "v" }] })],
    ["151-character placeholder refused", row({ type: "StringSelect", custom_id: "x", placeholder: "x".repeat(151), options: opts(1) })],
    ["label with a line break refused", row({ type: "StringSelect", custom_id: "x", options: [{ label: "two\nlines", value: "v" }] })],
    ["max_values 26 refused", row({ type: "UserSelect", custom_id: "x", max_values: 26 })],
    ["the same default twice refused", row({ type: "UserSelect", custom_id: "x", max_values: 2, default_values: [B_ID, B_ID] })],
    ["two options with one value refused", row({ type: "StringSelect", custom_id: "x", options: [{ label: "a", value: "v" }, { label: "b", value: "v" }] })],
    ["empty channel_types refused", row({ type: "ChannelSelect", custom_id: "x", channel_types: [] })],
    ["two menus in one row refused", [{ type: "ActionRow", components: [
      { type: "StringSelect", custom_id: "x", options: opts(1) }, { type: "StringSelect", custom_id: "y", options: opts(1) }] }]],
    ["six rows refused", Array.from({ length: 6 }, (_, i) => ({ type: "ActionRow", components: [{ type: "StringSelect", custom_id: `s${i}`, options: opts(1) }] }))],
  ]) {
    const r = await botPost(components);
    record("server", name, r.status === 400, r.status);
  }

  // --- what a forged click could try (user side)
  for (const [name, custom_id, values, message] of [
    ["a map that isn't an option", "maps", ["m99"], posted.maps],
    ["two maps on a single-choice menu", "maps", ["m1", "m2"], posted.maps],
    ["four weapons when 3 is the limit", "loadout", ["w0", "w1", "w2", "w3"], posted.team],
    ["no weapon when 1 is required", "loadout", [], posted.team],
    ["someone who isn't a member", "captain", [ULID], posted.team],
    ["a role id as a captain", "captain", [roles[0].id], posted.team],
    ["a text channel in a voice-only menu", "voice", [CH], posted.team],
    ["the disabled menu", "off", ["m0"], posted.locked],
    ["the menu meant for B, as A", "only-b", ["m0"], posted.locked],
  ]) {
    const r = await pick(A, message, custom_id, values);
    record("server", `refused: ${name}`, r.status >= 400 && r.status < 500, r.status);
  }
  const okB = await pick(B, posted.locked, "only-b", ["m1"]);
  record("server", "the menu meant for B works for B", okB.status === 200 && (await lastSeen("only-b", 1))?.user === B_ID, okB.status);

  // --- in the app
  browser = await launch();
  for (const [label, size] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({ viewport: size, locale: LOCALE, colorScheme: "dark" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
    await signIn(page, acc.a);
    await goTo(page, `/server/${S}/channel/${CH}`, 4500);
    const main = page.locator("main");
    const snap = async (name) => { await page.waitForTimeout(400); return page.screenshot({ path: shot(`${tag}-${label}-${name}`) }); };
    const trigger = (text) => main.locator('button[aria-haspopup="listbox"]', { hasText: text }).first();
    const list = page.locator('[role="listbox"]').first();
    const answered = async (text) => {
      for (let i = 0; i < 40; i++) {
        if ((await main.innerText()).includes(text)) return true;
        await sleep(250);
      }
      return false;
    };
    const area = `app ${label}`;
    let closeFails = 0;
    const closeList = async () => {
      await page.keyboard.press("Escape");
      const closed = await page.locator("[role=listbox]").first().waitFor({ state: "detached", timeout: 3000 }).then(() => true, () => false);
      if (!closed) closeFails += 1;
    };

    await main.getByText(/Map vote|تصويت الخريطة/).first().scrollIntoViewIfNeeded();
    await snap("1-overview");

    // 25 maps: the keys move through the whole list and keep the choice in view
    await trigger(L("Pick a map", "اختر خريطة")).click();
    await list.waitFor({ timeout: 5000 });
    const count = await list.locator('[role="option"]').count();
    record(area, "the open list shows all 25 maps", count === 25, count);
    const searchShown = await page.locator('#floating input[type="search"]').first().isVisible().catch(() => false);
    record(area, "a list this long gets a search field", searchShown);
    await snap("2-maps-open");
    for (let i = 0; i < 24; i++) await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(300);
    const inView = await page.evaluate(() => {
      const box = document.querySelector('[role="listbox"]').getBoundingClientRect();
      const last = [...document.querySelectorAll('[role="option"]')].at(-1).getBoundingClientRect();
      return last.top >= box.top - 1 && last.bottom <= box.bottom + 1;
    });
    record(area, "arrow keys scroll the highlighted map into view", inView);
    await snap("3-maps-keyboard-end");
    await page.keyboard.press("Enter");
    record(area, "Enter picks the highlighted map and the bot gets it", (await answered("picked maps: m24")) && (await lastSeen("maps", label === "desktop" ? 1 : 2))?.values?.[0] === "m24");

    // search
    await trigger(/Map 24|خريطة 24/).click();
    await list.waitFor({ timeout: 5000 });
    await page.locator('#floating input[type="search"]').first().fill("7");
    await page.waitForTimeout(300);
    const found = await list.locator('[role="option"]').allInnerTexts();
    record(area, "search narrows the list", found.length === 2, found.join(" | "));
    await closeList();

    // pick limit, closing without confirming, confirming
    const loadout = trigger(L("Rifle", "بندقية"));
    await loadout.scrollIntoViewIfNeeded();
    await loadout.click();
    await list.waitFor({ timeout: 5000 });
    await list.getByRole("option", { name: weapons[2] }).click();
    await list.getByRole("option", { name: weapons[3] }).click();
    const limited = await list.getByRole("option", { name: weapons[4] }).getAttribute("aria-disabled");
    const footer = await page.locator('[role="listbox"] + div').first().innerText().catch(() => "");
    record(area, "at 3 of 3 the other weapons wait", limited === "true", `${limited} ${footer}`);
    await snap("4-loadout-limit");
    await closeList();
    await page.waitForTimeout(300);
    const after = await loadout.innerText().catch(async () => main.locator('button[aria-haspopup="listbox"]').nth(1).innerText());
    record(area, "closing without confirming goes back to what was sent", after.trim() === weapons[0], after);
    await trigger(weapons[0]).click();
    await list.waitFor({ timeout: 5000 });
    await list.getByRole("option", { name: weapons[1] }).click();
    await list.getByRole("option", { name: weapons[5] }).click();
    await page.locator('[role="listbox"]').locator("xpath=..").getByRole("button").last().click();
    const sent = await lastSeen("loadout", label === "desktop" ? 1 : 2);
    record(area, "Confirm sends all three weapons", JSON.stringify(sent?.values) === JSON.stringify(["w0", "w1", "w5"]), JSON.stringify(sent?.values));

    // people, roles, channels
    const captains = trigger(L("Choose captains", "اختر القادة"));
    await captains.scrollIntoViewIfNeeded();
    await captains.click();
    await list.waitFor({ timeout: 5000 });
    const people = await list.locator('[role="option"]').allInnerTexts();
    record(area, "the captain list shows the server's members", people.some((p) => p.includes(meB.username)), people.join(" | "));
    await snap("5-captains-open");
    await list.locator('[role="option"]', { hasText: meB.username }).first().click();
    await page.locator('[role="listbox"]').locator("xpath=..").getByRole("button").last().click();
    const captain = await lastSeen("captain", label === "desktop" ? 1 : 2);
    record(area, "the bot gets the captain with the member's details", !!captain?.resolved?.users?.[B_ID] && !!captain?.resolved?.members?.[B_ID]);

    await trigger(L("Teams that can join", "الفرق التي يمكنها الانضمام")).click();
    await list.waitFor({ timeout: 5000 });
    const teamNames = await list.locator('[role="option"]').allInnerTexts();
    record(area, "the team list shows the server's roles", roles.every((r) => teamNames.some((t) => t.includes(r.name))), teamNames.join(" | "));
    await snap("6-teams-open");
    await closeList();

    await trigger(L("Voice channel for the match", "القناة الصوتية للمباراة")).click();
    await list.waitFor({ timeout: 5000 });
    const rooms = await list.locator('[role="option"]').allInnerTexts();
    record(area, "a voice-only menu lists voice channels only", rooms.length === 1 && rooms[0].includes(voice.name), rooms.join(" | "));
    await list.locator('[role="option"]').first().click();
    record(area, "the bot gets the voice channel", (await lastSeen("voice", label === "desktop" ? 1 : 2))?.values?.[0] === voice._id);

    await trigger(L("Who should we ping?", "من ننبّه؟")).click();
    await list.waitFor({ timeout: 5000 });
    const mentionable = await list.locator('[role="option"]').allInnerTexts();
    record(area, "the ping list has members and roles", mentionable.some((m) => m.includes(meB.username)) && mentionable.some((m) => m.includes(roles[0].name)), mentionable.length);
    await snap("7-ping-open");
    await closeList();

    // closed menus
    const closedMenus = main.locator('button[aria-haspopup="listbox"]');
    const n = await closedMenus.count();
    const off = closedMenus.nth(n - 2), onlyB = closedMenus.nth(n - 1);
    await onlyB.scrollIntoViewIfNeeded();
    record(area, "the closed menu can't be opened", await off.isDisabled());
    const offWidth = await off.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    record(area, "a 150-character placeholder stays inside its field", offWidth.scroll <= offWidth.client + 1, JSON.stringify(offWidth));
    record(area, "the referee menu shows as not for you", (await onlyB.isDisabled()) && !!(await onlyB.getAttribute("title")), await onlyB.getAttribute("title"));
    await snap("8-closed-menus");

    record(area, "Escape closes every list", closeFails === 0, closeFails);
    const report = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth }));
    record(area, "no sideways scroll", report.overflow <= 0, report.overflow);
    record(area, "no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
} finally {
  await browser?.close();
  bot.destroy();
  await deleteServer(S, acc.a, A);
  await closeSessions();
  finish();
}
