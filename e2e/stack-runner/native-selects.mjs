// The server choice on the OAuth consent page and the redirect URI in the
// Developer Portal use the design-system menu: a person opens it, picks with
// the pointer or the keyboard, and the choice reaches the OAuth request. Runs
// in en/ar/de on desktop and at 375 px.
//
//   node e2e/stack-runner/native-selects.mjs
//
// Env: E2E_LIB (folder with stack.mjs and catalog.mjs), E2E_WEB (this web
//   checkout, for the catalogs), E2E_CHROMIUM (headless shell), E2E_BASE,
//   E2E_LOCALES, E2E_VIEWPORTS, E2E_SHOTS (folder for screenshots). Uses the
//   first account of dev-stack-accounts.json and logs out.
//
// Sign-in, the bot list and the pages are real. Three answers are fixtures:
// the consent preview, as a real one needs a registered redirect and PKCE;
// the approve request, which is read at the browser and answered here, as a
// real one would add a bot to a server; and the bot's redirect URIs, as the
// dev bots have none. Nothing is written to the stack.
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

const SERVERS = [
  { _id: "01FIXTURESERVERONE00000000", name: "Speed test" },
  { _id: "01FIXTURESERVERTWO00000000", name: "ربع الحارة" },
];
const REDIRECTS = [
  "https://one.example/callback",
  "https://two.example/back",
  "https://a-very-long-subdomain-of-an-application.example/oauth2/callback/with/a/long/path",
];

const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};

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
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const session = {};
  const state = { servers: SERVERS, sent: [], answer: "ok" };
  page.on("response", async (response) => {
    if (!response.url().endsWith("/auth/session/login")) return;
    const body = await response.json().catch(() => undefined);
    if (body?.token) {
      session.token = body.token;
      live.add(session);
    }
  });
  await context.route(/\/oauth2\/authorize(\?|$)/, (route) => {
    const request = route.request();
    // the page has the same path as the API
    if (!request.url().startsWith(API)) return route.fallback();
    if (request.method() === "GET")
      return route.fulfill({
        json: {
          application: { _id: "01FIXTUREBOT", username: "fixture-bot" },
          scopes: ["bot.install"],
          redirect_uri: "https://one.example/callback",
          verified: false,
          servers: state.servers,
          permissions: 0,
        },
      });
    if (request.method() !== "POST") return route.fallback();
    state.sent.push(request.postDataJSON());
    return state.answer === "ok"
      ? route.fulfill({ json: { redirect: `${APP}/app` } })
      : route.fulfill({ status: 409, json: { type: "AlreadyInServer" } });
  });
  await context.route(/\/applications\/[^/]+\/oauth$/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const response = await route.fetch();
    const body = await response.json();
    return route.fulfill({
      response,
      json: { ...body, redirect_uris: REDIRECTS },
    });
  });
  await page.goto(`${APP}/login`);
  await page.locator('input[type="email"]').fill(accounts[0].email);
  await page.locator('input[type="password"]').fill(accounts[0].password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 30000,
  });
  return { page, context, session, state, errors };
}

async function logOut({ page, session }, t) {
  let viaPage = false;
  try {
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

const report = reporter("native-selects");
const browser = await pw.chromium.launch({
  executablePath: process.env.E2E_CHROMIUM,
  headless: true,
});
const locales = process.env.E2E_LOCALES?.split(",") ?? LOCALES;
const only = process.env.E2E_VIEWPORTS?.split(",");
const shotsDir = process.env.E2E_SHOTS?.replace(/\/?$/, "/");
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

for (const locale of locales) {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    if (only && !only.includes(name)) continue;
    const at = `${locale} ${name}`;
    const phone = viewport.width < 600;
    const t = (text) => tr(locale, text);
    const signedIn = await signIn(browser, { viewport, locale });
    const { page, context, session, state, errors } = signedIn;
    report.page = page;
    const press = (target) => (phone ? target.tap() : target.click());
    const shot = async (surface) => {
      if (shotsDir)
        await page.screenshot({
          path: `${shotsDir}${locale}-${name}-${surface}.png`,
        });
    };
    const consent = () =>
      page.goto(
        `${APP}/oauth2/authorize?client_id=01FIXTUREBOT&response_type=code&scope=bot.install`,
      );
    const trigger = page.locator("#oauth-server");
    const authorize = page.getByRole("button", { name: t("Authorize") });
    const item = (text) => page.getByRole("menuitem", { name: text });
    try {
      await report.step(
        `${at}: the server choice is a menu, named`,
        async () => {
          await consent();
          await trigger.waitFor({ timeout: 20000 });
          assert(!(await page.locator("select").count()), "a native select");
          const box = await trigger.boundingBox();
          assert(box.height >= (phone ? 44 : 36), `height ${box.height}`);
          const named = page.getByRole("button", { name: t("Add to server") });
          assert(await named.count(), "the label does not name the menu");
          const shown = (await trigger.innerText()).trim();
          assert(shown === t("Choose a server…"), `shows ${shown}`);
          assert(
            await authorize.isDisabled(),
            "Authorize works with no server",
          );
        },
      );

      await report.step(`${at}: it follows the reading direction`, async () => {
        const [value, caret] = await trigger.evaluate((el) =>
          [el.firstElementChild, el.lastElementChild].map(
            (part) => part.getBoundingClientRect().left,
          ),
        );
        assert(
          locale === "ar" ? caret < value : caret > value,
          `caret ${caret}, value ${value}`,
        );
      });

      await report.step(
        `${at}: picking a server enables Authorize`,
        async () => {
          await press(trigger);
          const row = item(SERVERS[1].name);
          await row.waitFor({ timeout: 5000 });
          const box = await row.boundingBox();
          assert(box.height >= (phone ? 44 : 36), `row ${box.height}`);
          assert(
            box.x >= 0 && box.x + box.width <= viewport.width,
            "off screen",
          );
          await shot("oauth-open");
          await press(row);
          await row.waitFor({ state: "hidden", timeout: 5000 });
          const shown = (await trigger.innerText()).trim();
          assert(shown === SERVERS[1].name, `shows ${shown}`);
          assert(await authorize.isEnabled(), "Authorize stays off");
        },
      );

      await report.step(
        `${at}: the empty choice turns it off again`,
        async () => {
          await press(trigger);
          await press(item(t("Choose a server…")));
          assert(await authorize.isDisabled(), "Authorize stays on");
        },
      );

      if (!phone)
        await report.step(`${at}: a keyboard can do all of it`, async () => {
          await trigger.focus();
          await page.keyboard.press("ArrowDown");
          await item(SERVERS[0].name).waitFor({ timeout: 5000 });
          await page.keyboard.press("Escape");
          await item(SERVERS[0].name).waitFor({
            state: "hidden",
            timeout: 5000,
          });
          assert(
            await trigger.evaluate((el) => el === document.activeElement),
            "Escape lost the focus",
          );
          await page.keyboard.press("ArrowDown");
          await item(SERVERS[0].name).waitFor({ timeout: 5000 });
          await page.keyboard.press("ArrowDown");
          await page.keyboard.press("Enter");
          const shown = (await trigger.innerText()).trim();
          assert(shown === SERVERS[0].name, `shows ${shown}`);
        });

      await report.step(
        `${at}: a refused request shows its error`,
        async () => {
          await consent();
          await trigger.waitFor({ timeout: 20000 });
          await press(trigger);
          await press(item(SERVERS[0].name));
          state.answer = "refuse";
          await press(authorize);
          await page
            .getByText(t("The bot is already in that server."), { exact: true })
            .waitFor({ timeout: 10000 });
          state.answer = "ok";
          assert(await trigger.isVisible(), "the choice went away");
          await shot("oauth-error");
        },
      );

      await report.step(
        `${at}: the choice reaches the OAuth request`,
        async () => {
          state.sent.length = 0;
          await press(trigger);
          await press(item(SERVERS[1].name));
          await press(authorize);
          await page.waitForURL(/\/app/, { timeout: 20000 });
          assert(state.sent.length === 1, `${state.sent.length} requests`);
          const [body] = state.sent;
          assert(body.server_id === SERVERS[1]._id, `sent ${body.server_id}`);
          assert(body.approve === true, "not an approval");
        },
      );

      await report.step(`${at}: no servers says so, with no menu`, async () => {
        state.servers = [];
        await consent();
        await page
          .getByText(t("You don't manage any server it can be added to."))
          .waitFor({ timeout: 20000 });
        assert(!(await trigger.count()), "a menu with nothing in it");
        state.servers = SERVERS;
      });

      await report.step(`${at}: the redirect URI reaches the URL`, async () => {
        const answer = await fetch(`${API}/bots/@me`, {
          headers: { "x-session-token": session.token },
        });
        const { bots } = await answer.json();
        assert(bots.length, "the dev account has no bot");
        await page.goto(`${APP}/developers/${bots[0]._id}/oauth2`);
        const scope = page.getByRole("checkbox", { name: "identify" });
        await scope.waitFor({ timeout: 20000 });
        await press(scope);
        const menu = page.getByRole("button", {
          name: t("Redirect URI"),
          exact: true,
        });
        await menu.waitFor({ timeout: 20000 });
        assert(!(await page.locator("select").count()), "a native select");
        const box = await menu.boundingBox();
        assert(box.height >= (phone ? 44 : 36), `height ${box.height}`);
        const code = page.locator("code", { hasText: "/oauth2/authorize?" });
        const has = async (uri) =>
          (await code.innerText()).includes(encodeURIComponent(uri));
        assert(await has(REDIRECTS[0]), "the first URI is not the default");
        await press(menu);
        await press(item(REDIRECTS[1]));
        assert(await has(REDIRECTS[1]), "the URL did not change");
        // the longest one stays inside the screen
        await press(menu);
        await press(item(REDIRECTS[2]));
        assert(await has(REDIRECTS[2]), "the URL did not change");
        const wide = await menu.boundingBox();
        assert(
          wide.x >= 0 && wide.x + wide.width <= viewport.width,
          `menu runs ${wide.x} to ${wide.x + wide.width}`,
        );
        await press(menu);
        await press(item(REDIRECTS[1]));
        assert(
          (await menu.evaluate((el) => getComputedStyle(el).direction)) ===
            "ltr",
          "a URI should read left to right",
        );
        await shot("developers");
      });

      await report.step(
        `${at}: nothing scrolls sideways, no page errors`,
        async () => {
          const wide = await page.evaluate(
            () =>
              document.documentElement.scrollWidth >
              document.documentElement.clientWidth,
          );
          assert(!phone || !wide, "the page scrolls sideways");
          assert(!errors.length, errors.join(" | ").slice(0, 300));
        },
      );
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

await Promise.all([...live].map(endSession));
await browser.close();
process.exit(report.done() ? 1 : 0);
