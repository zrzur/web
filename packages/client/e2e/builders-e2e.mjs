// A bot built with the component builders, events and collectors (ButtonBuilder,
// Events.InteractionCreate, type guards, awaitMessageComponent, a collector that
// disables its buttons at the end, a select menu, showModal + awaitModalSubmit,
// MessageFlags.Ephemeral). Seeded account 1 uses it in the app; account 2 clicks
// from outside. Own server, deleted at the end; the shared test bot.
// LOCALE=ar|en|de, PHONE=1 for 375 px. Bot text stays English.
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

const {
  Client,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  Events,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} = await botSdk();
const tag = `${LOCALE}${PHONE ? "-phone" : ""}`;
const t = (english) => tr(LOCALE, english);
const shot = shots("builders-e2e");
const { record, finish } = checks("builders-e2e", tag);
const [ownerAccount, memberAccount] = seededAccounts(2);
const acc = { a: ownerAccount, b: memberAccount };
let browser;

const A = await session(acc.a);
const B = await session(acc.b);
const A_ID = (await call("GET", "/users/@me", undefined, A)).json._id;
const { server } = (await call("POST", "/servers/create", { name: "Builders lab" }, A)).json;
const S = server._id, CH = server.channels[0];
const code = (await call("POST", `/channels/${CH}/invites`, undefined, A)).json._id;
await call("POST", `/invites/${code}`, undefined, B);
const { testBot, addTestBot } = await import("./lib/test-bot.mjs");
const made = await testBot();
await addTestBot(made, S, A);

const client = new Client({ token: made.token, apiUrl: API, wsUrl: WS, onError: (e) => log.push({ error: String(e?.message ?? e) }) });
const log = [];

// ===================== the bot =====================
let banMessageId;
// 1. confirm / cancel, awaited on the message
async function banPrompt(channelId, ownerId) {
  const confirm = new ButtonBuilder().setCustomId("confirm").setLabel("Confirm Ban").setStyle(ButtonStyle.Danger);
  const cancel = new ButtonBuilder().setCustomId("cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary);
  const row = new ActionRowBuilder().addComponents(cancel, confirm);
  const response = await client.send(channelId, { content: "Are you sure you want to ban **Spammer**?", components: [row] });
  banMessageId = response.id;
  const collectorFilter = (i) => i.user.id === ownerId;
  try {
    const confirmation = await response.awaitMessageComponent({ filter: collectorFilter, time: 60_000 });
    log.push({ flow: "ban", customId: confirmation.customId, user: confirmation.user.id });
    if (confirmation.customId === "confirm") {
      await confirmation.update({ content: "**Spammer** has been banned.", components: [] });
    } else if (confirmation.customId === "cancel") {
      await confirmation.update({ content: "Action cancelled", components: [] });
    }
  } catch {
    await client.editMessage(channelId, response.id, { content: "Confirmation not received within 1 minute, cancelling", components: [] });
  }
}

// 2. a counter with a collector that disables everything when it ends
async function counter(channelId) {
  let count = 0;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("minus").setLabel("-1").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("plus").setLabel("+1").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("stop").setLabel("Stop").setStyle(ButtonStyle.Danger),
  );
  const message = await client.send(channelId, { content: `Count: ${count}`, components: [row] });
  const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120_000 });
  collector.on("collect", async (i) => {
    if (i.customId === "stop") return collector.stop("stopped");
    count += i.customId === "plus" ? 1 : -1;
    log.push({ flow: "counter", customId: i.customId, count });
    await i.update({ content: `Count: ${count}` });
  });
  collector.on("end", async (collected, reason) => {
    log.push({ flow: "counter-end", reason, size: collected.size });
    const last = [...collected.values()].at(-1);
    const disabled = last.message.components.map((r) => {
      const copy = ActionRowBuilder.from(r);
      copy.components.forEach((c) => c.setDisabled(true));
      return copy;
    });
    await last.update({ content: `Final count: ${count}`, components: disabled });
  });
}

// 3. a select menu collected with componentType, answered privately
async function starterMenu(channelId) {
  const select = new StringSelectMenuBuilder()
    .setCustomId("starter")
    .setPlaceholder("Make a selection!")
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("Bulbasaur").setDescription("The dual-type Grass/Poison Seed Pokémon.").setValue("bulbasaur"),
      new StringSelectMenuOptionBuilder().setLabel("Charmander").setDescription("The Fire-type Lizard Pokémon.").setValue("charmander"),
      new StringSelectMenuOptionBuilder().setLabel("Squirtle").setDescription("The Water-type Tiny Turtle Pokémon.").setValue("squirtle"),
    );
  const message = await client.send(channelId, { content: "Choose your starter!", components: [new ActionRowBuilder().addComponents(select)] });
  const collector = message.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 120_000 });
  collector.on("collect", async (i) => {
    const selection = i.values[0];
    log.push({ flow: "starter", selection, user: i.user.id });
    await i.reply({ content: `${i.user.username} has selected ${selection}!`, flags: MessageFlags.Ephemeral });
  });
}

// 4. a button that opens a form, awaited with awaitModalSubmit
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton() || interaction.customId !== "feedback") return;
  const modal = new ModalBuilder().setCustomId(`feedback-${interaction.id}`).setTitle("Feedback");
  const input = new TextInputBuilder().setCustomId("text").setLabel("What should we add?").setStyle(TextInputStyle.Paragraph).setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
  const submitted = await interaction
    .awaitModalSubmit({ time: 60_000, filter: (i) => i.customId === `feedback-${interaction.id}` && i.user.id === interaction.user.id })
    .catch(() => null);
  if (!submitted) return;
  const text = submitted.fields.getTextInputValue("text");
  log.push({ flow: "feedback", text, ephemeral: submitted.isModalSubmit() });
  await submitted.reply({ content: `Thanks! You wrote: ${text}`, flags: MessageFlags.Ephemeral });
});
// 5. deferUpdate, then editReply with rebuilt components (ButtonBuilder.from)
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton() || interaction.customId !== "toggle") return;
  await interaction.deferUpdate();
  const old = interaction.message.components[0].components[0];
  const on = old.label === "Off";
  const button = ButtonBuilder.from(old).setLabel(on ? "On" : "Off").setStyle(on ? ButtonStyle.Success : ButtonStyle.Secondary);
  log.push({ flow: "toggle", deferred: interaction.deferred, label: on ? "On" : "Off" });
  await interaction.editReply({ components: [new ActionRowBuilder().addComponents(button)] });
});
// =====================================================================

await client.login();
await sleep(1500);
const banDone = banPrompt(CH, A_ID);
while (!banMessageId) await sleep(100);
await counter(CH);
await starterMenu(CH);
await client.send(CH, { content: "Tell us what to build next.", components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("feedback").setLabel("Give feedback").setStyle(ButtonStyle.Primary))] });
await client.send(CH, { content: "Notifications", components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("toggle").setLabel("Off").setStyle(ButtonStyle.Secondary))] });

const waitLog = async (pred, ms = 10000) => {
  for (let t = 0; t < ms / 150; t++) {
    const hit = log.find(pred);
    if (hit) return hit;
    await sleep(150);
  }
  return undefined;
};

try {
  browser = await launch();
  const ctx = await browser.newContext({ viewport: viewport(), locale: LOCALE, colorScheme: "dark" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  await signIn(page, acc.a);
  await goTo(page, `/server/${S}/channel/${CH}`, 4500);
  const main = page.locator("main");
  const btn = (name) => main.getByRole("button", { name, exact: true }).last();
  const sees = async (text, ms = 8000) => {
    for (let t = 0; t < ms / 200; t++) {
      if ((await main.innerText()).includes(text)) return true;
      await sleep(200);
    }
    return false;
  };
  const snap = async (name) => { await page.waitForTimeout(450); await page.screenshot({ path: shot(`${tag}-${name}`) }); };
  const area = `app ${tag}`;
  await snap("1-all");

  // 1. b's click is filtered out; a's Cancel is the one awaited
  const bClick = await call("POST", "/interactions", { type: "Component", channel_id: CH, message_id: banMessageId, custom_id: "confirm", nonce: randomUUID() }, B);
  await sleep(1200);
  record("bot", "the filter skips someone else's click (no ban)", bClick.status === 200 && !log.some((e) => e.flow === "ban"), bClick.status);
  await btn("Cancel").click();
  await banDone;
  const ban = await waitLog((e) => e.flow === "ban");
  record(area, "awaitMessageComponent gets a's Cancel and update() changes the message", ban?.customId === "cancel" && ban?.user === A_ID && (await sees("Action cancelled")), JSON.stringify(ban));

  // 2. the counter
  await btn("+1").click();
  await waitLog((e) => e.flow === "counter" && e.count === 1);
  await btn("+1").click();
  await waitLog((e) => e.flow === "counter" && e.count === 2);
  await btn("-1").click();
  await waitLog((e) => e.flow === "counter" && e.count === 1);
  record(area, "the collector counts each click and update() shows it", await sees("Count: 1"));
  await btn("Stop").click();
  const end = await waitLog((e) => e.flow === "counter-end");
  await sleep(800);
  const states = await Promise.all(["-1", "+1", "Stop"].map((n) => btn(n).isDisabled()));
  record(area, "stop() ends it and ActionRowBuilder.from disables every button", end?.reason === "stopped" && end?.size === 4 && (await sees("Final count: 1")) && states.every(Boolean), `${JSON.stringify(end)} ${states}`);

  // 3. the select menu
  await main.locator('button[aria-haspopup="listbox"]', { hasText: "Make a selection!" }).click();
  await page.locator('[role="listbox"]').getByRole("option", { name: /Charmander/ }).click();
  const starter = await waitLog((e) => e.flow === "starter");
  const privateMark = await sees(t("Only you can see this"), 3000);
  record(area, "a StringSelect collector gets the choice and answers privately", starter?.selection === "charmander" && (await sees("has selected charmander!")) && privateMark, JSON.stringify(starter));

  // 4. showModal + awaitModalSubmit
  await btn("Give feedback").click();
  const dialog = page.getByRole("dialog").last();
  await dialog.waitFor({ timeout: 8000 });
  await snap("2-modal");
  await dialog.getByRole("textbox", { name: "What should we add?" }).fill("Tournament brackets");
  await dialog.getByRole("button", { name: t("Submit"), exact: true }).click();
  const feedback = await waitLog((e) => e.flow === "feedback");
  record(area, "awaitModalSubmit gets the form and getTextInputValue reads it", feedback?.text === "Tournament brackets" && (await sees("Thanks! You wrote: Tournament brackets")), JSON.stringify(feedback));

  // 5. deferUpdate + editReply with ButtonBuilder.from
  await btn("Off").click();
  const toggle = await waitLog((e) => e.flow === "toggle");
  await sleep(800);
  record(area, "deferUpdate, then editReply rebuilds the button from interaction.message", toggle?.deferred === true && (await btn("On").count()) === 1, JSON.stringify(toggle));
  await btn("On").click();
  await waitLog((e) => e.flow === "toggle" && e.label === "Off" && e !== toggle);
  await sleep(800);
  record(area, "and back again", (await btn("Off").count()) === 1);
  await snap("3-after");

  record("bot", "no bot errors", !log.some((e) => e.error), JSON.stringify(log.filter((e) => e.error)));
  record(area, "no page errors", errors.length === 0, errors.join(" | "));
} finally {
  await browser?.close();
  client.destroy();
  await deleteServer(S, acc.a, A);
  await closeSessions();
  finish({ log });
}
