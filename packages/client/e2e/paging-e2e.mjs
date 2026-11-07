// Bot paging: a bot changes its own buttons when someone presses Next. Labels,
// styles, emoji, disabled states and whole rows change per page; the message
// shows "(edited)"; it stays one message; the keyboard keeps its place; fast
// double clicks count once; a second person sees the same page live.
// Seeded accounts 1 and 2; own server, deleted at the end; the shared test bot.
// LOCALE=ar|en|de, PHONE=1 for 375 px. Bot text is Arabic in ar, else English.
import { randomUUID } from "node:crypto";

import { tr } from "./lib/catalog.mjs";
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
  PHONE,
  seededAccounts,
  session,
  shots,
  signIn,
  sleep,
  viewport,
  WS,
} from "./lib/stack.mjs";

const { Client, EmbedBuilder } = await botSdk();
const tag = `${LOCALE}${PHONE ? "-phone" : ""}`;
const L = (en, arText) => (LOCALE.startsWith("ar") ? arText : en);
const t = (english) => tr(LOCALE, english);
const shot = shots("paging-e2e");
const { record, finish } = checks("paging-e2e", tag);
const [ownerAccount, memberAccount] = seededAccounts(2);
const acc = { a: ownerAccount, b: memberAccount };
let browser;

const A = await session(acc.a);
const B = await session(acc.b);
const { server } = (await call("POST", "/servers/create", { name: L("Map pool", "قائمة الخرائط") }, A)).json;
const S = server._id, CH = server.channels[0];
const code = (await call("POST", `/channels/${CH}/invites`, undefined, A)).json._id;
await call("POST", `/invites/${code}`, undefined, B);
const { testBot, addTestBot } = await import("./lib/test-bot.mjs");
const botMade = await testBot();
await addTestBot(botMade, S, A);

// --- the bot: the page lives in the custom ids, as most bots do it
const maps = [
  [L("Dust", "الصحراء"), L("Long corridors, three bomb sites.", "ممرات طويلة وثلاثة مواقع للقنابل."), "#F3B96B", "🏜️"],
  [L("Harbor", "الميناء"), L("Close quarters between containers.", "قتال قريب بين الحاويات."), "#64A9FF", "⚓"],
  [L("Summit", "القمة"), L("Three levels, long sight lines.", "ثلاثة طوابق وخطوط رؤية طويلة."), "#55DCC8", "🏔️"],
  [L("Foundry", "المسبك"), L("Lava pits split the middle.", "حفر الحمم تقسم الوسط."), "#F27488", "🌋"],
  [L("Skyline", "الأفق"), L("Rooftops and zip lines.", "أسطح وحبال انزلاق."), "#9C8CFF", "🏙️"],
];
const last = maps.length - 1;
const clicks = [];
const pageOf = (n) => {
  const [name, about, colour, emoji] = maps[n];
  const end = n === last;
  return {
    content: L("**Map pool** · vote for next week", "**قائمة الخرائط** · صوّت للأسبوع القادم"),
    embeds: [new EmbedBuilder().title(`${emoji} ${name}`).description(about).colour(colour).footer(L(`Map ${n + 1} of ${maps.length}`, `الخريطة ${n + 1} من ${maps.length}`))],
    components: [
      { type: "button", style: "secondary", emoji: "⏮", customId: `page:0:first`, disabled: n === 0 },
      { type: "button", style: "secondary", label: L("Previous", "السابق"), customId: `page:${n - 1}:prev`, disabled: n === 0 },
      { type: "button", style: "secondary", label: `${n + 1} / ${maps.length}`, customId: "page:counter", disabled: true },
      end
        ? { type: "button", style: "success", label: L("Done", "تم"), emoji: "✅", customId: "page:done" }
        : { type: "button", style: "primary", label: L("Next", "التالي"), customId: `page:${n + 1}:next` },
      { type: "button", style: "secondary", emoji: "⏭", customId: `page:${last}:last`, disabled: end },
      // a whole row that only exists from page 3 on
      ...(n >= 2
        ? [{ type: "select", customId: "page:jump", placeholder: L("Jump to a map", "انتقل إلى خريطة"), options: maps.map(([label], i) => ({ label, value: String(i), default: i === n })) }]
        : []),
    ],
  };
};
const bot = new Client({ token: botMade.token, apiUrl: API, wsUrl: WS });
bot.component("page:", async (i) => {
  clicks.push({ id: i.customId, user: i.user._id, at: Date.now() });
  if (i.customId === "page:done") return i.update({ content: L("**Map pool** · thanks for voting!", "**قائمة الخرائط** · شكرًا على التصويت!"), embeds: [], components: [] });
  const n = i.customId === "page:jump" ? Number(i.values[0]) : Number(i.customId.split(":")[1]);
  await sleep(300); // a bot that takes a moment, so double clicks overlap
  return i.update(pageOf(n));
});
await bot.login();
await sleep(1500);
const MSG = (await bot.send(CH, pageOf(0)))._id;
const waitClicks = async (n, ms = 10000) => {
  for (let t = 0; t < ms / 100 && clicks.length < n; t++) await sleep(100);
  return clicks.length >= n;
};

try {
  browser = await launch();
  const open = async (who) => {
    const ctx = await browser.newContext({ viewport: viewport(), locale: LOCALE, colorScheme: "dark" });
    const p = await ctx.newPage();
    p.errors = [];
    p.on("pageerror", (e) => p.errors.push(e.message.slice(0, 160)));
    await signIn(p, who);
    await goTo(p, `/server/${S}/channel/${CH}`, 4500);
    return p;
  };
  const page = await open(acc.a);
  const pageB = await open(acc.b);
  const main = page.locator("main");
  const area = `app ${tag}`;
  const snap = async (name) => { await page.waitForTimeout(450); await page.screenshot({ path: shot(`${tag}-${name}`) }); };
  const btn = (name) => main.getByRole("button", { name, exact: true }).last();
  const sees = async (p, text, ms = 8000) => {
    for (let t = 0; t < ms / 200; t++) {
      if ((await p.locator("main").innerText()).includes(text)) return true;
      await sleep(200);
    }
    return false;
  };
  const counter = (n) => `${n} / ${maps.length}`;

  await main.getByText(maps[0][0]).first().scrollIntoViewIfNeeded();
  await snap("1-first-page");
  record(area, "page 1: First and Previous are disabled", (await main.getByRole("button", { name: "⏮" }).last().isDisabled()) && (await btn(L("Previous", "السابق")).isDisabled()));
  record(area, "page 1: the counter is a disabled label", await btn(counter(1)).isDisabled());
  const editedBefore = await main.innerText();

  // Next by mouse
  await btn(L("Next", "التالي")).click();
  await waitClicks(1);
  record(area, "Next changes the embed to map 2", await sees(page, maps[1][1]));
  record(area, "the counter label changes to 2 / 5", await sees(page, counter(2)));
  record(area, "Previous becomes usable", !(await btn(L("Previous", "السابق")).isDisabled()));
  const editedMark = t("(edited)");
  const edited = (await main.innerText()).includes(editedMark) && !editedBefore.includes(editedMark);
  record(area, "the message shows it was edited", edited);
  record(area, "the other person sees map 2 live, also marked edited", (await sees(pageB, maps[1][1])) && (await pageB.locator("main").innerText()).includes(editedMark));
  const sameCount = await main.getByText(L("Map pool", "قائمة الخرائط")).count();
  record(area, "it stays one message", sameCount === 1, sameCount);
  await snap("2-second-page");

  // Next by keyboard: the place is kept, so Enter can be pressed again
  await btn(L("Next", "التالي")).focus();
  await page.keyboard.press("Enter");
  await waitClicks(2);
  await sees(page, counter(3));
  await page.waitForTimeout(500);
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
  record(area, "after the bot's change the keyboard is still on Next", focused === L("Next", "التالي"), JSON.stringify(focused));
  await page.keyboard.press("Enter");
  await waitClicks(3);
  record(area, "a second Enter goes on to map 4", await sees(page, counter(4)));

  // a row that appears from page 3 on
  record(area, "the jump menu row appeared with the current map chosen", await sees(page, maps[3][0]) && (await main.locator('button[aria-haspopup="listbox"]').count()) === 1);
  await snap("3-with-jump-menu");

  // fast double click: counted once while the bot works
  const before = clicks.length;
  await btn(L("Previous", "السابق")).dblclick();
  await sleep(1500);
  record(area, "a double click is sent once", clicks.length === before + 1, clicks.length - before);
  record(area, "and goes back exactly one map", await sees(page, counter(3)));

  // the jump menu
  await main.locator('button[aria-haspopup="listbox"]').first().click();
  await page.locator('[role="listbox"]').getByRole("option", { name: maps[last][0] }).click();
  record(area, "the menu jumps to the last map", await sees(page, counter(5)));
  record(area, "on the last map Next becomes a green Done", (await btn(L("Done", "تم")).count()) === 1 && (await btn(L("Next", "التالي")).count()) === 0);
  const tones = await page.evaluate(() => [...document.querySelectorAll("main button")].filter((b) => /Done|تم/.test(b.textContent)).map((b) => getComputedStyle(b).backgroundColor));
  record(area, "Done uses the success colour, not the main action colour", tones.length > 0 && !tones.includes("rgb(224, 25, 95)"), tones.join(","));
  record(area, "Last is disabled on the last map", await main.getByRole("button", { name: "⏭" }).last().isDisabled());
  await snap("4-last-page");

  // First goes back to the start; the extra row goes away again
  await main.getByRole("button", { name: "⏮" }).last().click();
  record(area, "First goes back to map 1", await sees(page, counter(1)));
  await page.waitForTimeout(500);
  record(area, "the jump menu row is gone again on map 1", (await main.locator('button[aria-haspopup="listbox"]').count()) === 0);

  // Done ends the paging
  await main.getByRole("button", { name: "⏭" }).last().click();
  await sees(page, counter(5));
  await btn(L("Done", "تم")).click();
  record(area, "Done replaces the pager with a thank-you and no buttons", (await sees(page, L("thanks for voting!", "شكرًا على التصويت!"))) && (await main.getByRole("button", { name: L("Next", "التالي"), exact: true }).count()) === 0);
  await snap("5-done");

  // the server: the old buttons are gone now
  const stale = await call("POST", "/interactions", { type: "Component", channel_id: CH, message_id: MSG, custom_id: "page:1:next", nonce: randomUUID() }, B);
  record("server", "a button from an earlier page can't be pressed any more", stale.status === 400, stale.status);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  record(area, "no sideways scroll", overflow <= 0, overflow);
  record(area, "no page errors", page.errors.length === 0 && pageB.errors.length === 0, [...page.errors, ...pageB.errors].join(" | "));
} finally {
  await browser?.close();
  bot.destroy();
  await deleteServer(S, acc.a, A);
  await closeSessions();
  finish({ clicks });
}
