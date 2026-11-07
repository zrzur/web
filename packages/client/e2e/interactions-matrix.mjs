// Every way a bot can answer a button, a menu and a form, together with embeds,
// with a real bot built on the SDK: update, deferUpdate + editReply, reply
// (public and private), defer ("thinking") + editReply, forms from a button and
// from a menu, follow-ups (send, edit, delete, the limit of 5), buttons and
// menus on answers and on private answers, a second person's click reaching the
// first live, the game-over state, and what the server refuses.
// Seeded accounts 1 (owner) and 2 (member); own server, deleted at the end; the
// shared test bot. LOCALE=ar|en|de, PHONE=1 for 375 px. Bot text is Arabic in
// ar, else English.
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
const shot = shots("interactions-matrix");
const { record, finish } = checks("interactions-matrix", tag);
const [ownerAccount, memberAccount] = seededAccounts(2);
const acc = { a: ownerAccount, b: memberAccount };
let browser;

const A = await session(acc.a);
const B = await session(acc.b);
const meB = (await call("GET", "/users/@me", undefined, B)).json;
const { server } = (await call("POST", "/servers/create", { name: L("Arena", "الحلبة") }, A)).json;
const S = server._id, CH = server.channels[0];
const code = (await call("POST", `/channels/${CH}/invites`, undefined, A)).json._id;
await call("POST", `/invites/${code}`, undefined, B);
const { testBot, addTestBot } = await import("./lib/test-bot.mjs");
const botMade = await testBot();
await addTestBot(botMade, S, A);

// --- the bot: a small match with a scoreboard
const errors = [];
const bot = new Client({ token: botMade.token, apiUrl: API, wsUrl: WS, onError: (e) => { errors.push(String(e?.type ?? "") + " " + JSON.stringify(e?.body ?? e?.message ?? e).slice(0, 300)); console.log("BOT ERROR", errors.at(-1)); } });
const score = { red: 0, blue: 0, mode: null, mvp: null, over: false };
const log = [];
const board = () => {
  const embed = new EmbedBuilder()
    .title(L("Ranked match · round 1", "مباراة مصنّفة · الجولة ١"))
    .description(score.over ? L("**Game over.** Thanks for playing.", "**انتهت المباراة.** شكرًا للعب.") : L("First team to 3 wins. Press a team to score.", "أول فريق يصل إلى ٣ يفوز. اضغط على فريق ليسجّل."))
    .colour(score.over ? "#55DCC8" : "#E0195F")
    .field(L("Red", "الأحمر"), String(score.red), true)
    .field(L("Blue", "الأزرق"), String(score.blue), true)
    .field(L("Mode", "النمط"), score.mode ?? "—", true)
    .footer(score.mvp ? L(`MVP: ${score.mvp}`, `أفضل لاعب: ${score.mvp}`) : L("No MVP yet", "لا يوجد أفضل لاعب بعد"));
  const off = score.over;
  return {
    content: L("**Arena**", "**الحلبة**"),
    embeds: [embed],
    components: [
      { type: "button", style: "danger", label: L("Red +1", "الأحمر +١"), customId: "score:red", disabled: off },
      { type: "button", style: "primary", label: L("Blue +1", "الأزرق +١"), customId: "score:blue", disabled: off },
      { type: "button", style: "secondary", label: L("Stats", "الإحصاءات"), emoji: "📊", customId: "stats", disabled: off },
      { type: "button", style: "secondary", label: L("Analyse", "حلّل"), customId: "think", disabled: off },
      { type: "button", style: "success", label: L("Sign up", "سجّل"), customId: "signup", disabled: off },
      { type: "select", customId: "mode", placeholder: L("Game mode", "نمط اللعب"), disabled: off, options: [
        { label: L("Capture the flag", "التقاط العلم"), value: "ctf", emoji: "🚩" },
        { label: L("Deathmatch", "قتال حتى النهاية"), value: "dm", emoji: "⚔️" },
        { label: L("Custom…", "مخصص…"), value: "custom", description: L("Opens a form", "يفتح نموذجًا") },
      ] },
      { type: "userSelect", customId: "mvp", placeholder: L("Pick the MVP", "اختر أفضل لاعب"), disabled: off },
      { type: "button", style: "secondary", label: L("Announce", "أعلن"), customId: "announce", disabled: off },
      { type: "button", style: "danger", label: L("End match", "أنهِ المباراة"), customId: "finish", disabled: off },
    ],
  };
};
let lastSignup;
// update right away
bot.component("score:blue", async (i) => {
  score.blue += 1;
  log.push({ id: "score:blue", user: i.user._id });
  await i.update(board());
});
// acknowledge, then change the message
bot.component("score:red", async (i) => {
  await i.deferUpdate();
  score.red += 1;
  log.push({ id: "score:red", user: i.user._id });
  await sleep(1200);
  await i.editReply(board());
});
// private answer with an embed, a menu and a button
bot.component("stats", (i) => {
  log.push({ id: "stats" });
  return i.reply({
    ephemeral: true,
    embeds: [new EmbedBuilder().title(L("Your stats", "إحصاءاتك")).description(L("Pick what to see.", "اختر ما تريد رؤيته.")).colour("#64A9FF")],
    components: [
      { type: "select", customId: "stat", placeholder: L("Statistic", "الإحصائية"), options: [
        { label: L("Accuracy", "الدقة"), value: "acc" }, { label: L("Wins", "الانتصارات"), value: "wins" }] },
      { type: "button", style: "secondary", label: L("Done", "تم"), customId: "stats:done" },
    ],
  });
});
bot.component("stat", (i) => {
  log.push({ id: "stat", values: i.values });
  const text = i.values[0] === "acc" ? L("Accuracy: 64%", "الدقة: ٦٤٪") : L("Wins: 12", "الانتصارات: ١٢");
  return i.update({ embeds: [new EmbedBuilder().title(L("Your stats", "إحصاءاتك")).description(text).colour("#64A9FF")], components: [
    { type: "button", style: "secondary", label: L("Done", "تم"), customId: "stats:done" }] });
});
bot.component("stats:done", (i) => {
  log.push({ id: "stats:done" });
  return i.update({ content: L("Closed.", "أُغلق."), embeds: [], components: [] });
});
// "thinking", then the answer
bot.component("think", async (i) => {
  await i.defer();
  log.push({ id: "think" });
  await sleep(2500);
  await i.editReply({ embeds: [new EmbedBuilder().title(L("Analysis", "التحليل")).description(L("Red controls the middle. Blue should push the flank.", "الأحمر يسيطر على الوسط. على الأزرق التقدّم من الجانب.")).colour("#F3B96B")] });
});
// a form from a button
const signupForm = {
  customId: "signup:form",
  title: L("Sign up for the match", "التسجيل في المباراة"),
  fields: [
    { type: "textInput", customId: "nick", label: L("Nickname", "اللقب"), style: "short", required: true, minLength: 2, maxLength: 20 },
    { type: "radio", customId: "side", label: L("Team", "الفريق"), options: [{ label: L("Red", "الأحمر"), value: "red" }, { label: L("Blue", "الأزرق"), value: "blue" }] },
    { type: "checkbox", customId: "rules", label: L("I accept the match rules", "أوافق على قواعد المباراة") },
  ],
};
bot.component("signup", (i) => { log.push({ id: "signup" }); return i.showModal(signupForm); });
bot.modal("signup:form", async (i) => {
  lastSignup = { nick: i.field("nick"), side: i.fieldValues("side")[0] ?? i.field("side"), rules: i.fieldChecked("rules"), user: i.user._id };
  log.push({ id: "signup:form", ...lastSignup });
  await i.reply({ ephemeral: true, embeds: [new EmbedBuilder().title(L("You're in", "تم تسجيلك")).field(L("Nickname", "اللقب"), lastSignup.nick, true).field(L("Team", "الفريق"), lastSignup.side ?? "?", true).colour("#55DCC8")] });
  // public follow-up, edited a moment later
  const pub = await i.followUp({ content: L(`${lastSignup.nick} joined the match.`, `انضم ${lastSignup.nick} إلى المباراة.`) });
  await sleep(800);
  await i.editFollowUp(pub._id, { content: L(`${lastSignup.nick} joined team ${lastSignup.side}.`, `انضم ${lastSignup.nick} إلى فريق ${lastSignup.side}.`) });
  // private follow-up with its own button, deleted when pressed
  await i.followUp({ ephemeral: true, content: L("Changed your mind?", "غيّرت رأيك؟"), components: [
    { type: "button", style: "danger", label: L("Leave the match", "غادر المباراة"), customId: "leave" }] });
});
bot.component("leave", (i) => {
  log.push({ id: "leave", ephemeral: i.raw.message_ephemeral });
  return i.update({ content: L("You left the match.", "غادرت المباراة."), components: [] });
});
// a menu: one choice changes the board, "Custom…" opens a form
bot.component("mode", async (i) => {
  log.push({ id: "mode", values: i.values });
  if (i.values[0] === "custom") {
    return i.showModal({ customId: "mode:form", title: L("Custom mode", "نمط مخصص"), fields: [
      { type: "textInput", customId: "rules", label: L("Rules", "القواعد"), style: "paragraph", required: true }] });
  }
  score.mode = i.values[0] === "ctf" ? L("Capture the flag", "التقاط العلم") : L("Deathmatch", "قتال حتى النهاية");
  return i.update(board());
});
bot.modal("mode:form", async (i) => {
  score.mode = L(`Custom: ${i.field("rules")}`, `مخصص: ${i.field("rules")}`).slice(0, 60);
  log.push({ id: "mode:form", rules: i.field("rules") });
  // a form opened from a menu may update the menu's message
  await i.update(board());
});
bot.component("mvp", async (i) => {
  const id = i.values[0];
  const user = i.resolved.users?.[id];
  score.mvp = i.resolved.members?.[id]?.nickname ?? user?.username ?? id;
  log.push({ id: "mvp", values: i.values });
  await i.update(board());
});
// a public answer whose own button works too; the follow-up limit
bot.component("announce", async (i) => {
  log.push({ id: "announce" });
  await i.reply({ content: L("📣 Round 2 starts in 5 minutes.", "📣 الجولة الثانية تبدأ بعد ٥ دقائق."), components: [
    { type: "button", style: "primary", label: L("I'm ready", "أنا جاهز"), customId: "ready" }] });
  const sent = [];
  for (let n = 1; n <= 6; n++) {
    try {
      sent.push((await i.followUp({ content: `#${n}`, ephemeral: true }))._id);
    } catch (error) {
      log.push({ id: "followup-limit", n, status: error.status ?? error.type ?? String(error) });
      break;
    }
  }
  for (const id of sent) await i.deleteFollowUp(id).catch((e) => errors.push(`delete ${id}: ${e}`));
  log.push({ id: "followups-deleted", count: sent.length });
  // answering twice is refused
  try {
    await call("POST", `/interactions/${i.id}/${i.raw.token}/callback`, { type: "Message", data: { content: "again" } }).then((r) => log.push({ id: "second-callback", status: r.status }));
  } catch {
    // a refused answer is what this step expects
  }
});
let readyCount = 0;
bot.component("ready", (i) => {
  readyCount += 1;
  log.push({ id: "ready", message: i.messageId });
  return i.update({ content: L(`📣 Round 2 starts in 5 minutes. Ready: ${readyCount}`, `📣 الجولة الثانية تبدأ بعد ٥ دقائق. الجاهزون: ${readyCount}`) });
});
bot.component("finish", async (i) => {
  score.over = true;
  log.push({ id: "finish" });
  await i.update(board());
});
await bot.login();
await sleep(1500);
const HUB = (await bot.send(CH, board()))._id;
const waitLog = async (id, n = 1, ms = 12000) => {
  for (let t = 0; t < ms / 200 && log.filter((e) => e.id === id).length < n; t++) await sleep(200);
  return log.filter((e) => e.id === id)[n - 1];
};

try {
  // --- what the server refuses
  const forged = await call("POST", `/interactions/${randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase()}/not-a-token/callback`, { type: "Message", data: { content: "x" } });
  record("server", "an answer with an invented interaction and token is refused", forged.status >= 400 && forged.status < 500, forged.status);
  const tooMany = await call("POST", `/channels/${CH}/messages`, { embeds: Array.from({ length: 11 }, (_, n) => ({ title: `${n}` })) }, { "x-bot-token": botMade.token });
  record("server", "11 embeds in one message are refused (limit 10)", tooMany.status >= 400 && tooMany.status < 500, tooMany.status);
  const ten = await call("POST", `/channels/${CH}/messages`, { embeds: Array.from({ length: 10 }, (_, n) => ({ title: `${n}` })), components: [{ type: "ActionRow", components: [{ type: "Button", style: "Secondary", label: "ok", custom_id: "ten" }] }] }, { "x-bot-token": botMade.token });
  record("server", "10 embeds with a row of buttons are accepted", ten.status === 200, ten.status);
  if (ten.json?._id) await call("DELETE", `/channels/${CH}/messages/${ten.json._id}`, undefined, { "x-bot-token": botMade.token });

  // --- in the app, as a
  browser = await launch();
  const ctx = await browser.newContext({ viewport: viewport(), locale: LOCALE, colorScheme: "dark" });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 160)));
  await signIn(page, acc.a);
  await goTo(page, `/server/${S}/channel/${CH}`, 4500);
  const main = page.locator("main");
  const snap = async (name) => { await page.waitForTimeout(450); await page.screenshot({ path: shot(`${tag}-${name}`) }); };
  const sees = async (text, ms = 10000) => {
    for (let t = 0; t < ms / 250; t++) {
      const body = await main.innerText();
      if (typeof text === "string" ? body.includes(text) : text.test(body)) return true;
      await sleep(250);
    }
    return false;
  };
  const button = (name) => main.getByRole("button", { name, exact: typeof name === "string" }).last();
  const press = async (name) => { const b = button(name); await b.scrollIntoViewIfNeeded(); await b.click(); };
  const trigger = (text) => main.locator('button[aria-haspopup="listbox"]', { hasText: text }).last();
  const option = (name) => page.locator('[role="listbox"]').getByRole("option", { name }).first();
  const area = `app ${tag}`;

  await main.getByText(/Ranked match|مباراة مصنّفة/).first().scrollIntoViewIfNeeded();
  await snap("1-board");

  // update right away
  await press(L("Blue +1", "الأزرق +١"));
  await waitLog("score:blue");
  record(area, "update: the score changes in the same message", await sees(/(Blue|الأزرق)\s*\n?\s*1/));
  // deferUpdate, then editReply
  await press(L("Red +1", "الأحمر +١"));
  await waitLog("score:red");
  record(area, "deferUpdate shows no \"thinking\" message", !(await sees(t("is thinking…"), 600)));
  record(area, "deferUpdate: the message changes when the bot edits it", await sees(/(Red|الأحمر)\s*\n?\s*1/));
  const hubCount = await main.getByText(/Ranked match|مباراة مصنّفة/).count();
  record(area, "updates change the message instead of adding one", hubCount === 1, hubCount);

  // a second person's click shows up live
  const click = await call("POST", "/interactions", { type: "Component", channel_id: CH, message_id: HUB, custom_id: "score:blue", nonce: randomUUID() }, B);
  await waitLog("score:blue", 2);
  record(area, "b's click updates a's screen live", click.status === 200 && (await sees(/(Blue|الأزرق)\s*\n?\s*2/)), click.status);

  // private answer with an embed, a menu and a button
  await press(L("Stats", "الإحصاءات"));
  record(area, "private answer with an embed and components appears", await sees(L("Pick what to see.", "اختر ما تريد رؤيته.")));
  record(area, "it is marked as private", await sees(t("Only you can see this")));
  await snap("2-private-stats");
  await trigger(L("Statistic", "الإحصائية")).click();
  await option(L("Wins", "الانتصارات")).click();
  await waitLog("stat");
  record(area, "a menu on a private answer updates that answer", await sees(L("Wins: 12", "الانتصارات: ١٢")));
  await press(L("Done", "تم"));
  record(area, "a button on a private answer closes it", await sees(L("Closed.", "أُغلق.")));

  // thinking, then the answer
  await press(L("Analyse", "حلّل"));
  const thinking = await sees(t("is thinking…"), 4000);
  await snap("3-thinking");
  record(area, "defer shows that the bot is thinking", thinking);
  record(area, "the thinking answer becomes an embed", await sees(L("Red controls the middle", "الأحمر يسيطر على الوسط"), 12000));

  // a form from a button
  await press(L("Sign up", "سجّل"));
  const dialog = page.getByRole("dialog").last();
  await dialog.waitFor({ timeout: 8000 });
  await snap("4-form");
  const submit = dialog.getByRole("button", { name: t("Submit"), exact: true });
  await submit.click();
  await page.waitForTimeout(400);
  const blocked = await dialog.isVisible();
  record(area, "an empty required field stops the form in the app", blocked);
  await dialog.getByRole("textbox", { name: L("Nickname", "اللقب") }).fill(L("Falcon", "الصقر"));
  await dialog.locator("label", { hasText: L("Blue", "الأزرق") }).first().click();
  await dialog.locator("label", { hasText: L("I accept the match rules", "أوافق على قواعد المباراة") }).first().click();
  await submit.click();
  const signed = await waitLog("signup:form");
  record(area, "the bot gets every field of the form", signed?.nick === L("Falcon", "الصقر") && signed?.side === "blue" && signed?.rules === true, JSON.stringify(signed));
  record(area, "the form answer arrives as a private embed", await sees(L("You're in", "تم تسجيلك")));
  record(area, "a public follow-up is sent and then edited", await sees(L("Falcon joined team blue.", "انضم الصقر إلى فريق blue.")));
  record(area, "a private follow-up with its own button arrives", await sees(L("Changed your mind?", "غيّرت رأيك؟")));
  await snap("5-form-answers");
  await press(L("Leave the match", "غادر المباراة"));
  const left = await waitLog("leave");
  record(area, "the button on a private follow-up works", !!left && (await sees(L("You left the match.", "غادرت المباراة."))), JSON.stringify(left));

  // a menu that changes the board, and one choice that opens a form
  await trigger(L("Game mode", "نمط اللعب")).click();
  await option(L("Capture the flag", "التقاط العلم")).click();
  await waitLog("mode");
  record(area, "a menu choice updates the embed", await sees(/(Mode|النمط)\s*\n?\s*(Capture the flag|التقاط العلم)/));
  await trigger(/Capture the flag|التقاط العلم|Game mode|نمط اللعب/).click();
  await option(L("Custom…", "مخصص…")).click();
  const modeDialog = page.getByRole("dialog").last();
  const opened = await modeDialog.waitFor({ timeout: 8000 }).then(() => true, () => false);
  record(area, "a menu choice can open a form", opened);
  if (opened) {
    await modeDialog.getByRole("textbox", { name: L("Rules", "القواعد") }).fill(L("Knives only", "سكاكين فقط"));
    await modeDialog.getByRole("button", { name: t("Submit"), exact: true }).click();
    await waitLog("mode:form");
    record(area, "the form from a menu updates the menu's message", await sees(L("Custom: Knives only", "مخصص: سكاكين فقط")));
  }

  // a user menu that writes into the embed
  await trigger(L("Pick the MVP", "اختر أفضل لاعب")).click();
  await option(new RegExp(meB.username)).click();
  await waitLog("mvp");
  record(area, "the picked member shows in the embed", await sees(meB.username));

  // a public answer with its own button; the follow-up limit; a second answer
  await press(L("Announce", "أعلن"));
  record(area, "a public answer with a button appears", await sees(L("Round 2 starts in 5 minutes.", "الجولة الثانية تبدأ بعد ٥ دقائق.")));
  await waitLog("followups-deleted");
  const limit = log.find((e) => e.id === "followup-limit");
  const deleted = log.find((e) => e.id === "followups-deleted");
  record("server", "5 follow-ups are allowed, the 6th is refused", deleted?.count === 5 && !!limit && limit.n === 6, JSON.stringify(limit));
  const second = await waitLog("second-callback");
  record("server", "answering the same click twice is refused", second && second.status >= 400 && second.status < 500, second?.status);
  await sleep(1500);
  const leftovers = (await main.innerText()).match(/^#[1-6]$/gm) ?? [];
  record(area, "deleted private follow-ups disappear from the screen", leftovers.length === 0, leftovers.join(","));
  await press(L("I'm ready", "أنا جاهز"));
  const ready = await waitLog("ready");
  record(area, "the button on a public answer works and updates that answer", !!ready && ready.message !== HUB && (await sees(L("Ready: 1", "الجاهزون: 1"))), JSON.stringify(ready));
  await snap("6-announce");

  // game over: everything disabled, the colour changes
  await press(L("End match", "أنهِ المباراة"));
  await waitLog("finish");
  record(area, "game over is shown", await sees(L("Game over.", "انتهت المباراة.")));
  await page.waitForTimeout(800);
  const hub = main.locator(`[id="message-${HUB}"], [data-message-id="${HUB}"]`).first();
  const scope = (await hub.count()) ? hub : main;
  const states = await scope.locator('button:not([aria-haspopup]), button[aria-haspopup="listbox"]').evaluateAll((els, member) =>
    els.filter((el) => el.textContent.includes(member) || /\+1|\+١|Stats|الإحصاءات|Analyse|حلّل|Sign up|سجّل|Announce|أعلن|End match|أنهِ|Game mode|نمط اللعب|Capture|التقاط|Custom|مخصص|MVP|أفضل لاعب/.test(el.textContent)).map((el) => el.disabled), meB.username);
  record(area, "every button and menu is disabled after the match", states.length >= 9 && states.every(Boolean), `${states.filter(Boolean).length}/${states.length}`);
  await main.getByText(/Ranked match|مباراة مصنّفة/).first().scrollIntoViewIfNeeded();
  await snap("7-game-over");
  const late = await call("POST", "/interactions", { type: "Component", channel_id: CH, message_id: HUB, custom_id: "score:red", nonce: randomUUID() }, B);
  record("server", "a disabled button can't be pressed through the API either", late.status >= 400 && late.status < 500, late.status);

  const report = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth }));
  record(area, "no sideways scroll", report.overflow <= 0, report.overflow);
  record(area, "no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  record("bot", "no bot errors", errors.length === 0, errors.join(" | "));
} finally {
  await browser?.close();
  console.log("bot log:", log.map((e) => e.id).join(","));
  bot.destroy();
  await deleteServer(S, acc.a, A);
  await closeSessions();
  finish({ log });
}
