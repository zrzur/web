// Scheduled server events, as people use them: the owner opens Events from
// the top of the channel list, schedules an event in a voice channel with
// the dialog (title, the day from the calendar, the time from the list),
// a member marks it Interested and sees the count, the owner starts it,
// the member sees the "Happening now" banner in the server and joins.
// Setup (server, voice channel, second member) goes through the API; every
// step under test is a click or key press. Runs in en/ar/de at desktop size
// and at 375 px.
//
// Needs `features.server_events_enabled = true` on the stack (the suite
// stops at once when the API says it is off).
//
// Usage: node events.mjs [part of a test name …]
// Env: see overnight-lib.mjs (E2E_BASE, E2E_API, E2E_LANGS, E2E_SIZES, …).
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import {
  API,
  APP,
  SHOTS,
  VIEWPORTS,
  accounts,
  api,
  login,
  ownServer,
  runSuite,
  sleep,
  token,
} from "./overnight-lib.mjs";

// ----------------------------------------------------------------- setup

const root = await (await fetch(`${API}/`)).json();
if (root.features?.server_events !== true) {
  console.error(
    "events: features.server_events_enabled is off on this stack; turn it on (Revolt.overrides.toml) and restart delta and crond.",
  );
  process.exit(2);
}

const owner = await token(accounts[0]);
const member = await token(accounts[1]);
const memberMe = await api(member, "GET", "/users/@me");
const NAME = "e2e-events";
const VOICE = "events-voice";
const run = Date.now().toString(36);

async function ensureSetup() {
  const file = `${SHOTS}events-setup.json`;
  let saved = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  let server = saved ? await api(owner, "GET", `/servers/${saved.server}`).catch(() => null) : null;
  if (!server || server.name !== NAME) server = await ownServer(owner, NAME);
  const SERVER = server._id;
  let voice;
  let text;
  for (const id of server.channels) {
    const channel = await api(owner, "GET", `/channels/${id}`).catch(() => null);
    if (channel?.name === VOICE) voice = id;
    else if (!text && channel && !channel.voice) text = id;
  }
  if (!voice) voice = (await api(owner, "POST", `/servers/${SERVER}/channels`, { type: "Voice", name: VOICE }))._id;
  if (!text) text = (await api(owner, "POST", `/servers/${SERVER}/channels`, { type: "Text", name: "events-text" }))._id;
  const members = await api(owner, "GET", `/servers/${SERVER}/members`);
  if (!members.members.some((m) => m._id.user === memberMe._id)) {
    const invite = await api(owner, "POST", `/channels/${text}/invites`);
    await api(member, "POST", `/invites/${invite._id}`);
    await api(owner, "DELETE", `/invites/${invite._id}`).catch(() => {});
  }
  // events left by an earlier run would crowd the page
  const left = await api(owner, "GET", `/servers/${SERVER}/events`);
  for (const event of left.events) await api(owner, "DELETE", `/servers/${SERVER}/events/${event._id}`).catch(() => {});
  saved = { server: SERVER, voice, text };
  writeFileSync(file, JSON.stringify(saved, null, 2));
  return saved;
}
const setup = await ensureSetup();
console.log(`[setup] server ${setup.server}, voice ${setup.voice}`);

// ---------------------------------------------------------------- helpers

/** Tap on a phone, click elsewhere */
const press = (c, locator) => (c.phone ? locator.tap() : locator.click());

/** Open the server's events the way a person does */
async function openEvents(c, page) {
  await page.goto(`${APP}/server/${setup.server}`);
  const link = page.getByTestId("events-link");
  c.step = "the Events row at the top of the channel list";
  await link.waitFor({ timeout: 20000 });
  if (!c.phone) {
    // the shortcut listed in Ctrl+/ works too
    await page.keyboard.press("Control+Shift+Digit9");
    await page.getByTestId("events-page").waitFor({ timeout: 10000 });
    await page.goto(`${APP}/server/${setup.server}`);
    await link.waitFor({ timeout: 20000 });
  }
  await press(c, link);
  await page.getByTestId("events-page").waitFor({ timeout: 15000 });
}

/** The card of an event, by its title */
const card = (page, title) => page.getByTestId("event-card").filter({ hasText: title });

/** No box sticks out sideways at this size (12 px rule checked on the card) */
async function fits(c, page, title) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 1) throw new Error(`the page scrolls sideways by ${overflow}px`);
  const gap = await card(page, title).evaluate((el) => {
    const box = el.getBoundingClientRect();
    const title = el.querySelector("h3").getBoundingClientRect();
    return Math.min(title.left - box.left, box.right - title.right);
  });
  if (gap < 12) throw new Error(`the title is ${gap}px from the card edge`);
}

// ----------------------------------------------------------------- tests

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("schedule → interested → start → banner → join", async (c) => {
  const title = `Game night ${c.lang} ${c.size} ${run}`;
  const page = c.page;

  // 1. the owner schedules it
  await openEvents(c, page);
  c.step = "Schedule event";
  await press(c, page.getByTestId("events-schedule"));
  const dialog = page.getByRole("dialog").filter({ hasText: c.t("Schedule an event") });
  await dialog.waitFor({ timeout: 10000 });
  c.step = "type the title";
  await dialog.getByRole("textbox").first().click();
  await page.keyboard.type(title, { delay: 10 });
  c.step = "choose the day in the calendar";
  await press(c, dialog.getByTestId("server-event-start-date"));
  const grid = dialog.getByRole("grid");
  await grid.waitFor({ timeout: 5000 });
  // keyboard: the focused day is the current one; Enter keeps it
  await page.keyboard.press("Enter");
  await grid.waitFor({ state: "detached", timeout: 5000 });
  c.step = "choose the time from the list";
  await press(c, dialog.locator("[id$='-time']").first());
  // the next full hour after now, so the event is in the future
  const next = new Date(Date.now() + 2 * 60 * 60_000);
  const minutes = next.getHours() * 60;
  const slot = page.getByTestId(`server-event-start-time-${minutes}`);
  if (next.getDate() !== new Date().getDate()) {
    // late at night: keep the proposed time (already in the future)
    await page.keyboard.press("Escape");
  } else {
    await slot.scrollIntoViewIfNeeded();
    await press(c, slot);
  }
  c.step = "voice channel is the default place";
  await dialog.getByRole("radio", { name: c.t("Voice channel") }).waitFor({ timeout: 5000 });
  await page.screenshot({ path: `${SHOTS}events-dialog-${c.lang}-${c.size}.png` });
  c.step = "Schedule";
  await press(c, dialog.getByRole("button", { name: c.t("Schedule"), exact: true }));
  await dialog.waitFor({ state: "detached", timeout: 15000 });
  await card(page, title).waitFor({ timeout: 15000 });
  await fits(c, page, title);
  await page.screenshot({ path: `${SHOTS}events-list-owner-${c.lang}-${c.size}.png` });

  // 2. a member marks it Interested
  const other = await login(c.browser, accounts[1], { viewport: VIEWPORTS[c.size], locale: c.lang });
  try {
    const theirs = other.page;
    await openEvents(c, theirs);
    const mine = card(theirs, title);
    await mine.waitFor({ timeout: 15000 });
    c.step = "I'm interested";
    const toggle = mine.getByTestId("event-interested");
    await press(c, toggle);
    await theirs.waitForFunction(
      (el) => el.getAttribute("aria-pressed") === "true",
      await toggle.elementHandle(),
      { timeout: 10000 },
    );
    const count = await mine.getByTestId("event-interested-count").innerText();
    if (!/1|١/.test(count)) throw new Error(`count after marking: ${count}`);
    // the owner's page follows without a reload
    c.step = "the owner sees the count";
    await page.waitForFunction(
      (t) =>
        [...document.querySelectorAll("[data-testid=event-card]")]
          .find((el) => el.textContent.includes(t))
          ?.querySelector("[data-testid=event-interested-count]")
          ?.textContent.match(/1|١/),
      title,
      { timeout: 15000 },
    );

    // 3. the owner starts it (crond would at the start time)
    c.step = "Start now";
    await press(c, card(page, title).getByTestId("event-start"));
    await page
      .locator("[data-testid=event-card][data-phase=live]")
      .filter({ hasText: title })
      .waitFor({ timeout: 15000 });

    // 4. the member sees the banner in the server and joins
    c.step = "Happening now banner";
    await theirs.goto(`${APP}/server/${setup.server}`);
    const banner = theirs.getByTestId("event-banner").filter({ hasText: title });
    await banner.waitFor({ timeout: 20000 });
    await theirs.screenshot({ path: `${SHOTS}events-banner-${c.lang}-${c.size}.png` });
    c.step = "Join";
    await press(c, banner.getByTestId("event-join"));
    await theirs.waitForURL((u) => u.pathname.endsWith(`/channel/${setup.voice}`), { timeout: 15000 });
    await sleep(1500);
    await theirs.screenshot({ path: `${SHOTS}events-joined-${c.lang}-${c.size}.png` });
  } finally {
    await other.context.close();
  }

  // 5. the owner ends it; it leaves the list
  c.step = "End now";
  await page.goto(`${APP}/server/${setup.server}/events`);
  await press(c, card(page, title).getByTestId("event-end"));
  await card(page, title).waitFor({ state: "detached", timeout: 15000 });
  return "scheduled, marked, started, joined, ended";
});

// ------------------------------------------------------------------- run

const code = await runSuite("events", tests);
process.exit(code);
