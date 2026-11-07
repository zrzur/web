// Join journey and design journey on the public sites, as a visitor does them:
// open the site without an account, press Join / Use this design, go on to the
// app, sign in, land back on the same server / design, and finish the action.
//
// Needs a running dev stack (API) and a web build whose VITE_HOST is the app
// origin and VITE_DISCOVER_URL / VITE_DESIGNS_HOST are the site origins; this
// script serves that one build on three local ports (app, discover, designs).
//
//   node e2e/stack-runner/discover-journeys.mjs [join|design]
//
// Build for it (packages/client): VITE_HOST=localhost:31070
// VITE_DISCOVER_URL=http://127.0.0.1:31071 VITE_DESIGNS_HOST=designs.localhost
// VITE_API_URL=<dev API> and the other VITE_DEV_* of the dev stack.
//
// Env: E2E_ACCOUNTS (JSON file { accounts: [{ email, password }, ...] }, two
//        test accounts; the first owns listed servers), E2E_API
//        (http://127.0.0.1:14702), E2E_DIST (default packages/client/dist),
//        E2E_APP_PORT 31070, E2E_DISCOVER_PORT 31071, E2E_DESIGNS_PORT 31072,
//        E2E_CHROMIUM (Chromium / headless shell), E2E_SHOTS (screenshot folder).
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(here, "../..");
const require = createRequire(join(root, "packages/client/package.json"));
const pwMod = await import(pathToFileURL(require.resolve("@playwright/test")).href);
const pw = pwMod.chromium ? pwMod : pwMod.default;

const env = process.env;
const DIST = resolve(env.E2E_DIST ?? join(root, "packages/client/dist"));
const API = env.E2E_API ?? "http://127.0.0.1:14702";
const PORTS = {
  app: Number(env.E2E_APP_PORT ?? 31070),
  discover: Number(env.E2E_DISCOVER_PORT ?? 31071),
  designs: Number(env.E2E_DESIGNS_PORT ?? 31072),
};
// distinct host names, as on the real domains: the app is VITE_HOST
// (localhost:PORT), Discover is the origin in VITE_DISCOVER_URL, Designs is
// the bare host name in VITE_DESIGNS_HOST (designs.localhost)
const ORIGIN = {
  app: `http://localhost:${PORTS.app}`,
  discover: `http://127.0.0.1:${PORTS.discover}`,
  designs: `http://designs.localhost:${PORTS.designs}`,
};
const SHOTS = resolve(env.E2E_SHOTS ?? join(root, "e2e/stack-runner/shots"));
mkdirSync(SHOTS, { recursive: true });
const accounts = JSON.parse(readFileSync(env.E2E_ACCOUNTS, "utf8")).accounts;

const LOCALES = (env.E2E_LOCALES ?? "en,ar,de").split(",");
const ALL_VIEWPORTS = {
  desktop: { width: 1366, height: 860 },
  phone: { width: 375, height: 812 },
};
const VIEWPORTS = Object.fromEntries(
  Object.entries(ALL_VIEWPORTS).filter(([name]) =>
    (env.E2E_VIEWPORTS ?? "desktop,phone").split(",").includes(name),
  ),
);
const only = process.argv.slice(2);
const want = (flow) => !only.length || only.includes(flow);

const TYPES = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
};

/** The one build, on every port, with the single-page fallback */
function serve(port) {
  return new Promise((done) => {
    const server = createServer((req, res) => {
      const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
      const file = normalize(join(DIST, path));
      const real =
        extname(path) && file.startsWith(DIST + sep) && existsSync(file) && statSync(file).isFile()
          ? file
          : join(DIST, "index.html");
      res.writeHead(200, { "content-type": TYPES[extname(real)] ?? "application/octet-stream" });
      createReadStream(real).pipe(res);
    }).listen(port, "127.0.0.1", () => done(server));
  });
}

async function session(account) {
  const res = await fetch(`${API}/auth/session/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password, friendly_name: "e2e" }),
  });
  const body = await res.json();
  if (!body.token) throw new Error(`login ${account.email}: ${JSON.stringify(body)}`);
  return body.token;
}

async function call(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "x-session-token": token, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (res.status === 429) {
    // a rate limit: wait as long as the API says, then ask again
    const wait = Number(JSON.parse(text).retry_after ?? 5000);
    await new Promise((done) => setTimeout(done, wait + 300));
    return call(token, method, path, body);
  }
  if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : undefined;
}

const results = [];
async function step(name, fn, page) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ok   ${name}`);
  } catch (error) {
    await page
      ?.screenshot({ path: join(SHOTS, `FAIL-${name.replace(/[^\w-]+/g, "_").slice(0, 90)}.png`) })
      .catch(() => {});
    results.push({ name, ok: false });
    console.log(`  FAIL ${name}\n       ${String(error.message ?? error).split("\n")[0]}`);
  }
}

async function newPage(browser, viewport, locale) {
  const phone = viewport.width < 600;
  const context = await browser.newContext({ viewport, locale, isMobile: phone, hasTouch: phone });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { page, context, errors };
}

/** No sideways scroll */
const noOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** From a public page to the app: choose "continue in the browser" if the dialog asks */
async function continueToApp(page, appOrigin) {
  const appLink = page.locator('[role="dialog"]').locator(`a[href^="${appOrigin}"]`).first();
  const arrived = page.waitForURL((u) => u.origin === appOrigin, { timeout: 20000 });
  // phones go straight to the browser; computers ask once
  const asked = await appLink
    .waitFor({ timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  if (asked) await appLink.click();
  await arrived.catch(async (error) => {
    const links = await page.locator("a[href]").evaluateAll((a) => a.map((x) => x.href).slice(0, 40));
    throw new Error(`no move to ${appOrigin} (at ${page.url()}; links: ${links.join(" ")}): ${error.message}`);
  });
}

async function signIn(page, account) {
  // the app sends a visitor to the login page itself; if it shows the public
  // page first, the header's button is the way to sign in
  await page
    .waitForURL((u) => u.pathname.startsWith("/login"), { timeout: 8000 })
    .catch(() => {});
  if (!new URL(page.url()).pathname.startsWith("/login")) {
    await page
      .locator(`a[href$=":${PORTS.app}"]:visible, a[href$=":${PORTS.app}/"]:visible`).last()
      .click({ timeout: 10000, noWaitAfter: true })
      .catch(async (error) => {
        const links = await page.locator("a[href]").evaluateAll((a) => a.map((x) => x.href).slice(0, 12));
        throw new Error(`no sign-in link at ${page.url()} (${links.join(" ")}): ${error.message}`);
      });
  }
  await page.waitForURL((u) => u.pathname.startsWith("/login"), { timeout: 20000 });
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 40000 });
}

const owner = await session(accounts[0]);
const visitorAccount = accounts[1];
const visitor = await session(visitorAccount);

// three listed servers the first account owns: open, by request, locked
const listed = await (await fetch(`${API}/discover/servers?limit=100`)).json();
const mine = [];
for (const card of listed) {
  const full = await call(owner, "GET", `/servers/${card._id}`).catch(() => null);
  if (full) mine.push(card);
}
const needed = env.E2E_ALLOW_DELIST === "1" ? 3 : 1;
if (mine.length < needed) {
  throw new Error(`need ${needed} listed servers owned by the first test account, found ${mine.length}`);
}
const servers = [
  { label: "open", access: "Open", card: mine[0] },
  { label: "by-request", access: "Approval", card: mine[1] },
  { label: "locked", access: "Locked", card: mine[2] },
].filter((s) => s.card);
// Closing a listed server takes it off Discover for good, and only a staff
// account can list it again. So the by-request and locked answers run only
// with E2E_ALLOW_DELIST=1; then re-list the servers afterwards (staff, or the
// database: discoverable=true, access=Open).
if (env.E2E_ALLOW_DELIST !== "1") servers.splice(1);
console.log(`servers: ${servers.map((s) => s.label).join(", ")}`);
const slug = (card) => encodeURIComponent(card.link ?? card._id);

const hosts = [await serve(PORTS.app), await serve(PORTS.discover), await serve(PORTS.designs)];
const browser = await pw.chromium.launch({
  headless: true,
  ...(env.E2E_CHROMIUM ? { executablePath: env.E2E_CHROMIUM } : {}),
});

try {
  if (want("join")) {
    for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
      for (const locale of LOCALES) {
        for (const s of servers) {
          const tag = `join ${s.label} ${locale} ${vpName}`;
          console.log(tag);
          // reset: open and listed, the visitor is not a member
          if (s.access !== "Open") await call(owner, "PATCH", `/servers/${s.card._id}`, { access: "Open" });
          await call(visitor, "DELETE", `/servers/${s.card._id}`).catch(() => {});
          const { page, context, errors } = await newPage(browser, viewport, locale);

          await step(`${tag}: opens without an account, no sideways scroll`, async () => {
            await page.goto(`${ORIGIN.discover}/${slug(s.card)}?hl=${locale}`);
            await page.locator("h1").first().waitFor({ timeout: 20000 });
            if (!(await noOverflow(page))) throw new Error("sideways scroll");
          }, page);

          await step(`${tag}: Join goes to the app, sign in, back on the server`, async () => {
            await page.locator('[aria-live="polite"] button').first().click();
            await continueToApp(page, ORIGIN.app);
            await signIn(page, visitorAccount);
            await page.waitForURL(
              (u) => u.origin === ORIGIN.app && u.pathname.startsWith("/discover/"),
              { timeout: 40000 },
            );
            await page.locator("h1").first().waitFor({ timeout: 20000 });
          }, page);

          await step(`${tag}: the answer matches the server's access`, async () => {
            // Discover lists only open servers; the owner changes the mode
            // while the visitor is looking, so each answer can be seen
            if (s.access !== "Open") await call(owner, "PATCH", `/servers/${s.card._id}`, { access: s.access });
            await page.locator('[aria-live="polite"] button').first().click();
            if (s.access === "Open") {
              await page.waitForURL((u) => u.pathname.startsWith("/server/"), { timeout: 30000 });
              await call(visitor, "GET", `/servers/${s.card._id}`);
            } else if (s.access === "Approval") {
              await page.locator('[data-tone="wait"]').waitFor({ timeout: 20000 });
            } else {
              await page.locator('[data-tone="closed"]').waitFor({ timeout: 20000 });
            }
            if (!(await noOverflow(page))) throw new Error("sideways scroll in the app");
            await page.screenshot({ path: join(SHOTS, `join-${s.label}-${locale}-${vpName}.png`) });
          }, page);

          if (errors.length) {
            results.push({ name: `${tag}: no page errors`, ok: false });
            console.log(`  FAIL ${tag}: page error ${errors[0]}`);
          }
          await context.close();
          await call(visitor, "DELETE", `/servers/${s.card._id}`).catch(() => {});
        }
      }
    }
    // leave the servers open, as found
    for (const s of servers) {
      await call(owner, "PATCH", `/servers/${s.card._id}`, { access: "Open" }).catch(() => {});
    }
  }

  if (want("design")) {
    for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
      for (const locale of LOCALES) {
        const tag = `design ${locale} ${vpName}`;
        console.log(tag);
        const { page, context, errors } = await newPage(browser, viewport, locale);

        await step(`${tag}: opens without an account, no sideways scroll`, async () => {
          await page.goto(`${ORIGIN.designs}/look-night-glow?hl=${locale}`);
          await page.locator("h1").first().waitFor({ timeout: 20000 });
          if (!(await noOverflow(page))) throw new Error("sideways scroll");
        }, page);

        await step(`${tag}: Use this design goes to the app, sign in, back on the design, applied`, async () => {
          await page.locator('[aria-live="polite"] button').first().click();
          await continueToApp(page, ORIGIN.app);
          await signIn(page, accounts[1]);
          await page.waitForURL(
            (u) => u.origin === ORIGIN.app && u.pathname.includes("/designs/look-night-glow"),
            { timeout: 40000 },
          );
          await page.locator("h1").first().waitFor({ timeout: 20000 });
          // signed in, the main button applies the design; afterwards the
          // button is replaced by the "on your profile" mark
          const buttons = page.locator('[aria-live="polite"] button');
          const before = await buttons.count();
          await buttons.first().click();
          await page.waitForFunction(
            (n) => document.querySelectorAll('[aria-live="polite"] button').length < n,
            before,
            { timeout: 20000 },
          );
          await page.screenshot({ path: join(SHOTS, `design-${locale}-${vpName}.png`) });
        }, page);

        if (errors.length) {
          results.push({ name: `${tag}: no page errors`, ok: false });
          console.log(`  FAIL ${tag}: page error ${errors[0]}`);
        }
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  for (const h of hosts) h.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\ndiscover-journeys: ${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
