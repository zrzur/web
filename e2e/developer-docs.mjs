// The public developer docs, as a visitor uses them: open a page, switch the
// language, follow an anchor; `/developers` still asks for a sign-in; a
// signed-in person stays in the app. ar, en, de at desktop and 375 px.
//
//   E2E_BASE=http://127.0.0.1:31060 E2E_API=http://127.0.0.1:14702 \
//   E2E_ACCOUNTS=<file with { accounts: [{ email, password }] }> \
//   [E2E_CHROMIUM=<browser binary>] node e2e/developer-docs.mjs
//
// The browser's own language is never the one under test, so only the
// switch can change it.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const here = new URL("../packages/client/package.json", import.meta.url);
const resolved = createRequire(here).resolve("@playwright/test");
const module = await import(pathToFileURL(resolved).href);
const { chromium } = module.chromium ? module : module.default;

const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:31060";
const API = process.env.E2E_API ?? "http://127.0.0.1:14702";
const ACCOUNTS = process.env.E2E_ACCOUNTS;

const LANGUAGES = [
  {
    id: "ar",
    name: "العربية",
    dir: "rtl",
    browser: "en-US",
    page: "التطبيقات والرموز",
    roles: "الأدوار والصلاحيات",
  },
  {
    id: "en",
    name: "English",
    dir: "ltr",
    browser: "de-DE",
    page: "Applications and tokens",
    roles: "Roles and permissions",
  },
  {
    id: "de",
    name: "Deutsch",
    dir: "ltr",
    browser: "en-US",
    page: "Anwendungen und Tokens",
    roles: "Rollen und Berechtigungen",
  },
];
const WIDTHS = [1280, 375];

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : ` ${detail}`}`);
}

const browser = await chromium.launch(
  process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {},
);

async function visitor(language, width) {
  const label = `${language.id} ${width}`;
  const context = await browser.newContext({
    viewport: { width, height: 800 },
    locale: language.browser,
    hasTouch: width < 600,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const h1 = () => page.locator("article h1").innerText();

  // opens a page without an account
  await page.goto(`${BASE}/developers/docs/applications`);
  await page.locator("article h1").waitFor({ timeout: 60_000 });
  check(
    `${label}: opens without an account`,
    !page.url().includes("/login"),
    page.url(),
  );

  // switches the language
  await page.locator('button[aria-haspopup="listbox"]').click();
  await page
    .getByRole("option", { name: language.name })
    .or(page.getByRole("button", { name: language.name }))
    .first()
    .click();
  await page
    .waitForFunction(
      (text) => document.querySelector("article h1")?.textContent === text,
      language.page,
      { timeout: 15_000 },
    )
    .catch(() => {});
  check(
    `${label}: the switch changes the language`,
    (await h1()) === language.page,
    await h1(),
  );
  const dir = await page.evaluate(() => document.documentElement.dir || "ltr");
  check(`${label}: reading direction`, dir === language.dir, dir);

  // the choice stays after a reload
  await page.reload();
  await page.locator("article h1").waitFor();
  await page
    .waitForFunction(
      (text) => document.querySelector("article h1")?.textContent === text,
      language.page,
      { timeout: 15_000 },
    )
    .catch(() => {});
  check(
    `${label}: the choice is remembered`,
    (await h1()) === language.page,
    await h1(),
  );

  // follows an anchor
  await page
    .locator('article a[href="/developers/docs/roles#ranking"]')
    .first()
    .click();
  await page.waitForURL(/\/developers\/docs\/roles#ranking$/);
  await page
    .waitForFunction(
      (text) => document.querySelector("article h1")?.textContent === text,
      language.roles,
      { timeout: 15_000 },
    )
    .catch(() => {});
  await page.waitForTimeout(400);
  const place = await page.evaluate(() => {
    const box = document.getElementById("ranking")?.getBoundingClientRect();
    return box ? { top: box.top, height: innerHeight } : null;
  });
  check(
    `${label}: the anchor scrolls to its section`,
    !!place && place.top >= 0 && place.top < place.height,
    JSON.stringify(place),
  );

  // code stays left to right, and nothing scrolls sideways
  const layout = await page.evaluate(() => ({
    wide: document.documentElement.scrollWidth > innerWidth + 1,
    code: [...document.querySelectorAll("article pre")].every(
      (block) => getComputedStyle(block).direction === "ltr",
    ),
  }));
  check(`${label}: no sideways scroll`, !layout.wide);
  check(`${label}: code is left to right`, layout.code);

  // the contents menu on a phone
  if (width < 600) {
    await page
      .locator("article")
      .locator("xpath=preceding-sibling::button")
      .first()
      .click()
      .catch(() => {});
    const open = await page.locator("nav[data-open]").count();
    check(`${label}: the contents open`, open === 1);
  }

  // a link can ask for a language
  await page.goto(`${BASE}/developers/docs/applications?hl=${language.id}`);
  await page
    .waitForFunction(
      (text) => document.querySelector("article h1")?.textContent === text,
      language.page,
      { timeout: 15_000 },
    )
    .catch(() => {});
  check(
    `${label}: ?hl= opens that language`,
    (await h1()) === language.page,
    await h1(),
  );

  // the portal itself still asks for a sign-in
  await page.goto(`${BASE}/developers`);
  await page.waitForURL(/\/login/, { timeout: 30_000 }).catch(() => {});
  check(
    `${label}: /developers asks for a sign-in`,
    page.url().includes("/login"),
    page.url(),
  );

  check(`${label}: no page errors`, errors.length === 0, errors[0]);
  await context.close();
}

async function signedIn() {
  const account = JSON.parse(readFileSync(ACCOUNTS, "utf8")).accounts[0];
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  let session;
  page.on("response", async (response) => {
    if (
      response.url().endsWith("/auth/session/login") &&
      response.status() === 200
    )
      session = (await response.json().catch(() => ({}))).token;
  });
  try {
    await page.goto(`${BASE}/login/auth`);
    await page.fill('input[type="email"], input[name="email"]', account.email);
    await page.fill('input[type="password"]', account.password);
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 30_000,
    });
    await page.goto(`${BASE}/developers/docs/roles`);
    await page.locator("article h1").waitFor({ timeout: 60_000 });
    check(
      "signed in: docs open",
      page.url().includes("/developers/docs/roles"),
      page.url(),
    );
    check(
      "signed in: the app shell stays",
      (await page.locator(".app_root nav, .app_root aside").count()) > 0 &&
        (await page.locator('a[href="/app"], a[href^="/server/"]').count()) > 0,
    );
    check(
      "signed in: no visitor language switch",
      (await page.locator('main button[aria-haspopup="listbox"]').count()) ===
        0,
    );
    await page.goto(`${BASE}/developers`);
    await page.locator("main h1").first().waitFor({ timeout: 30_000 });
    check(
      "signed in: /developers opens the portal",
      !page.url().includes("/login"),
      page.url(),
    );
  } finally {
    if (session)
      await fetch(`${API}/auth/session/logout`, {
        method: "POST",
        headers: { "x-session-token": session },
      });
    await context.close();
  }
}

try {
  for (const language of LANGUAGES)
    for (const width of WIDTHS) await visitor(language, width);
  if (ACCOUNTS) await signedIn();
} catch (error) {
  check("the run finished", false, error.message.split("\n")[0]);
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
