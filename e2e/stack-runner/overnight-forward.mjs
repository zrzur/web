// Forward a message, as a person does it: open the message's menu
// (right-click on desktop, press and hold on a phone), Forward, search the
// destination channel, type a note, send. The destination shows the copy
// in a "Forwarded" frame under the note, with a link back for the sender;
// a member who cannot view the source channel sees the frame without the
// link. Setup (server, channels, the hidden source channel, the second
// member, the source message) is done through the API. Runs in en/ar/de at
// desktop size and at 375 px.
//
// Usage: node overnight-forward.mjs [part of a test name …]
// Env: see overnight-lib.mjs.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import {
  APP,
  SHOTS,
  VIEWPORTS,
  accounts,
  api,
  login,
  longPress,
  ownServer,
  runSuite,
  sleep,
  token,
} from "./overnight-lib.mjs";

// ----------------------------------------------------------------- setup

const owner = await token(accounts[0]);
const member = await token(accounts[1]);
const memberMe = await api(member, "GET", "/users/@me");
const NAME = "e2e-overnight-forward";
const SOURCE = "fwd-source";
const DEST = "fwd-dest";
const VIEW_CHANNEL = 1 << 20;
const run = Date.now().toString(36);

async function ensureSetup() {
  const file = `${SHOTS}forward-setup.json`;
  let saved = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  let server = saved ? await api(owner, "GET", `/servers/${saved.server}`).catch(() => null) : null;
  if (!server || server.name !== NAME) {
    server = await ownServer(owner, NAME);
    saved = { server: server._id };
  }
  const SERVER = server._id;
  const ids = {};
  for (const id of server.channels) {
    const channel = await api(owner, "GET", `/channels/${id}`).catch(() => null);
    if (channel?.name === SOURCE || channel?.name === DEST) ids[channel.name] = id;
  }
  for (const name of [SOURCE, DEST])
    if (!ids[name]) ids[name] = (await api(owner, "POST", `/servers/${SERVER}/channels`, { type: "Text", name }))._id;
  // members of the server cannot view the source channel
  await api(owner, "PUT", `/channels/${ids[SOURCE]}/permissions/default`, {
    permissions: { allow: 0, deny: VIEW_CHANNEL },
  });
  const members = await api(owner, "GET", `/servers/${SERVER}/members`);
  if (!members.members.some((m) => m._id.user === memberMe._id)) {
    const invite = await api(owner, "POST", `/channels/${ids[DEST]}/invites`);
    await api(member, "POST", `/invites/${invite._id}`);
    await api(owner, "DELETE", `/invites/${invite._id}`).catch(() => {});
  }
  const have = saved.message
    ? await api(owner, "GET", `/channels/${ids[SOURCE]}/messages/${saved.message}`).catch(() => null)
    : null;
  if (!have)
    saved.message = (
      await api(owner, "POST", `/channels/${ids[SOURCE]}/messages`, { content: "fwd-original zqfwd the text to pass on" })
    )._id;
  Object.assign(saved, { server: SERVER, source: ids[SOURCE], dest: ids[DEST] });
  writeFileSync(file, JSON.stringify(saved, null, 2));
  return saved;
}
const setup = await ensureSetup();
// the member really cannot read the source channel
const blocked = await api(member, "GET", `/channels/${setup.source}/messages?limit=1`).then(
  () => false,
  (error) => /\b40[34]\b/.test(String(error?.message)),
);
if (!blocked) throw new Error("setup: the second member can read the source channel");
console.log(`[setup] server ${setup.server}, source ${setup.source} (hidden from members), destination ${setup.dest}`);

// ---------------------------------------------------------------- helpers

/** The forwarded copy in the open channel that carries this note */
const copyWith = (page, note) =>
  page.locator("main div[id]").filter({ has: page.locator("[data-testid=forwarded-message]") }).filter({ hasText: note }).last();

/** Check a copy: note above, "Forwarded" frame with the original text */
async function seesCopy(c, page, note) {
  const copy = copyWith(page, note);
  await copy.waitFor({ timeout: 20000 });
  const frame = copy.locator("[data-testid=forwarded-message]");
  const text = await frame.innerText();
  if (!text.includes(c.t("Forwarded"))) throw new Error(`frame has no "${c.t("Forwarded")}" label: ${text.slice(0, 120)}`);
  if (!text.includes("fwd-original zqfwd")) throw new Error("frame does not hold the original text");
  // the note sits above the frame, outside it
  if (text.includes(note)) throw new Error("the note is inside the frame");
  const order = await copy.evaluate((el, n) => {
    const frame = el.querySelector("[data-testid=forwarded-message]");
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.includes(n))
        return frame.compareDocumentPosition(walker.currentNode) & Node.DOCUMENT_POSITION_PRECEDING ? "above" : "below";
    }
    return "missing";
  }, note);
  if (order !== "above") throw new Error(`note is ${order} the frame`);
  return copy;
}

// ----------------------------------------------------------------- tests

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("forward with a note from the message menu; the copy shows the frame and the note", async (c) => {
  const note = `note-${c.lang}-${c.size}-${run}`;
  const message = c.page.locator(`main [id="${setup.message}"]`);
  await message.waitFor({ timeout: 20000 });
  c.step = c.phone ? "press and hold the message" : "right-click the message";
  if (c.phone) await longPress(c.page, message.getByText("fwd-original zqfwd", { exact: false }).first());
  else await message.click({ button: "right", position: { x: 200, y: 20 } });
  c.step = "Forward in the menu";
  await c.page.getByRole("menuitem", { name: c.t("Forward"), exact: true }).click({ timeout: 8000 });
  const dialog = c.page.getByRole("dialog").filter({ hasText: c.t("Forward message") });
  await dialog.waitFor({ timeout: 8000 });
  c.step = "search the destination";
  const search = dialog.getByLabel(c.t("Send to"), { exact: true });
  await search.click();
  await c.page.keyboard.type(DEST, { delay: 30 });
  const option = dialog.getByRole("option").filter({ hasText: DEST });
  await option.first().waitFor({ timeout: 8000 });
  const others = await dialog.getByRole("option").count();
  if (others < 1) throw new Error("no destination found");
  if (c.phone) await option.first().tap();
  else await option.first().click();
  if ((await option.first().getAttribute("aria-selected")) !== "true") throw new Error("destination not chosen");
  c.step = "type a note";
  await dialog.getByLabel(c.t("Add a note (optional)"), { exact: true }).click();
  await c.page.keyboard.type(note, { delay: 20 });
  await c.page.screenshot({ path: `${SHOTS}forward-dialog-${c.lang}-${c.size}.png` });
  c.step = "send";
  const send = dialog.getByRole("button", { name: c.t("Forward"), exact: true });
  if (c.phone) await send.tap();
  else await send.click();
  await dialog.waitFor({ state: "detached", timeout: 15000 });
  c.step = "open the destination";
  await c.page.goto(`${APP}/server/${setup.server}/channel/${setup.dest}`);
  c.step = "the copy in the destination";
  const copy = await seesCopy(c, c.page, note);
  c.step = "link back for the sender";
  const back = copy.locator("[data-testid=forwarded-origin]");
  if ((await back.count()) !== 1) throw new Error("no link back to the original for the sender");
  await copy.scrollIntoViewIfNeeded();
  await c.page.screenshot({ path: `${SHOTS}forward-copy-owner-${c.lang}-${c.size}.png` });
  if (c.phone) await back.tap();
  else await back.click();
  await c.page.waitForURL((u) => u.pathname.includes(setup.message), { timeout: 10000 });
  c.step = "a member who cannot view the source";
  const other = await login(c.browser, accounts[1], { viewport: VIEWPORTS[c.size], locale: c.lang });
  try {
    await other.page.goto(`${APP}/server/${setup.server}/channel/${setup.dest}`);
    const theirs = await seesCopy(c, other.page, note);
    await theirs.scrollIntoViewIfNeeded();
    await other.page.screenshot({ path: `${SHOTS}forward-copy-member-${c.lang}-${c.size}.png` });
    const links = await theirs.locator("[data-testid=forwarded-origin]").count();
    if (links) throw new Error("the member sees a link back to a channel they cannot view");
    const footer = await theirs.locator("[data-testid=forwarded-message]").innerText();
    if (footer.includes(SOURCE)) throw new Error("the member sees the hidden channel's name");
  } finally {
    await other.context.close();
  }
});

// ------------------------------------------------------------------- run

const code = await runSuite("overnight-forward", tests, {
  before: async (c) => {
    c.step = "open the source channel";
    await c.page.goto(`${APP}/server/${setup.server}/channel/${setup.source}`);
    await c.page.locator(`main [id="${setup.message}"]`).waitFor({ timeout: 30000 });
    await sleep(800);
  },
});
process.exit(code);
