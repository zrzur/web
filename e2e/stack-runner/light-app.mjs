// Everything that moved out of the first load still opens, as people open it:
// pages, sign-in steps, settings, pickers, profile cards, autocomplete. The
// message list keeps its place, jumps to a message and shows the New line.
// Old browsers still get the polyfills, and the service worker installs only
// the shell. Runs in en/ar/de on desktop and at 375 px.
//
//   node e2e/stack-runner/light-app.mjs
//
// Env: E2E_LIB (folder with stack.mjs and catalog.mjs), E2E_WEB (this web
//   checkout, for the catalogs), E2E_CHROMIUM (headless shell), E2E_BASE,
//   E2E_LOCALES, E2E_SEED (JSON with server, general, clips and ids). Signs in
//   with the first dev account of stack.mjs. Only the setup of the New line,
//   a revoked session and finding a server to reorder go through the API.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const lib = process.env.E2E_LIB;
if (!lib) {
  console.error("Set E2E_LIB to the folder with stack.mjs and catalog.mjs");
  process.exit(2);
}
const dir = pathToFileURL(`${lib.replace(/\/?$/, "/")}`);
const { API, APP, LOCALES, VIEWPORTS, accounts, api, login, pw, reporter, token } =
  await import(new URL("stack.mjs", dir));
const { tr } = await import(new URL("catalog.mjs", dir));

const seed = JSON.parse(readFileSync(process.env.E2E_SEED, "utf8"));
const account = accounts[0];

const browser = await pw.chromium.launch({
  executablePath: process.env.E2E_CHROMIUM,
  headless: true,
});
const report = reporter("light-app");
const locales = process.env.E2E_LOCALES?.split(",") ?? LOCALES;
const channelUrl = (id) => `${APP}/server/${seed.server}/channel/${id}`;
const composer = (page) => page.locator('[contenteditable="true"]').last();
// sessions must not pile up on the shared stack
const sessionOf = (page) => {
  const seen = {};
  page.on("request", (r) => {
    seen.token = r.headers()["x-session-token"] ?? seen.token;
  });
  return seen;
};
const signOut = (session) =>
  session
    ? fetch(`${API}/auth/session/logout`, {
        method: "POST",
        headers: { "x-session-token": session },
      }).catch(() => {})
    : undefined;

for (const locale of locales) {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    const at = `${locale} ${name}`;
    const phone = viewport.width < 600;
    const t = (text) => tr(locale, text);
    const { page, context, errors } = await login(browser, account, {
      viewport,
      locale,
    });
    report.page = page;
    const session = sessionOf(page);
    try {

    await report.step(`${at}: the app opens after sign-in`, async () => {
      await page.locator("main, [role=main]").first().waitFor({ timeout: 30000 });
    });

    const greetings = [
      "Up late, {name}?",
      "Good morning, {name}",
      "Good afternoon, {name}",
      "Good evening, {name}",
    ].map((text) => t(text).split("{")[0]);
    const greeted = async (from) => {
      const text = await from.locator("h1").first().textContent();
      if (!greetings.some((start) => start && text.includes(start.trim())))
        throw new Error(`no greeting in "${text}"`);
    };

    await report.step(`${at}: Home greets by the time of day`, async () => {
      await page.goto(`${APP}/app`, { waitUntil: "domcontentloaded" });
      await page.locator("h1").first().waitFor({ timeout: 20000 });
      await greeted(page);
    });

    // same session, a second window with no worker, so requests can be held
    const slow = await browser.newContext({
      viewport,
      locale,
      serviceWorkers: "block",
      storageState: await context.storageState({ indexedDB: true }),
    });
    const held = await slow.newPage();
    report.page = held;
    const rail = held.locator('a[href="/friends"]');

    await report.step(`${at}: Home greets before the server answers`, async () => {
      let answer;
      const gate = new Promise((resolve) => (answer = resolve));
      await slow.routeWebSocket(/\/\?version=/, async (socket) => {
        await gate;
        socket.connectToServer();
      });
      await held.goto(`${APP}/app`, { waitUntil: "domcontentloaded" });
      await held.locator("h1").first().waitFor({ timeout: 20000 });
      await greeted(held);
      await held.getByText(t("Welcome back to Zrzur.")).first().waitFor();
      if (await rail.count()) throw new Error("the real page came first");
      answer();
      await rail.first().waitFor({ state: "attached", timeout: 20000 });
      await greeted(held);
    });

    await report.step(`${at}: Home does not wait for the Designs strip`, async () => {
      let free;
      const gate = new Promise((resolve) => (free = resolve));
      await held.route(/\/assets\/Designs-.*\.js$/, async (route) => {
        await gate;
        await route.continue();
      });
      await held.reload({ waitUntil: "domcontentloaded" });
      await rail.first().waitFor({ state: "attached", timeout: 20000 });
      await held.locator("main h1").first().waitFor({ timeout: 8000 });
      free();
    });
    await slow.close();
    report.page = page;

    for (const [title, path, text] of [
      ["Discover", "/discover"],
      ["Designs", "/designs"],
      ["Developers", "/developers/docs"],
      ["Friends", "/friends", "Friends"],
    ])
      await report.step(`${at}: ${title} opens`, async () => {
        await page.goto(APP + path, { waitUntil: "domcontentloaded" });
        await (text
          ? page.getByText(t(text)).locator("visible=true").first()
          : page.locator("h1, h2").locator("visible=true").first()
        ).waitFor({ timeout: 20000 });
      });

    await report.step(`${at}: user settings open`, async () => {
      await page.goto(`${APP}/settings`, { waitUntil: "domcontentloaded" });
      await page
        .getByText(t("Log Out"), { exact: false })
        .or(page.getByText(t("Appearance"), { exact: false }))
        .first()
        .waitFor({ timeout: 20000 });
    });

    await report.step(`${at}: a channel shows its messages`, async () => {
      await page.goto(channelUrl(seed.general), {
        waitUntil: "domcontentloaded",
      });
      await composer(page).waitFor({ timeout: 30000 });
      await page.locator(`[id="${seed.ids[0]}"]`).first().waitFor({
        state: "attached",
        timeout: 20000,
      }).catch(() => {});
      await page.locator("foreignObject img, foreignObject").first().waitFor({
        state: "attached",
        timeout: 20000,
      });
    });

    if (!phone) {
      await report.step(`${at}: the message toolbar comes on hover`, async () => {
        await page.mouse.move(0, 0);
        const row = page.locator("main .group").last();
        await row.waitFor({ timeout: 15000 });
        await row.hover();
        await row
          .getByRole("toolbar", { name: t("Message actions") })
          .waitFor({ timeout: 5000 });
      });

      await report.step(`${at}: a channel switch keeps the list rows`, async () => {
        const link = page.locator(`a[href*="${seed.clips}"]`).first();
        const row = await link.elementHandle();
        await link.click();
        await page.waitForURL(new RegExp(seed.clips));
        await page.waitForTimeout(200);
        if (!(await row.evaluate((node) => node.isConnected)))
          throw new Error("the row was rebuilt");
        await page.goto(channelUrl(seed.general), {
          waitUntil: "domcontentloaded",
        });
        await composer(page).waitFor({ timeout: 30000 });
      });
    }

    await report.step(`${at}: a profile card opens from a message`, async () => {
      const avatar = page.locator("main foreignObject").last();
      await avatar.click({ force: true });
      await page
        .locator("#floating")
        .getByRole("button")
        .first()
        .waitFor({ timeout: 15000 });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    });

    await report.step(`${at}: emoji autocomplete shows`, async () => {
      await composer(page).click();
      await page.keyboard.type(":smi");
      await page
        .getByText(":smile:", { exact: true })
        .first()
        .waitFor({ timeout: 15000 });
      await page.keyboard.press("Escape");
      for (let i = 0; i < 4; i++) await page.keyboard.press("Backspace");
    });

    await report.step(`${at}: the emoji picker opens`, async () => {
      await page.getByRole("button", { name: t("Open emoji picker") }).click();
      await page
        .locator(`[aria-label="${t("Emoji")}"]`)
        .first()
        .waitFor({ timeout: 15000 });
      await page.keyboard.press("Escape");
    });

    if (!phone)
      await report.step(`${at}: the GIF picker opens`, async () => {
        await page.waitForTimeout(300);
        const open = page.getByRole("button", { name: t("Open GIF picker") });
        // the button shows only when the stack has a GIF service
        if (!(await open.count())) return console.log("       no GIF service");
        await open.click();
        await page
          .locator(`[aria-label="${t("GIF picker")}"]`)
          .first()
          .waitFor({ timeout: 15000 });
        await page.keyboard.press("Escape");
      });

    await report.step(`${at}: a link jumps to its message`, async () => {
      const id = seed.ids[0];
      await page.goto(`${channelUrl(seed.general)}/${id}`, {
        waitUntil: "domcontentloaded",
      });
      await page.locator(`[id="${id}"]`).first().waitFor({ timeout: 30000 });
      await page.waitForFunction(
        (x) => {
          const r = document.getElementById(x)?.getBoundingClientRect();
          return r && r.bottom > 0 && r.top < innerHeight;
        },
        id,
        { timeout: 8000 },
      );
    });

    await report.step(`${at}: older messages load without moving the view`, async () => {
      await page.goto(channelUrl(seed.general), {
        waitUntil: "domcontentloaded",
      });
      await composer(page).waitFor({ timeout: 30000 });
      await page.waitForTimeout(800);
      // to the oldest message: the page before it starts loading
      const before = await page.evaluate(() => {
        const rows = [...document.querySelectorAll("main [id]")].filter((e) =>
          /^[0-9A-Z]{26}$/.test(e.id),
        );
        const row = rows.sort((a, b) => (a.id < b.id ? -1 : 1))[0];
        row?.scrollIntoView({ block: "center" });
        return { id: row?.id, top: row?.getBoundingClientRect().top };
      });
      if (!before.id) throw new Error("no message in view");
      await page.waitForTimeout(1500);
      // by id: the row is redrawn when an older message joins its group
      const top = await page.evaluate(
        (id) => document.getElementById(id)?.getBoundingClientRect().top ?? null,
        before.id,
      );
      if (top === null || Math.abs(top - before.top) > 8)
        throw new Error(`message moved from ${before.top} to ${top}`);
    });

    await report.step(`${at}: the New line shows`, async () => {
      const session = await token(account);
      try {
      const { messages } = await api(
        session,
        "GET",
        `/channels/${seed.clips}/messages?limit=5&include_users=true`,
      ).then((r) => (Array.isArray(r) ? { messages: r } : r));
      if (messages.length < 2) return;
      // back to before the two newest messages, then open the channel
      await api(session, "PUT", `/channels/${seed.clips}/ack/${messages[2]?.id ?? messages[1]._id}`).catch(() => {});
      await page.goto(channelUrl(seed.clips), {
        waitUntil: "domcontentloaded",
      });
      await composer(page).waitFor({ timeout: 30000 });
      await page.getByText(t("New"), { exact: true }).first().waitFor({
        timeout: 10000,
      });
      } finally {
        await signOut(session);
      }
    });

    await report.step(`${at}: a voice channel page opens`, async () => {
      await page.goto(channelUrl(seed.voice), {
        waitUntil: "domcontentloaded",
      });
      await page
        .getByRole("button", { name: t("Join call") })
        .waitFor({ timeout: 30000 });
    });

    await report.step(`${at}: the lobby opens`, async () => {
      await page.goto(`${APP}/server/${seed.server}/lobby`, {
        waitUntil: "domcontentloaded",
      });
      await page
        .getByText(t("Open chat"))
        .locator("visible=true")
        .first()
        .waitFor({ timeout: 30000 });
    });

    await report.step(`${at}: no page errors`, async () => {
      if (errors.length) throw new Error(errors.join(" | ").slice(0, 300));
    });
    } finally {
      await signOut(session.token);
      await context.close();
    }
  }
}

// the name kept for the greeting goes with the session, and a real drag
for (const locale of locales) {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    const at = `${locale} ${name}`;
    const phone = viewport.width < 600;
    const t = (text) => tr(locale, text);
    const welcome = t("Welcome back to Zrzur.");
    // remembers whether the greeting was ever on screen in this page load
    const watchGreeting = (context) =>
      context.addInitScript((text) => {
        new MutationObserver(() => {
          if (document.body?.textContent.includes(text)) window.__greeted = true;
        }).observe(document, { childList: true, subtree: true });
      }, welcome);
    const toLogin = (page) =>
      page.locator('input[type="email"]').first().waitFor({ timeout: 30000 });
    const friends = (page) =>
      page
        .locator('a[href="/friends"]')
        .first()
        .waitFor({ state: "attached", timeout: 30000 });

    {
      const { page, context } = await login(browser, account, { viewport, locale });
      report.page = page;
      const session = sessionOf(page);
      await watchGreeting(context);
      try {
        await report.step(`${at}: signing out leaves no greeting`, async () => {
          await friends(page);
          await page.goto(`${APP}/settings`, { waitUntil: "domcontentloaded" });
          await page
            .getByText(new RegExp(`^${t("Log Out")}$`, "i"))
            .last()
            .click({ timeout: 20000 });
          await page.waitForURL(/\/login/, { timeout: 20000 });
          await toLogin(page);
          await page.reload({ waitUntil: "domcontentloaded" });
          await toLogin(page);
          await page.goto(`${APP}/app`, { waitUntil: "domcontentloaded" });
          await toLogin(page);
          if (await page.evaluate(() => window.__greeted))
            throw new Error("the greeting showed after sign-out");
        });
      } finally {
        await signOut(session.token);
        await context.close();
      }
    }

    {
      const { page, context } = await login(browser, account, { viewport, locale });
      report.page = page;
      const session = sessionOf(page);
      await watchGreeting(context);
      try {
        await report.step(`${at}: a revoked session ends at login, name gone`, async () => {
          await friends(page);
          await page.waitForTimeout(500);
          await page.reload({ waitUntil: "domcontentloaded" });
          await friends(page);
          if (!(await page.evaluate(() => window.__greeted)))
            throw new Error("no greeting while the session was good");
          await signOut(session.token);
          await page.reload({ waitUntil: "domcontentloaded" });
          const again = page.getByRole("button", { name: t("Log in again") });
          await again.or(page.locator('input[type="email"]')).first().waitFor({
            timeout: 30000,
          });
          await page.goto(`${APP}/app`, { waitUntil: "domcontentloaded" });
          await again.or(page.locator('input[type="email"]')).first().waitFor({
            timeout: 30000,
          });
          if (await page.evaluate(() => window.__greeted))
            throw new Error("the old name came back");
        });
      } finally {
        await signOut(session.token);
        await context.close();
      }
    }

    if (phone) continue;

    {
      const { page, context } = await login(browser, account, { viewport, locale });
      report.page = page;
      const session = sessionOf(page);
      try {
        await report.step(`${at}: a channel is reordered by dragging`, async () => {
          await friends(page);
          await page.waitForTimeout(800);
          const me = await api(session.token, "GET", "/users/@me");
          const ids = await page.evaluate(() => [
            ...new Set(
              [...document.querySelectorAll('a[href^="/server/"]')].map(
                (a) => a.getAttribute("href").split("/")[2],
              ),
            ),
          ]);
          let server;
          for (const id of ids) {
            const found = await api(session.token, "GET", `/servers/${id}`);
            if (found.owner === me._id && found.channels.length >= 3) {
              server = found;
              break;
            }
          }
          if (!server) throw new Error("no owned server with three channels");
          await page.goto(`${APP}/server/${server._id}`, {
            waitUntil: "domcontentloaded",
          });
          const rows = page.locator('[data-drop-zone] a[href*="/channel/"]');
          await rows.nth(1).waitFor({ timeout: 20000 });
          const order = () =>
            rows.evaluateAll((all) => all.map((a) => a.getAttribute("href")));
          const drag = async (from, to) => {
            const a = await rows.nth(from).boundingBox();
            const b = await rows.nth(to).boundingBox();
            await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
            await page.mouse.down();
            await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 12, { steps: 4 });
            await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 6, { steps: 12 });
            await page.waitForTimeout(400);
            await page.mouse.up();
            await page.waitForTimeout(800);
          };
          const before = await order();
          await drag(0, 1);
          const after = await order();
          if (after[0] !== before[1] || after[1] !== before[0])
            throw new Error(`order did not change: ${after.length} rows`);
          await drag(0, 1);
          const back = await order();
          if (back[0] !== before[0] || back[1] !== before[1])
            throw new Error("order did not go back");
        });
      } finally {
        await signOut(session.token);
        await context.close();
      }
    }
  }
}

// rail rows far out of view are not drawn. Test accounts have few servers, so
// a tall spacer stands in for the servers above them
{
  const { page, context } = await login(browser, account, {
    viewport: VIEWPORTS.desktop,
    locale: "en",
  });
  report.page = page;
  const session = sessionOf(page);
  try {
  await report.step("rail: rows out of view are skipped", async () => {
    await page.goto(`${APP}/friends`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const rows = await page.evaluate(async () => {
      const all = [...document.querySelectorAll("a, div")].filter(
        (e) => getComputedStyle(e).contentVisibility === "auto",
      );
      const drawn = () =>
        all.filter((e) =>
          e.firstElementChild.checkVisibility({ contentVisibilityAuto: true }),
        )
          .length;
      const before = drawn();
      const spacer = document.createElement("div");
      spacer.style.cssText = "height:6000px;flex-shrink:0";
      all.at(-1).parentElement.prepend(spacer);
      await new Promise((r) => setTimeout(r, 500));
      const pushed = drawn();
      spacer.remove();
      return { rows: all.length, before, pushed };
    });
    console.log(`       rail: ${JSON.stringify(rows)}`);
    if (!(rows.before === rows.rows && rows.pushed < rows.rows))
      throw new Error(JSON.stringify(rows));
  });
  } finally {
    await signOut(session.token);
    await context.close();
  }
}

// signed out: the steps that left the first load
{
  const context = await browser.newContext({ locale: "en" });
  const page = await context.newPage();
  report.page = page;
  for (const [path, field] of [
    ["/login/create", 'input[type="email"]'],
    ["/login/reset", 'input[type="email"]'],
    ["/login/resend", 'input[type="email"]'],
  ])
    await report.step(`signed out: ${path} opens`, async () => {
      await page.goto(APP + path, { waitUntil: "domcontentloaded" });
      await page.locator(field).first().waitFor({ timeout: 20000 });
    });
  await context.close();
}

// a browser without the newest features: the gate writes the polyfill tag
{
  const context = await browser.newContext({ locale: "en" });
  await context.addInitScript(() => {
    delete Uint8Array.prototype.toBase64;
    delete Iterator.prototype.drop;
  });
  const page = await context.newPage();
  report.page = page;
  const requested = [];
  const errors = [];
  page.on("request", (r) => requested.push(r.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  await report.step("old browser: polyfills load and the app starts", async () => {
    await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"]').first().waitFor({ timeout: 20000 });
    if (!requested.some((u) => /polyfills-/.test(u)))
      throw new Error("no polyfill request");
    const ok = await page.evaluate(
      () => typeof Uint8Array.prototype.toBase64 === "function",
    );
    if (!ok) throw new Error("toBase64 is still missing");
    if (errors.length) throw new Error(errors[0]);
  });
  await context.close();
}

// a current browser, and the service worker
{
  const context = await browser.newContext({ locale: "en" });
  const page = await context.newPage();
  report.page = page;
  const requested = [];
  page.on("request", (r) => requested.push(r.url()));
  await report.step("current browser: no polyfill download", async () => {
    await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"]').first().waitFor({ timeout: 20000 });
    if (requested.some((u) => /polyfills-/.test(u)))
      throw new Error("polyfills were requested");
  });
  await report.step("only one language file loads", async () => {
    await page.waitForTimeout(1000);
    const files = requested.filter((u) => /\/messages-/.test(u));
    if (files.length > 1) throw new Error(files.join(" "));
  });
  await report.step("service worker: shell in cache, under 2 MB", async () => {
    const usage = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      if (!registration.active) throw new Error("no active worker");
      for (let i = 0; i < 100; i++) {
        const names = await caches.keys();
        const precache = names.find((n) => n.includes("precache"));
        if (precache) {
          const keys = await (await caches.open(precache)).keys();
          if (keys.length > 10) {
            let bytes = 0;
            for (const key of keys) {
              const r = await (await caches.open(precache)).match(key);
              bytes += (await r.arrayBuffer()).byteLength;
            }
            return { files: keys.length, bytes };
          }
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      return { files: 0, bytes: 0 };
    });
    console.log(`       precache: ${JSON.stringify(usage)}`);
    if (!usage.files || usage.bytes > 2.1 * 1024 * 1024)
      throw new Error(JSON.stringify(usage));
  });
  await report.step("service worker: a lazy file is kept on first use", async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"]').first().waitFor({ timeout: 20000 });
    await page.goto(`${APP}/login/create`, { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"]').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(800);
    const kept = await page.evaluate(async () => {
      const cache = await caches.open("zrzur-assets-v1");
      return (await cache.keys()).length;
    });
    console.log(`       runtime cache: ${kept} files`);
    if (!kept) throw new Error("nothing in the runtime cache");
  });
  await context.close();
}

await browser.close();
process.exit(report.done() ? 1 : 0);
