// Message search with filters, as a person uses it: type in the channel's
// search box, pick from the suggestions, press Enter, read the results.
// The server, its two members and their messages (one with a link, one with
// an image) are made through the API; every step under test is typed and
// clicked. Runs in en/ar/de at desktop size and at 375 px.
//
// Usage: node overnight-search.mjs [part of a test name …]
// Env: see overnight-lib.mjs.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import {
  APP,
  SHOTS,
  accounts,
  api,
  arabicDigits,
  day,
  ownServer,
  png,
  runSuite,
  sleep,
  token,
  upload,
} from "./overnight-lib.mjs";

// ----------------------------------------------------------------- setup

const owner = await token(accounts[0]);
const member = await token(accounts[1]);
const ownerMe = await api(owner, "GET", "/users/@me");
const memberMe = await api(member, "GET", "/users/@me");
const NAME = "e2e-overnight-search";
const SECOND = "e2e-second";

/** The suite's server, its two channels and the seeded messages */
async function ensureSetup() {
  const file = `${SHOTS}search-setup.json`;
  let saved = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  let server = saved ? await api(owner, "GET", `/servers/${saved.server}`).catch(() => null) : null;
  if (!server || server.name !== NAME) {
    server = await ownServer(owner, NAME);
    saved = { server: server._id };
  }
  const SERVER = server._id;
  const general = server.channels[0];
  const generalName = (await api(owner, "GET", `/channels/${general}`)).name;
  // the second text channel (for "Whole server")
  let second;
  for (const id of server.channels) {
    const channel = await api(owner, "GET", `/channels/${id}`).catch(() => null);
    if (channel?.name === SECOND) second = id;
  }
  if (!second)
    second = (await api(owner, "POST", `/servers/${SERVER}/channels`, { type: "Text", name: SECOND }))._id;
  // the second member
  const members = await api(owner, "GET", `/servers/${SERVER}/members`);
  if (!members.members.some((m) => m._id.user === memberMe._id)) {
    const invite = await api(owner, "POST", `/channels/${general}/invites`);
    await api(member, "POST", `/invites/${invite._id}`);
    await api(owner, "DELETE", `/invites/${invite._id}`).catch(() => {});
  }
  // the messages, once
  const have = saved.messages
    ? await api(owner, "GET", `/channels/${general}/messages/${saved.messages.memberSays}`).catch(() => null)
    : null;
  if (!have) {
    const send = (session, channel, body) =>
      api(session, "POST", `/channels/${channel}/messages`, body).then((m) => m._id);
    const image = await upload(member, "e2e-search.png", "image/png", png(64));
    saved.messages = {
      ownerSays: await send(owner, general, { content: "owner-says zqseed alpha" }),
      memberSays: await send(member, general, { content: "member-says zqseed beta" }),
      memberLink: await send(member, general, { content: "member-link zqseed https://zrzur.com/e2e-search" }),
      memberImage: await send(member, general, { content: "member-image zqseed", attachments: [image] }),
      ownerSecond: await send(owner, second, { content: "owner-second zqseed gamma" }),
    };
    // the search index takes a moment
    await sleep(2000);
  }
  Object.assign(saved, { server: SERVER, general, generalName, second });
  writeFileSync(file, JSON.stringify(saved, null, 2));
  return saved;
}
const setup = await ensureSetup();
console.log(`[setup] server ${setup.server}, owner ${ownerMe.username}, member ${memberMe.username}`);

// ---------------------------------------------------------------- helpers

/** Open the search field: the header box on desktop, the Search button on a phone */
async function openSearch(c) {
  const field = c.page.getByRole("combobox", { name: c.t("Search messages") });
  if (c.phone) {
    c.step = "phone: search button";
    await c.page.getByRole("button", { name: c.t("Search"), exact: true }).first().click();
  } else {
    c.step = "desktop: click the search box";
    await field.click();
  }
  await field.waitFor({ timeout: 10000 });
  return field;
}

/** Type the text into the search field, key by key */
async function type(c, field, text) {
  await field.focus();
  await c.page.keyboard.press("ControlOrMeta+a");
  await c.page.keyboard.press("Backspace");
  await c.page.keyboard.type(text, { delay: 30 });
}

const resultLinks = (c) => c.page.locator(`a[aria-label="${c.t("Jump to message")}"]`);

/** Wait for results, then return their text */
async function results(c, { atLeast = 1 } = {}) {
  c.step = "results";
  const links = resultLinks(c);
  await links.nth(atLeast - 1).waitFor({ timeout: 15000 });
  await sleep(600);
  return links.allInnerTexts();
}

/** The line the panel shows when a filter cannot be read */
const problemLine = (c) =>
  c.page.getByRole("alert").filter({ has: c.page.locator("span") });

// ----------------------------------------------------------------- tests

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

/** Type from: and wait for the member's suggestion */
async function fromSuggestion(c, field) {
  c.step = "type from:";
  await type(c, field, "from:");
  const option = c.page.getByRole("option").filter({ hasText: `@${memberMe.username}` });
  // members this device has not loaded yet are asked for by name
  if (!(await option.first().isVisible({ timeout: 2500 }).catch(() => false))) {
    c.step = "type part of the name";
    await c.page.keyboard.type(memberMe.username.slice(0, 5), { delay: 30 });
  }
  c.step = "member in the suggestions";
  await option.first().waitFor({ timeout: 10000 });
  return option.first();
}

test("from: picked with the pointer, then Enter searches", async (c) => {
  const field = await openSearch(c);
  const option = await fromSuggestion(c, field);
  c.step = "pick the member";
  if (c.phone) await option.tap();
  else await option.click();
  const picked = await field.inputValue();
  if (picked.trim() !== `from:${memberMe.username}`) throw new Error(`field holds "${picked}" after the pick`);
  c.step = "Enter";
  // what the list shows and has chosen at the moment Enter is pressed
  const before = await c.page.evaluate(() => ({
    options: [...document.querySelectorAll("[role=option]")].map((o) => o.textContent.trim()).slice(0, 4),
    active: document.querySelector("[role=option][aria-selected=true]")?.textContent?.trim() ?? null,
  }));
  await c.page.keyboard.press("Enter");
  await sleep(500);
  const after = await field.inputValue();
  if (after.trim() !== picked.trim())
    throw new Error(
      `Enter changed the field to "${after}" instead of searching (list after the pick: ${JSON.stringify(before.options)}, chosen: ${JSON.stringify(before.active)})`,
    );
  const texts = await results(c);
  if (texts.some((x) => /owner-says|owner-second/.test(x))) throw new Error("a message of another member is in the results");
});

test("from: picked from the suggestions shows only that member, a result jumps to the message", async (c) => {
  const field = await openSearch(c);
  const option = await fromSuggestion(c, field);
  c.step = "pick the member with the arrow keys";
  const name = (await option.innerText()).trim();
  for (let i = 0; i < 8; i++) {
    await c.page.keyboard.press("ArrowDown");
    const active = await c.page.locator("[role=option][aria-selected=true]").innerText().catch(() => "");
    if (active.trim() === name) break;
  }
  await c.page.keyboard.press("Enter");
  const value = await field.inputValue();
  if (value.trim() !== `from:${memberMe.username}`) throw new Error(`field holds "${value}"`);
  c.step = "Enter searches";
  await c.page.keyboard.press("Enter");
  const texts = await results(c);
  c.step = "only that member";
  if (texts.some((x) => /owner-says|owner-second/.test(x))) throw new Error("a message of another member is in the results");
  if (!texts.some((x) => x.includes("member-says"))) throw new Error(`member's message missing: ${texts.join(" | ").slice(0, 200)}`);
  c.step = "click a result";
  const target = resultLinks(c).filter({ hasText: "member-says" }).first();
  if (c.phone) await target.tap();
  else await target.click();
  const id = setup.messages.memberSays;
  await c.page.waitForURL((u) => u.pathname.includes(id), { timeout: 10000 });
  c.step = "the message is on screen in the channel";
  const shown = c.page.locator(`main [id="${id}"]`);
  await shown.waitFor({ timeout: 10000 });
  await sleep(800);
  const inView = await shown.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  });
  await c.page.screenshot({ path: `${SHOTS}search-from-jump-${c.lang}-${c.size}.png` });
  if (!inView) throw new Error("the message is not scrolled into view");
});

test("has:link shows only messages with a link", async (c) => {
  const field = await openSearch(c);
  await type(c, field, "has:link");
  await c.page.keyboard.press("Enter");
  const texts = await results(c);
  if (!texts.every((x) => /https?:\/\//.test(x))) throw new Error(`a result has no link: ${texts.join(" | ").slice(0, 200)}`);
  if (!texts.some((x) => x.includes("member-link"))) throw new Error("the seeded link message is missing");
});

test("has:image shows the message with the image", async (c) => {
  const field = await openSearch(c);
  await type(c, field, "has:image");
  await c.page.keyboard.press("Enter");
  const texts = await results(c);
  if (!texts.some((x) => x.includes("member-image"))) throw new Error("the seeded image message is missing");
  if (texts.some((x) => /owner-says|member-says|member-link/.test(x))) throw new Error("a message without an image is in the results");
});

test("Whole server groups the results by channel", async (c) => {
  const field = await openSearch(c);
  await type(c, field, "zqseed");
  await c.page.keyboard.press("Enter");
  let texts = await results(c);
  if (texts.some((x) => x.includes("owner-second"))) throw new Error("this channel's search shows a message of another channel");
  c.step = "toggle Whole server";
  const scope = c.page.getByRole("radiogroup", { name: c.t("Where to search") });
  await scope.getByRole("radio", { name: c.t("Whole server") }).click();
  await c.page.locator(`a[aria-label="${c.t("Jump to message")}"]`).filter({ hasText: "owner-second" }).first().waitFor({ timeout: 15000 });
  c.step = "groups";
  const groups = await c.page.evaluate((label) => {
    const titles = new Map();
    for (const link of document.querySelectorAll(`a[aria-label="${label}"]`)) {
      const title = link.closest("section")?.querySelector("h3")?.textContent?.trim() ?? "";
      titles.set(title, (titles.get(title) ?? 0) + 1);
    }
    return [...titles.entries()];
  }, c.t("Jump to message"));
  await c.page.screenshot({ path: `${SHOTS}search-server-${c.lang}-${c.size}.png` });
  const names = groups.map(([n]) => n);
  if (!names.includes(setup.generalName) || !names.includes(SECOND))
    throw new Error(`group titles: ${JSON.stringify(groups)}`);
  if (names.length !== new Set(names).size) throw new Error("a channel has more than one group");
});

test("before: with Arabic-Indic digits is read as a day", async (c) => {
  const field = await openSearch(c);
  c.step = "tomorrow";
  const tomorrow = arabicDigits(day(1));
  await type(c, field, `zqseed before:${tomorrow}`);
  await c.page.keyboard.press("Enter");
  await results(c);
  if (await problemLine(c).count()) throw new Error(`a problem line: ${await problemLine(c).first().innerText()}`);
  c.step = "a day long ago";
  await type(c, field, `zqseed before:${arabicDigits("2000-01-01")}`);
  await c.page.keyboard.press("Enter");
  await c.page
    .getByText(c.t("No messages in this channel match your search."), { exact: true })
    .waitFor({ timeout: 15000 });
  if (await problemLine(c).count()) throw new Error(`a problem line: ${await problemLine(c).first().innerText()}`);
  await c.page.screenshot({ path: `${SHOTS}search-arabic-date-${c.lang}-${c.size}.png` });
});

test("an unknown filter value gives a plain problem line and no search", async (c) => {
  const field = await openSearch(c);
  await type(c, field, "has:banana");
  await c.page.keyboard.press("Enter");
  c.step = "problem line";
  const line = c.page.getByText(c.t("has: takes link, file, image, video, embed or sound."), { exact: true });
  await line.waitFor({ timeout: 10000 });
  const role = await line.evaluate((el) => el.closest("[role]")?.getAttribute("role"));
  if (role !== "alert") throw new Error(`the line is not announced (role ${role})`);
  if (await resultLinks(c).count()) throw new Error("results shown for a filter that cannot be read");
  c.step = "unknown member";
  // nobody matches, so no suggestion list is open: Enter searches
  await type(c, field, "from:nobody-zz-e2e");
  await c.page.keyboard.press("Enter");
  await c.page
    .getByText(c.t('No member called "{value}".').replace("{value}", "nobody-zz-e2e"), { exact: true })
    .waitFor({ timeout: 15000 });
  await c.page.screenshot({ path: `${SHOTS}search-problem-${c.lang}-${c.size}.png` });
});

// ------------------------------------------------------------------- run

const code = await runSuite("overnight-search", tests, {
  before: async (c) => {
    c.step = "open the channel";
    await c.page.goto(`${APP}/server/${setup.server}/channel/${setup.general}`);
    await c.page.locator(`main [id="${setup.messages.memberImage}"]`).waitFor({ timeout: 30000 });
    await sleep(800);
  },
});
process.exit(code);
