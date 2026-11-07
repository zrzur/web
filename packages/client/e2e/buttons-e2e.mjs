// Buttons and select menus with a real bot built on the SDK: the bot posts a
// message with buttons and a select, people click in the app, the bot answers
// by updating the message. Also disabled, restricted, forged and unanswered
// clicks, the link warning, RTL and phone width.
// Seeded accounts 1 (owner) and 2 (member); own server, deleted at the end; the
// shared test bot. LOCALE=ar|en|de; both sizes run in one process.
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
const t = (english) => tr(LOCALE, english);
const shot = shots("buttons-e2e");
const { record, finish } = checks("buttons-e2e", tag);
const [ownerAccount, memberAccount] = seededAccounts(2);
const acc = { a: ownerAccount, b: memberAccount };
let browser;

const A = await session(acc.a);
const B = await session(acc.b);
const B_ID = (await call("GET", "/users/@me", undefined, B)).json._id;
const { server } = (await call("POST", "/servers/create", { name: `Buttons test (${tag})` }, A)).json;
const S = server._id, CH = server.channels[0];
const code = (await call("POST", `/channels/${CH}/invites`, undefined, A)).json._id;
await call("POST", `/invites/${code}`, undefined, B);
const { testBot, addTestBot } = await import("./lib/test-bot.mjs");
const botMade = await testBot();
await addTestBot(botMade, S, A);

// --- the bot
const seen = [];
let clicks = 0;
const bot = new Client({ token: botMade.token, apiUrl: API, wsUrl: WS });
const board = (note) => ({
  content: `**Lobby** ${note}`,
  components: [
    { type: "button", style: "primary", label: "Count", customId: "count" },
    { type: "button", style: "success", emoji: "🎮", customId: "count-emoji" },
    { type: "button", style: "danger", label: "Off", customId: "off", disabled: true },
    { type: "button", style: "secondary", label: "Only B", customId: "only-b", restrict: { users: [B_ID] } },
    { type: "button", style: "link", label: "Docs", url: "https://example.org/docs" },
    { type: "select", customId: "map", placeholder: "Pick a map", options: [{ label: "Dust", value: "dust" }, { label: "Inferno", value: "inferno" }] },
    { type: "button", style: "secondary", label: "Silent", customId: "silent" },
  ],
});
bot.component("count", (i) => {
  clicks += 1;
  seen.push({ id: i.customId, user: i.user._id });
  return i.update(board(`clicks: ${clicks}`));
});
bot.component("count-emoji", (i) => {
  clicks += 1;
  seen.push({ id: i.customId, user: i.user._id });
  return i.update(board(`clicks: ${clicks}`));
});
bot.component("only-b", (i) => {
  seen.push({ id: i.customId, user: i.user._id });
  return i.reply({ content: "Hi B, only you can press this.", ephemeral: true });
});
bot.component("map", (i) => {
  seen.push({ id: i.customId, user: i.user._id, values: i.values });
  return i.update(board(`map: ${i.values.join(",")}`));
});
bot.component("silent", (i) => {
  seen.push({ id: i.customId, user: i.user._id }); // never answers
});
await bot.login();
await sleep(1500);
const posted = await bot.send(CH, board("clicks: 0"));
const MSG = posted._id;

const click = (headers, body) => call("POST", "/interactions", { type: "Component", channel_id: CH, message_id: MSG, nonce: randomUUID(), ...body }, headers);

try {
  // --- the server's checks
  const forged = await click(A, { custom_id: "made-up" });
  record("server", "invented custom_id refused", forged.status >= 400 && forged.status < 500, forged.status);
  const off = await click(A, { custom_id: "off" });
  record("server", "disabled button refused", off.status >= 400 && off.status < 500, off.status);
  const notB = await click(A, { custom_id: "only-b" });
  record("server", "restricted button refused for someone else", notB.status >= 400 && notB.status < 500, notB.status);
  const badValue = await click(A, { custom_id: "map", values: ["nuke"] });
  record("server", "select value that is not an option refused", badValue.status >= 400 && badValue.status < 500, badValue.status);
  const twoValues = await click(A, { custom_id: "map", values: ["dust", "inferno"] });
  record("server", "more values than allowed refused", twoValues.status >= 400 && twoValues.status < 500, twoValues.status);
  const anon = await call("POST", "/interactions", { type: "Component", channel_id: CH, message_id: MSG, custom_id: "count", nonce: randomUUID() });
  record("server", "no login refused", anon.status === 401, anon.status);
  const outsider = await call("POST", "/servers/create", { name: "x" }, B); // b's own server, not the channel
  record("server", "(setup) second server for b", outsider.status === 200);
  const okB = await click(B, { custom_id: "only-b" });
  record("server", "restricted button works for B", okB.status === 200, okB.status);
  await sleep(1500);
  record("bot", "bot got B's click with B as the user", seen.some((s) => s.id === "only-b" && s.user === B_ID));
  if (outsider.json?.server?._id) {
    const t = (await call("PUT", "/auth/mfa/ticket", { password: acc.b.password }, B)).json?.token;
    await call("DELETE", `/servers/${outsider.json.server._id}`, undefined, { ...B, "x-mfa-ticket": t });
  }

  // --- in the app
  browser = await launch();
  for (const [label, size] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({ viewport: size, locale: LOCALE, colorScheme: "dark" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
    await signIn(page, acc.a);
    await goTo(page, `/server/${S}/channel/${CH}`, 4000);
    const message = page.locator(`[id="message-${MSG}"], [data-message-id="${MSG}"]`).first();
    const scope = (await message.count()) ? message : page.locator("main");
    await page.screenshot({ path: shot(`${tag}-${label}`) });

    const before = clicks;
    await scope.getByRole("button", { name: /^Count$/ }).first().click();
    for (let i = 0; i < 30 && clicks === before; i++) await sleep(200);
    await page.waitForTimeout(1200);
    const text = await page.locator("main").innerText();
    record(`app ${label}`, "pressing Count reaches the bot and the message updates", clicks === before + 1 && text.includes(`clicks: ${clicks}`), `clicks ${clicks}`);

    const disabled = await scope.getByRole("button", { name: /^Off$/ }).first().isDisabled();
    record(`app ${label}`, "disabled button can't be pressed", disabled);

    const onlyB = scope.getByRole("button", { name: /^Only B$/ }).first();
    record(
      `app ${label}`,
      "a button meant for someone else shows as not for you",
      (await onlyB.isDisabled()) && !!(await onlyB.getAttribute("title")),
      await onlyB.getAttribute("title"),
    );

    await scope.getByRole("button", { name: /^Silent$/ }).first().click();
    let failed = false;
    for (let i = 0; i < 40 && !failed; i++) {
      await sleep(250);
      failed = (await page.locator("main").innerText()).includes(t("The bot did not respond in time."));
    }
    record(`app ${label}`, "a bot that doesn't answer is shown as failed", failed);

    await scope.getByRole("link", { name: /Docs/ }).first().click();
    const warned = await page.getByRole("dialog").first().waitFor({ timeout: 4000 }).then(() => true, () => false);
    await page.screenshot({ path: shot(`${tag}-${label}-link`) });
    record(`app ${label}`, "link button warns before leaving for an untrusted site", warned);
    await page.keyboard.press("Escape");

    const report = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth }));
    record(`app ${label}`, "no sideways scroll", report.overflow <= 0, report.overflow);
    record(`app ${label}`, "no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  // B: the button meant for B works in the app, and the answer is private
  {
    const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop, locale: LOCALE, colorScheme: "dark" });
    const page = await ctx.newPage();
    await signIn(page, acc.b);
    await goTo(page, `/server/${S}/channel/${CH}`, 4000);
    const onlyB = page.locator("main").getByRole("button", { name: /^Only B$/ }).first();
    const enabled = !(await onlyB.isDisabled());
    await onlyB.click();
    let reply = false;
    for (let i = 0; i < 30 && !reply; i++) {
      await sleep(250);
      reply = (await page.locator("main").innerText()).includes("Hi B, only you can press this.");
    }
    await page.screenshot({ path: shot(`${tag}-member-b`) });
    record("app B", "B can press the button meant for B and gets the private answer", enabled && reply);
    await ctx.close();
  }
} finally {
  await browser?.close();
  bot.destroy();
  await deleteServer(S, acc.a, A);
  await closeSessions();
  finish();
}
