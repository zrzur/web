// One design for badges: a person opens a profile, reads the badges, hovers
// or presses one, and the same design shows in the member list, the server
// header and on messages. Runs in en/ar/de on desktop and at 375 px.
//
//   node e2e/stack-runner/badges-one-design.mjs
//
// Env: E2E_LIB (folder with stack.mjs and catalog.mjs), E2E_WEB (this web
//   checkout, for the catalogs), E2E_CHROMIUM (headless shell), E2E_BASE,
//   E2E_LOCALES, E2E_VIEWPORTS, E2E_SHOTS (folder: also screenshot every badge in light and
//   dark). Uses the first account of dev-stack-accounts.json and logs out.
//
// Dev accounts hold no badges and only the server can give one, so the data
// is added on the wire: a real Ready event with `badges`, a verified and an
// official server and one verified bot; a real message list with one author
// swapped to that bot; `/badges/@me` with a hidden and a past badge; billing
// marked available; Discover listings marked verified, plus one made-up bot
// listing, as the dev stack lists none. Everything after that
// is real: the app draws what it received and the test only clicks.
//
// Not covered: the badge admin dialog, behind STAFF_TOOLS_ENABLED, a constant
// set to false in the code, so no data can open it; and the Discover server
// page, which draws no verified mark.
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const lib = process.env.E2E_LIB;
if (!lib) {
  console.error("Set E2E_LIB to the folder with stack.mjs and catalog.mjs");
  process.exit(2);
}
const dir = pathToFileURL(`${lib.replace(/\/?$/, "/")}`);
const { API, APP, LOCALES, VIEWPORTS, accounts, pw, reporter } = await import(
  new URL("stack.mjs", dir)
);
const { tr } = await import(new URL("catalog.mjs", dir));

// English name and description of every badge, as in useBadgeText.ts
const BADGES = {
  founder: ["Zrzur Founder", "Founded Zrzur."],
  staff: [
    "Zrzur Staff",
    "A member of the official Zrzur team. Server moderators don't get this badge.",
  ],
  developer: ["Zrzur Developer", "Builds Zrzur itself."],
  platform_moderator: ["Platform Moderator", "Keeps Zrzur safe for everyone."],
  partner: ["Zrzur Partner", "An approved Zrzur partner or partner community."],
  server_owner: ["Server owner", "Owns this server."],
  super_creator: [
    "Super Creator",
    "An outstanding designer of Zrzur profile designs and decorations, chosen by the team.",
  ],
  creator: [
    "Creator",
    "Makes profile designs and decorations for Zrzur's community gallery.",
  ],
  elite_bug_hunter: [
    "Elite Bug Hunter",
    "Exceptional bug and security contributions, recognised by the team.",
  ],
  bug_hunter: ["Bug Hunter", "Found a real bug that the Zrzur team verified."],
  beta_tester: ["Beta Tester", "Tries Zrzur features before everyone else."],
  beta_veteran: ["Beta Veteran", "Completed a Zrzur beta program."],
  plus: [
    "Zrzur Feather",
    "Supports Zrzur with an active Feather subscription.",
  ],
  early_supporter: ["Early Supporter", "Supported Zrzur in its early days."],
  early_adopter: ["Early Adopter", "Joined Zrzur in its first days."],
  translator: ["Translator", "Helped translate Zrzur."],
  responsible_disclosure: [
    "Responsible Disclosure",
    "Reported a security issue responsibly.",
  ],
  supporter: ["Supporter", "Supported Zrzur."],
};

// `server_owner` is a mark beside a name in a server, never in the profile list
const PROFILE_BADGES = Object.keys(BADGES).filter(
  (id) => id !== "server_owner",
);
/** every bit of the catalogue except the two reserved ones */
const ALL_BITS = 0xfffff & ~(512 | 1024);
const SERVER_OFFICIAL = 1;
const SERVER_VERIFIED = 2;

const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};

/** What the gateway said, with the fixture added before the app reads it */
async function overlay(context) {
  const seen = {};
  await context.routeWebSocket(/:14703/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((message) => server.send(message));
    server.onMessage((message) => {
      if (typeof message !== "string" || !message.includes('"Ready"')) {
        ws.send(message);
        return;
      }
      const body = JSON.parse(message);
      if (body.type !== "Ready") {
        ws.send(message);
        return;
      }
      const me = body.users.find((user) => user.relationship === "User");
      me.badges = ALL_BITS;
      // the owned server with the most channels, with a verified flag
      const owned = body.servers
        .filter((entry) => entry.owner === me._id)
        .sort((a, b) => b.channels.length - a.channels.length)[0];
      owned.flags = SERVER_VERIFIED;
      const second = body.servers.find(
        (entry) => entry.owner === me._id && entry._id !== owned._id,
      );
      if (second) second.flags = SERVER_OFFICIAL;
      const friend = body.users.find(
        (user) => user.relationship === "Friend" && !user.bot,
      );
      // shown as a bot: the member list and messages must use the same tag
      if (friend) {
        friend.bot = { owner: me._id, verified: true };
        // a short name above a long username: the worst case for the seal
        friend.display_name = friend.display_name ?? friend.username;
        friend.username = `${friend.username}-with-a-long-fixture-name`;
      }
      Object.assign(seen, {
        me: me._id,
        name: me.display_name ?? me.username,
        server: owned._id,
        channel: owned.channels.find((id) =>
          body.channels.some(
            (channel) =>
              channel._id === id && channel.channel_type === "TextChannel",
          ),
        ),
        official: second?._id,
        bot: friend?._id,
        botName: friend?.display_name ?? friend?.username,
      });
      ws.send(JSON.stringify(body));
    });
  });
  await context.route(/\/channels\/[^/]+\/messages/, async (route) => {
    if (route.request().method() !== "GET" || !seen.bot)
      return route.fallback();
    const response = await route.fetch();
    const body = await response.json().catch(() => undefined);
    const list = Array.isArray(body) ? body : body?.messages;
    if (list?.length) {
      list[list.length - 1].author = seen.bot;
      list[0].author = seen.bot;
      list[0].content = `${APP}/bot/${seen.bot}`;
      list[0].embeds = [];
    }
    return route.fulfill({ response, json: body });
  });
  const rewrite = (pattern, change) =>
    context.route(pattern, async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      const response = await route.fetch();
      const body = await response.json().catch(() => undefined);
      if (body) change(body);
      return route.fulfill({ response, json: body });
    });
  await rewrite(/\/badges\/@me$/, (body) => {
    const at = Date.now() - 86400000;
    const grant = { source: "admin", granted_at: at, hidden: false };
    body.badges = [
      ...(body.badges ?? []),
      { ...grant, badge: "bug_hunter", hidden: true },
      { ...grant, badge: "beta_tester", revoked_at: at + 1000 },
    ];
  });
  await rewrite(/\/billing/, (body) => {
    if ("available" in body) body.available = true;
  });
  await rewrite(/\/discover\/(servers|bots)/, (body) => {
    for (const entry of Array.isArray(body) ? body : [body]) {
      entry.flags = SERVER_VERIFIED;
      entry.verified = true;
    }
  });
  // the dev stack lists no bots on Discover: one listing is added
  const listedBot = () => ({
    _id: seen.bot,
    username: seen.botName,
    description: "Fixture listing",
    verified: true,
    featured: false,
    tags: [],
    servers: 1,
  });
  const serve = (pattern, json) =>
    context.route(pattern, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ json: json() })
        : route.fallback(),
    );
  await serve(/\/discover\/bots(\?|$)/, () => [listedBot()]);
  await serve(/\/discover\/bots\/[^/?]+$/, listedBot);
  await serve(/\/bots\/[^/]+\/invite$/, listedBot);
  return seen;
}

/** Sessions not yet logged out; a stopped run still ends them */
const live = new Set();

const endSession = (session) =>
  fetch(`${API}/auth/session/logout`, {
    method: "POST",
    headers: { "x-session-token": session.token },
  }).catch(() => {});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await Promise.all([...live].map(endSession));
    process.exit(130);
  });
}

async function signIn(browser, { viewport, locale }) {
  const phone = viewport.width < 600;
  const context = await browser.newContext({
    viewport,
    locale,
    isMobile: phone,
    hasTouch: phone,
  });
  const seen = await overlay(context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // kept in memory for the logout in `finally`; never printed
  const session = {};
  page.on("response", async (response) => {
    if (!response.url().endsWith("/auth/session/login")) return;
    const body = await response.json().catch(() => undefined);
    if (body?.token) {
      session.token = body.token;
      live.add(session);
    }
  });
  const signedIn = { page, context, seen, errors, session };
  await page.goto(`${APP}/login`);
  await page.locator('input[type="email"]').fill(accounts[0].email);
  await page.locator('input[type="password"]').fill(accounts[0].password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 30000,
  });
  for (let i = 0; i < 40 && !seen.channel; i++) await page.waitForTimeout(250);
  return signedIn;
}

/**
 * Always ends the session: through the page if it still works, else by the
 * API with the session from sign-in, so a failed run leaves nothing open.
 */
async function logOut({ page, session }, t) {
  let viaPage = false;
  try {
    // from a plain page: a route like a Discover listing can cover settings
    await page.goto(`${APP}/app`, { waitUntil: "domcontentloaded" });
    await page.goto(`${APP}/settings`, { waitUntil: "domcontentloaded" });
    const out = page.getByText(t("Log out"), { exact: true }).first();
    await out.waitFor({ timeout: 20000 });
    await out.scrollIntoViewIfNeeded();
    await out.click();
    await page.waitForURL(/\/login|^[^/]*\/\/[^/]+\/?$/, { timeout: 20000 });
    viaPage = true;
  } finally {
    if (!viaPage && session.token) await endSession(session);
    live.delete(session);
  }
  return viaPage;
}

/** Light or dark: saved on this device, so it needs no change on the server */
async function setMode(page, mode) {
  await page.evaluate(async (next) => {
    const db = await new Promise((resolve) => {
      const open = indexedDB.open("localforage");
      open.onsuccess = () => resolve(open.result);
    });
    const tx = db.transaction("keyvaluepairs", "readwrite");
    const store = tx.objectStore("keyvaluepairs");
    const saved = await new Promise((resolve) => {
      const read = store.get("theme");
      read.onsuccess = () => resolve(read.result);
    });
    store.put({ ...(saved ?? {}), mode: next }, "theme");
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
  }, mode);
}

const openChannel = async (page, seen) => {
  await page.goto(`${APP}/server/${seen.server}/channel/${seen.channel}`);
  await page.locator("main, [role=main]").first().waitFor({ timeout: 30000 });
};

/**
 * The person presses their own name: on a message on a computer, in the
 * member list on a phone (the card from a member row is off by 57 px in
 * left-to-right layouts on beta too; it is reported, not tested here)
 */
async function openProfile(page, seen, t, phone) {
  await openChannel(page, seen);
  if (phone) {
    const toggle = page.getByRole("button", { name: t("Member list") }).first();
    await toggle.waitFor({ timeout: 15000 });
    await toggle.tap();
    const owner = page.locator('[data-badge-id="server_owner"]').first();
    await owner.waitFor({ timeout: 20000 });
    await owner.tap({ force: true });
  } else {
    const author = page
      .locator("main, [role=main]")
      .first()
      .getByText(new RegExp(`^${seen.name}$`, "i"))
      .first();
    await author.waitFor({ timeout: 20000 });
    await author.click();
  }
  const list = page.getByRole("list", { name: t("Profile badges") }).first();
  await list.waitFor({ timeout: 20000 });
  return list;
}

/**
 * A press anywhere on a target reaches it, by real hit test: the four edge
 * midpoints of a round badge, and the corners too of a square target
 */
async function edgesPress(buttons) {
  const misses = await buttons.evaluateAll((all) =>
    all.flatMap((button) => {
      button.scrollIntoView({ block: "center", behavior: "instant" });
      const box = button.getBoundingClientRect();
      const [x, y] = [box.left + box.width / 2, box.top + box.height / 2];
      const [left, right] = [box.left + 2, box.right - 2];
      const edges = {
        top: [x, box.top + 1],
        bottom: [x, box.bottom - 1],
        start: [box.left + 1, y],
        end: [box.right - 1, y],
        ...(button.dataset.badgeId
          ? {}
          : {
              "top left": [left, box.top + 1],
              "top right": [right, box.top + 1],
              "bottom left": [left, box.bottom - 1],
              "bottom right": [right, box.bottom - 1],
            }),
      };
      return Object.entries(edges).flatMap(([side, [px, py]]) => {
        const hit = document.elementFromPoint(px, py);
        if (hit && (hit === button || button.contains(hit))) return [];
        const what =
          hit?.closest("button")?.textContent?.trim() || hit?.tagName;
        const name = button.dataset.badgeId ?? "username";
        return [`${name} ${side}: ${what}`];
      });
    }),
  );
  assert(
    !misses.length,
    `${misses.length} missed: ${misses.slice(0, 8).join("; ")}`,
  );
}

/** The username button under the name: a tag press must never land on it */
const usernameOf = (page) =>
  page
    .locator("button")
    .filter({ hasText: /#\d{4}$/ })
    .last();

/** The shared Bot tag next to a line of text */
async function botTagNear(line, word) {
  const tag = line
    .locator("xpath=ancestor::*[.//*[@data-badge-tag]][1]")
    .locator("[data-badge-tag]")
    .first();
  await tag.waitFor({ timeout: 20000 });
  // the filled bot pill shows Latin words in capitals (CSS), Arabic as it is
  assert((await tag.innerText()) === word.toUpperCase(), `tag says ${await tag.innerText()}`);
  const style = await tag.evaluate((el) => {
    const { fontSize, height } = getComputedStyle(el);
    return `${fontSize} ${height}`;
  });
  assert(style === "11px 16px", `tag is ${style}`);
}

const tipLocator = (page, name) =>
  page.locator("#floating").getByText(name, { exact: true });

const report = reporter("badges-one-design");
const browser = await pw.chromium.launch({
  executablePath: process.env.E2E_CHROMIUM,
  headless: true,
});
const locales = process.env.E2E_LOCALES?.split(",") ?? LOCALES;
const shotsDir = process.env.E2E_SHOTS?.replace(/\/?$/, "/");
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

const only = process.env.E2E_VIEWPORTS?.split(",");
for (const locale of locales) {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    if (only && !only.includes(name)) continue;
    const at = `${locale} ${name}`;
    const phone = viewport.width < 600;
    const t = (text) => tr(locale, text);
    const signedIn = await signIn(browser, { viewport, locale });
    const { page, context, seen, errors } = signedIn;
    report.page = page;
    let list;
    try {
      await report.step(`${at}: opens a profile`, async () => {
        list = await openProfile(page, seen, t, phone);
      });

      await report.step(
        `${at}: reads every badge by its name and text`,
        async () => {
          const buttons = list.getByRole("button");
          assert(
            (await buttons.count()) === PROFILE_BADGES.length,
            `${await buttons.count()} badges, wanted ${PROFILE_BADGES.length}`,
          );
          for (const id of PROFILE_BADGES) {
            const [title, text] = BADGES[id];
            const label = await list
              .locator(`[data-badge-id="${id}"]`)
              .getAttribute("aria-label");
            assert(
              label === `${t(title)}: ${t(text)}`,
              `${id} says "${label}"`,
            );
          }
        },
      );

      await report.step(
        `${at}: one size, and targets fit the screen`,
        async () => {
          const boxes = await list.getByRole("button").evaluateAll((all) =>
            all.map((el) => {
              const art = el.querySelector("svg").getBoundingClientRect();
              const box = el.getBoundingClientRect();
              return {
                art: [art.width, art.height],
                box: [box.width, box.height],
              };
            }),
          );
          for (const { art, box } of boxes) {
            assert(art[0] === 20 && art[1] === 20, `art ${art}`);
            const least = phone ? 44 : 24;
            assert(box[0] >= least && box[1] >= least, `target ${box}`);
          }
        },
      );

      if (phone)
        await report.step(
          `${at}: every edge of each target presses the badge`,
          async () => {
            await edgesPress(list.getByRole("button"));
            await edgesPress(usernameOf(page));
          },
        );

      await report.step(`${at}: follows the reading direction`, async () => {
        const [first, second] = await list
          .getByRole("button")
          .evaluateAll((all) =>
            all.slice(0, 2).map((el) => el.getBoundingClientRect().left),
          );
        assert(
          locale === "ar" ? first > second : first < second,
          `first badge at ${first}, second at ${second}`,
        );
      });

      await report.step(`${at}: nothing scrolls sideways`, async () => {
        const wide = await page.evaluate(() => {
          const root = document.documentElement;
          if (root.scrollWidth <= root.clientWidth) return undefined;
          const past = [...document.querySelectorAll("body *")].find(
            (el) => el.getBoundingClientRect().right > root.clientWidth + 1,
          );
          return `${root.scrollWidth} over ${root.clientWidth}: ${past?.tagName}.${past?.className}`;
        });
        assert(!wide, `the page scrolls sideways, ${wide}`);
      });

      const bug = () => list.locator('[data-badge-id="bug_hunter"]');
      const [bugName, bugText] = [
        t(BADGES.bug_hunter[0]),
        t(BADGES.bug_hunter[1]),
      ];

      await report.step(
        `${at}: ${phone ? "a tap" : "hover"} shows the name and text`,
        async () => {
          if (phone) await bug().tap();
          else await bug().hover();
          await tipLocator(page, bugName).waitFor({ timeout: 5000 });
          await tipLocator(page, bugText).waitFor({ timeout: 5000 });
        },
      );

      await report.step(`${at}: the text goes away again`, async () => {
        if (phone) await page.locator("h2").first().tap({ force: true });
        else await page.mouse.move(2, 2);
        await tipLocator(page, bugName).waitFor({
          state: "hidden",
          timeout: 5000,
        });
      });

      if (!phone)
        await report.step(`${at}: a keyboard reaches a badge`, async () => {
          await bug().evaluate((el) => {
            el.previousElementSibling?.focus();
            el.parentElement.previousElementSibling
              ?.querySelector("button")
              ?.focus();
          });
          await page.keyboard.press("Tab");
          assert(
            await bug().evaluate((el) => el === document.activeElement),
            "focus is not on the badge",
          );
          await tipLocator(page, bugName).waitFor({ timeout: 5000 });
          await page.keyboard.press("Shift+Tab");
        });

      if (shotsDir) {
        for (const mode of ["dark", "light"]) {
          await report.step(`${at}: review shots, ${mode}`, async () => {
            await setMode(page, mode);
            await page.reload();
            const open = await openProfile(page, seen, t, phone);
            const base = `${shotsDir}${locale}-${name}-${mode}`;
            await page.screenshot({ path: `${base}-profile.png` });
            for (const id of PROFILE_BADGES) {
              const one = open.locator(`[data-badge-id="${id}"]`);
              await one.scrollIntoViewIfNeeded();
              if (phone) await one.tap();
              else await one.hover();
              await tipLocator(page, t(BADGES[id][0])).waitFor({
                timeout: 5000,
              });
              await page.waitForTimeout(120);
              await page.screenshot({ path: `${base}-${id}.png` });
              if (phone) await one.tap();
              else await page.mouse.move(2, 2);
              await tipLocator(page, t(BADGES[id][0])).waitFor({
                state: "hidden",
                timeout: 5000,
              });
            }
          });
        }
        await setMode(page, "dark");
        await page.reload();
      }

      await report.step(
        `${at}: the member list uses the shared badge`,
        async () => {
          await openChannel(page, seen);
          if (phone) {
            await page
              .getByRole("button", { name: t("Member list") })
              .first()
              .tap();
          }
          const owner = page.locator('[data-badge-id="server_owner"]').first();
          await owner.waitFor({ timeout: 20000 });
          const box = await owner.boundingBox();
          assert(
            box.width === 16 && box.height === 16,
            `owner mark ${box.width}`,
          );
          const old = await page
            .locator('img[src*="badges/essential"]')
            .count();
          assert(old === 0, `${old} old badge images`);
          if (!phone) {
            await owner.hover();
            await tipLocator(page, t("Server owner")).waitFor({
              timeout: 5000,
            });
            await page.mouse.move(2, 2);
          }
        },
      );

      await report.step(
        `${at}: a bot has the same tag in the list`,
        async () => {
          assert(seen.bot, "the dev account has no friend to show as a bot");
          await page
            .getByText(t("Bot"), { exact: true })
            .first()
            .waitFor({ timeout: 10000 });
        },
      );

      await report.step(
        `${at}: the server header shows its badge`,
        async () => {
          // a phone shows the channel list on its own page
          if (phone) await page.goto(`${APP}/server/${seen.server}`);
          const seal = page
            .locator('[data-badge-id="server_verified"]')
            .first();
          await seal.waitFor({ timeout: 20000 });
          const box = await seal.boundingBox();
          assert(box.width === 16, `seal ${box.width}`);
        },
      );

      if (!phone)
        await report.step(
          `${at}: a message by a bot has the same tag`,
          async () => {
            await openChannel(page, seen);
            await page
              .locator("main, [role=main]")
              .first()
              .getByText(t("Bot"), { exact: true })
              .first()
              .waitFor({ timeout: 20000 });
          },
        );

      /** Hover or tap: both lines of text show, then go away */
      const reads = async (one, title, text) => {
        if (phone) await one.tap();
        else await one.hover();
        await tipLocator(page, t(title)).waitFor({ timeout: 5000 });
        await tipLocator(page, t(text)).waitFor({ timeout: 5000 });
        if (phone) await one.tap();
        else await page.mouse.move(2, 2);
        await tipLocator(page, t(title)).waitFor({
          state: "hidden",
          timeout: 5000,
        });
      };
      const shot = async (surface) => {
        if (shotsDir)
          await page.screenshot({
            path: `${shotsDir}${locale}-${name}-${surface}.png`,
          });
      };
      const menu = async (item) => {
        const button = page.getByRole("button", { name: t("Server menu") });
        await button.first().waitFor({ timeout: 20000 });
        await button.first().click();
        await page.getByText(t(item), { exact: true }).first().click();
      };
      /** A phone opens the last channel: the header is one step back */
      const showServer = async (id) => {
        await page.goto(`${APP}/server/${id}`);
        if (!phone) return;
        const back = page
          .getByRole("button", {
            name: new RegExp(`^(${t("Back")}|${t("Toggle main sidebar")})$`),
          })
          .first();
        await back.waitFor({ timeout: 15000 });
        await back.tap();
      };
      const settingsItem = async (text) => {
        await page.goto(`${APP}/settings`, { waitUntil: "domcontentloaded" });
        const row = page.getByText(text, { exact: true }).first();
        await row.waitFor({ timeout: 20000 });
        await row.scrollIntoViewIfNeeded();
        await row.click();
      };

      await report.step(`${at}: a verified bot reads as verified`, async () => {
        await openChannel(page, seen);
        if (phone)
          await page
            .getByRole("button", { name: t("Member list") })
            .first()
            .tap();
        // inside the member list: messages show the same name
        const row = page
          .locator('[data-badge-id="server_owner"]')
          .first()
          .locator(
            `xpath=ancestor::*[.//text()[contains(., "${seen.botName}")]][1]`,
          )
          .getByText(seen.botName, { exact: true })
          .first();
        await row.waitFor({ timeout: 20000 });
        // the check inside the Bot tag is the one verified mark (no second seal)
        // the one inside the open profile, not the member list or a message
        const seal = usernameOf(page)
          .locator("xpath=ancestor::*[.//*[@data-verified-bot]][1]")
          .locator("[data-verified-bot]")
          .first();
        // a phone slides the list in: a tap during that goes nowhere
        for (let i = 0; i < 2 && !(await seal.isVisible()); i++) {
          if (phone) await row.tap({ force: true });
          else await row.click();
          // long enough for the sheet: a second tap would land on its backdrop
          await seal.waitFor({ timeout: 10000 }).catch(() => {});
        }
        await seal.waitFor({ timeout: 4000 });
        await reads(seal, "Verified bot", "The Zrzur team reviewed this bot.");
        assert(
          (await page.locator('[data-badge-id="bot_verified"]').count()) === 0,
          "a second verified seal beside the Bot tag",
        );
        if (phone) await edgesPress(usernameOf(page));
        await shot("verified-bot");
      });

      for (const [title, target, id, label, text] of [
        [
          "verified",
          () => seen.server,
          "server_verified",
          "Verified server",
          "The Zrzur team confirmed who runs this server.",
        ],
        [
          "official",
          () => seen.official,
          "server_official",
          "Official Zrzur server",
          "Run by the Zrzur team.",
        ],
      ])
        await report.step(
          `${at}: ${title} server, header and info`,
          async () => {
            assert(target(), "the dev account owns only one server");
            await showServer(target());
            const mark = page.locator(`[data-badge-id="${id}"]`).first();
            await mark.waitFor({ timeout: 20000 });
            const box = await mark.boundingBox();
            assert(
              box.width === 16 && box.height === 16,
              `header ${box.width}`,
            );
            if (!phone) {
              await mark.hover();
              await tipLocator(page, t(label)).waitFor({ timeout: 5000 });
              await page.mouse.move(2, 2);
            }
            await menu("Server info");
            const dialog = page.getByRole("dialog").last();
            const pressable = dialog.locator(`button[data-badge-id="${id}"]`);
            await pressable.waitFor({ timeout: 20000 });
            await reads(pressable, label, text);
            const [seal, title2] = await Promise.all([
              pressable.boundingBox(),
              dialog.locator("h1, h2, h3").first().boundingBox(),
            ]);
            if (seal && title2) {
              const mirrored = seal.x < title2.x + title2.width / 2;
              assert(
                mirrored === (locale === "ar"),
                `badge at ${seal.x}, name at ${title2.x}`,
              );
            }
            if (phone) await edgesPress(pressable);
            await shot(`server-info-${title}`);
            await page.keyboard.press("Escape");
          },
        );

      await report.step(`${at}: server settings, members`, async () => {
        await showServer(seen.server);
        await menu("Open server settings");
        // heading, then the sidebar row; later matches are switches on the
        // page, never to be pressed
        const members = page.getByText(t("Members"), { exact: true }).nth(1);
        await members.waitFor({ timeout: 20000 });
        await members.click();
        const owner = page.locator('[data-badge-id="server_owner"]').last();
        await owner.waitFor({ timeout: 20000 });
        const box = await owner.boundingBox();
        assert(box.width === 16, `owner mark ${box.width}`);
        await page
          .getByText(t("Bot"), { exact: true })
          .last()
          .waitFor({ timeout: 10000 });
        if (!phone) {
          await owner.hover();
          await tipLocator(page, t("Server owner")).waitFor({ timeout: 5000 });
          await page.mouse.move(2, 2);
        }
        await shot("server-settings-members");
      });

      await report.step(`${at}: hidden, past and locked badges`, async () => {
        // the catalog helper finds a shorter "Profile" in Arabic than this row
        await settingsItem(locale === "ar" ? "الملف الشخصي" : t("Profile"));
        const tab = page.getByText(t("Badges"), { exact: true }).first();
        await tab.waitFor({ timeout: 20000 });
        await tab.click();
        const quiet = page.locator('[data-state="quiet"]');
        const locked = page.locator('[data-state="locked"]');
        await quiet.first().waitFor({ timeout: 20000 });
        await locked.first().waitFor({ timeout: 20000 });
        assert((await quiet.count()) >= 2, `${await quiet.count()} quiet`);
        assert((await locked.count()) >= 1, `${await locked.count()} locked`);
        for (const one of [quiet.first(), locked.first()]) {
          await one.scrollIntoViewIfNeeded();
          await page.mouse.move(2, 2);
          const opacity = await one.evaluate(
            (el) => getComputedStyle(el).opacity,
          );
          assert(Number(opacity) === 0.6, `opacity ${opacity}`);
        }
        await shot("locked-and-quiet");
      });

      await report.step(`${at}: Feather uses the Feather badge`, async () => {
        await settingsItem(t("Zrzur Feather"));
        const art = page.locator('svg[data-badge="plus"]');
        await art.first().waitFor({ timeout: 20000 });
        assert((await art.count()) >= 2, `${await art.count()} feathers`);
        const old = await page.locator('img[src*="badges/essential"]').count();
        assert(old === 0, `${old} old badge images`);
        await shot("feather");
      });

      await report.step(`${at}: Discover cards and page`, async () => {
        await page.goto(`${APP}/discover`);
        const seal = page.locator('[data-badge-id="server_verified"]').first();
        await seal.waitFor({ timeout: 20000 });
        await seal.scrollIntoViewIfNeeded();
        const box = await seal.boundingBox();
        assert(box.width === 16 && box.height === 16, `seal ${box.width}`);
        if (!phone) {
          await seal.hover();
          await tipLocator(page, t("Verified server")).waitFor({
            timeout: 5000,
          });
        }
        await shot("discover");
      });

      await report.step(`${at}: Discover, verified bot`, async () => {
        await page.getByText(t("Bots"), { exact: true }).first().click();
        const seal = page.locator('[data-badge-id="bot_verified"]').first();
        await seal.waitFor({ timeout: 20000 });
        const box = await seal.boundingBox();
        assert(box.width === 16 && box.height === 16, `seal ${box.width}`);
        if (!phone) {
          await seal.hover();
          await tipLocator(page, t("Verified bot")).waitFor({ timeout: 5000 });
        }
        await seal.click({ force: true });
        await page
          .getByText(t("Verified"), { exact: true })
          .first()
          .waitFor({ timeout: 20000 });
        await botTagNear(page.getByText("Fixture listing").last(), t("Bot"));
        await shot("discover-bot");
        await page.keyboard.press("Escape");
      });

      await report.step(`${at}: a bot invite in a message`, async () => {
        await openChannel(page, seen);
        const line = page.getByText("Fixture listing").first();
        await line.waitFor({ timeout: 20000 });
        await line.scrollIntoViewIfNeeded();
        await botTagNear(line, t("Bot"));
        await shot("bot-invite");
      });

      await report.step(`${at}: no page errors`, async () => {
        assert(!errors.length, errors.join(" | ").slice(0, 300));
      });
    } finally {
      await report.step(`${at}: logs out`, async () => {
        assert(
          await logOut(signedIn, t),
          "logged out by the API, not the page",
        );
      });
      await context.close();
    }
  }
}

// a sign-in that failed after the server answered
await Promise.all([...live].map(endSession));
await browser.close();
process.exit(report.done() ? 1 : 0);
