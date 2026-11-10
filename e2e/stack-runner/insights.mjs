// Server insights, as an owner uses them: open the server menu, Open server
// settings, Insights in the sidebar; the page shows the day's joins (a
// member just came back through an invite), where they came from, the
// cards with a bar per day, and switches between 7, 30 and 90 days.
// Setup (server, invite, the member leaving and joining again) goes through
// the API; every step under test is a click or a tap. Runs in en/ar/de at
// desktop size and at 375 px, and measures how long the page takes to show.
//
// Needs an API with GET /servers/{id}/insights (feat/server-insights).
// Usage: node insights.mjs [part of a test name …]
// Env: see overnight-lib.mjs (E2E_BASE, E2E_API, E2E_WEB, E2E_LANGS, E2E_SIZES, …).
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import {
  API,
  APP,
  SHOTS,
  accounts,
  api,
  ownServer,
  runSuite,
  sleep,
  token,
} from "./overnight-lib.mjs";

// ----------------------------------------------------------------- setup

const owner = await token(accounts[0]);
const member = await token(accounts[1]);
const memberMe = await api(member, "GET", "/users/@me");
const NAME = "e2e-insights";

async function ensureSetup() {
  const file = `${SHOTS}insights-setup.json`;
  const saved = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : null;
  let server = saved
    ? await api(owner, "GET", `/servers/${saved.server}`).catch(() => null)
    : null;
  if (!server || server.name !== NAME) server = await ownServer(owner, NAME);
  let text;
  for (const id of server.channels) {
    const channel = await api(owner, "GET", `/channels/${id}`).catch(
      () => null,
    );
    if (channel && !channel.voice) {
      text = id;
      break;
    }
  }
  if (!text)
    text = (
      await api(owner, "POST", `/servers/${server._id}/channels`, {
        type: "Text",
        name: "general",
      })
    )._id;
  writeFileSync(file, JSON.stringify({ server: server._id, text }, null, 2));
  return { server: server._id, text };
}
const setup = await ensureSetup();

const probe = await fetch(`${API}/servers/${setup.server}/insights?days=7`, {
  headers: { "x-session-token": owner },
});
if (probe.status === 404 && !(await probe.text()).includes("NotFound")) {
  console.error(
    "insights: this API has no insights route (feat/server-insights is not running on it).",
  );
  process.exit(2);
}

/** The member leaves (if in) and joins again through an invite: one join today */
async function memberJoinsByInvite() {
  await api(member, "DELETE", `/servers/${setup.server}`).catch(() => {});
  const invite = await api(owner, "POST", `/channels/${setup.text}/invites`);
  await api(member, "POST", `/invites/${invite._id}`);
  await api(owner, "DELETE", `/invites/${invite._id}`).catch(() => {});
}
await memberJoinsByInvite();
console.log(
  `[setup] server ${setup.server}, member ${memberMe._id} joined by invite`,
);

// ---------------------------------------------------------------- helpers

const press = (c, locator) => (c.phone ? locator.tap() : locator.click());

/** Server menu → Open server settings, as a person does */
async function openSettings(c, page) {
  await page.goto(`${APP}/server/${setup.server}`);
  if (c.phone) {
    c.step = "open the channel list (phone drawer)";
    await page
      .waitForURL((u) => u.pathname.includes("/channel/"), { timeout: 20000 })
      .catch(() => {});
    const toggle = page
      .getByRole("button", { name: c.t("Toggle main sidebar"), exact: true })
      .first();
    await toggle.waitFor({ timeout: 15000 });
    await toggle.tap();
    await sleep(600);
  }
  c.step = "Server menu";
  const menu = page
    .getByRole("button", { name: c.t("Server menu"), exact: true })
    .first();
  await menu.waitFor({ timeout: 20000 });
  await press(c, menu);
  c.step = "Open server settings";
  await press(
    c,
    page.getByRole("menuitem", { name: c.t("Open server settings") }),
  );
  await page.locator(".settings_sidebar").waitFor({ timeout: 10000 });
}

/** No sideways scroll; titles at least 12 px from their card's edges */
async function fits(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  if (overflow > 1)
    throw new Error(`the page scrolls sideways by ${overflow}px`);
  const gaps = await page
    .locator(
      "[data-stat], [data-testid=insights-sources], [data-testid=insights-channels]",
    )
    .evaluateAll((cards) =>
      cards.map((card) => {
        const box = card.getBoundingClientRect();
        const head = card.querySelector("h3").getBoundingClientRect();
        return Math.min(
          head.left - box.left,
          box.right - head.right,
          head.top - box.top,
        );
      }),
    );
  const tight = Math.min(...gaps);
  if (tight < 12) throw new Error(`a card title is ${tight}px from its edge`);
}

const digits = (text) =>
  Number(
    text
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[^\d]/g, ""),
  );

// ----------------------------------------------------------------- tests

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const timings = [];

test("open Insights → today's join by invite → 7 / 90 days", async (c) => {
  const page = c.page;
  await openSettings(c, page);

  c.step = "Insights in the sidebar";
  const link = page
    .locator(".settings_sidebar")
    .getByRole("link", { name: c.t("Insights"), exact: true })
    .first();
  await link.waitFor({ timeout: 10000 });
  const started = Date.now();
  await press(c, link);
  await page.getByTestId("insights-cards").waitFor({ timeout: 15000 });
  const shown = Date.now() - started;
  const marks = await page.evaluate(() => {
    const open = performance.getEntriesByName("zrzur-insights-open").at(-1);
    const ready = performance.getEntriesByName("zrzur-insights-ready").at(-1);
    return open && ready ? Math.round(ready.startTime - open.startTime) : null;
  });
  timings.push({
    lang: c.lang,
    size: c.size,
    click_to_cards_ms: shown,
    open_to_ready_ms: marks,
  });

  c.step = "today's joins";
  const joins = digits(await page.getByTestId("insights-joins").innerText());
  if (joins < 1)
    throw new Error(`joins shown: ${joins}, want at least the invite join`);
  const invite = digits(
    await page.locator("[data-source=invite] strong").innerText(),
  );
  if (invite < 1) throw new Error(`joins by invite: ${invite}`);
  const zone = await page.getByTestId("insights-zone").innerText();
  if (!zone.includes("/") && !zone.includes("UTC"))
    throw new Error(`no time zone named: ${zone}`);
  await fits(page);
  await page.screenshot({
    path: `${SHOTS}insights-30-${c.lang}-${c.size}.png`,
    fullPage: true,
  });

  c.step = "bars run in reading direction";
  const order = await page
    .locator("[data-stat=joins] [role=img] > *")
    .evaluateAll((bars) => {
      const first = bars[0].getBoundingClientRect().left;
      const last = bars[bars.length - 1].getBoundingClientRect().left;
      return { count: bars.length, firstLeftOfLast: first < last };
    });
  if (order.count !== 30) throw new Error(`30 days show ${order.count} bars`);
  if (order.firstLeftOfLast !== (c.lang !== "ar"))
    throw new Error(`time axis not in reading direction (${c.lang})`);

  for (const days of [7, 90]) {
    c.step = `${days} days`;
    const option = page
      .getByRole("radio")
      .filter({
        hasText: new RegExp(
          `(${days}|${String(days).replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)))})`,
        ),
      });
    await press(c, option.first());
    await page.waitForFunction(
      (n) =>
        document.querySelectorAll("[data-stat=joins] [role=img] > *").length ===
        n,
      days,
      { timeout: 15000 },
    );
    const checked = await option.first().getAttribute("aria-checked");
    if (checked !== "true")
      throw new Error(`${days} days is not the chosen range`);
    await fits(page);
  }
  await page.screenshot({
    path: `${SHOTS}insights-90-${c.lang}-${c.size}.png`,
    fullPage: true,
  });
  return `${joins} joins, cards in ${shown} ms (marks ${marks ?? "?"} ms)`;
});

// ------------------------------------------------------------------- run

const code = await runSuite("insights", tests);
writeFileSync(
  `${SHOTS}insights-timings.json`,
  JSON.stringify(timings, null, 2),
);
console.log("timings:", JSON.stringify(timings));
process.exit(code);
