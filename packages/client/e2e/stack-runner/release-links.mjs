// Release integrity (S5): the "Source code" and "Third-party notices" rows in
// Settings and the footer links point at the running build, in en/ar/de on
// desktop and at 375 px. Real clicks on the dev stack.
// Usage: E2E_BASE=<web build url> E2E_WEB=<web checkout> [E2E_SITE=<website build url>]
//        node release-links.mjs
// Env: E2E_LIB (default: found from this folder or
// the workspace root), E2E_CHROMIUM (headless shell), E2E_API.
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

function findLib() {
  if (process.env.E2E_LIB) return resolve(process.env.E2E_LIB);
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i++, dir = dirname(dir)) {
    for (const rel of ["test-env/e2e/lib"]) {
      if (existsSync(resolve(dir, rel, "stack.mjs"))) return resolve(dir, rel);
    }
  }
  throw new Error("e2e lib not found; set E2E_LIB=<internal>/test-env/e2e/lib");
}
const lib = findLib();
const { tr } = await import(pathToFileURL(resolve(lib, "catalog.mjs")).href);
const { APP, LOCALES, VIEWPORTS, accounts, login, pw, reporter } = await import(
  pathToFileURL(resolve(lib, "stack.mjs")).href
);

const SITE = process.env.E2E_SITE;

/** A new tab starts on about:blank; the address it was sent to */
async function openedUrl(tab) {
  await tab.waitForURL((u) => u.href !== "about:blank", { timeout: 10000 }).catch(() => {});
  return tab.url();
}
const REF = "(\\/tree\\/[0-9a-f]{7,40}|\\/tree\\/v[^/]+)?$";
const WEB_URL = new RegExp(`^https://github\\.com/zrzur/web${REF}`);
const BACKEND_URL = new RegExp(`^https://github\\.com/zrzur/backend(/tree/[0-9a-f]{7,64})?$`);
const SITE_URL = new RegExp(`github\\.com/zrzur/website${REF}`);
const report = reporter("release-links");
const browser = await pw.chromium.launch({
  executablePath: process.env.E2E_CHROMIUM || undefined,
});

for (const locale of LOCALES) {
  const L = (s) => tr(locale, s);
  for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
    const tag = `${locale}/${vpName}`;
    // the app can stall on its first start while the API rate-limits; retry the sign-in
    let session;
    for (let attempt = 0; !session; attempt++) {
      try {
        session = await login(browser, accounts[0], { viewport, locale });
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise((r) => setTimeout(r, 20000));
      }
    }
    const { page, context } = session;
    report.page = page;
    // never leave the machine: pages on GitHub are answered with a stub
    await context.route(/github\.com/, (route) => route.fulfill({ body: "ok" }));

    const sourceRow = () => page.getByRole("link", { name: L("Source code"), exact: true }).first();
    async function openSettings() {
      if (viewport.width < 600) {
        // phones: the app page lists "Open settings"
        await page.goto(`${APP}/app`);
        await page.getByText(L("Open settings"), { exact: true }).first().click({ timeout: 90000 });
      } else {
        const settingsButton = page.locator(`[aria-label="${L("User settings")}"]`).first();
        await settingsButton.waitFor({ state: "attached", timeout: 90000 });
        await settingsButton.click();
      }
      await sourceRow().waitFor();
      // the settings window slides in; clicks during the motion are lost
      await page.waitForTimeout(600);
    }
    /** Click a settings row that opens a new tab; the address it opened */
    async function rowOpens(name) {
      const row = page.getByRole("link", { name, exact: true }).first();
      // after the first row the phone shows another page: open the list again
      if (!(await row.isVisible())) await openSettings();
      const tab = context.waitForEvent("page", { timeout: 10000 });
      tab.catch(() => {});
      await page.getByRole("link", { name, exact: true }).first().click();
      return openedUrl(await tab);
    }
    await openSettings();

    await report.step(`${tag}: web version shows`, async () => {
      const version = await page.getByTestId("web-version").first().innerText();
      if (!version.trim()) throw new Error("empty version");
    });

    await report.step(`${tag}: server row links to the backend source`, async () => {
      const link = page.getByTestId("server-source-link").first();
      await link.waitFor({ timeout: 10000 });
      const href = await link.getAttribute("href");
      if (!BACKEND_URL.test(href)) throw new Error(`server link ${href}`);
    });

    await report.step(`${tag}: Source code opens the source of this build`, async () => {
      const url = await rowOpens(L("Source code"));
      if (!WEB_URL.test(url)) throw new Error(`opened ${url}`);
    });

    await report.step(`${tag}: Third-party notices opens the notices file`, async () => {
      const url = await rowOpens(L("Third-party notices"));
      if (!url.endsWith("/THIRD-PARTY-NOTICES.txt")) throw new Error(`opened ${url}`);
      const text = await (await fetch(url)).text();
      for (const needle of ["@fontsource", "solid-livekit-components", "workbox-precaching", "core-js"])
        if (!text.includes(needle)) throw new Error(`notices miss ${needle}`);
    });
    await context.close();

    // the sign-in page footer and the website footer, signed out
    const plain = await browser.newContext({ viewport, locale });
    const anon = await plain.newPage();
    report.page = anon;
    await report.step(`${tag}: sign-in footer source link`, async () => {
      const link = anon.locator('a[aria-label="GitHub"]').first();
      // the app can stall on its first start while the API rate-limits; retry
      for (let attempt = 0; attempt < 3; attempt++) {
        await anon.goto(`${APP}/login`);
        try {
          await link.waitFor({ timeout: 30000 });
          break;
        } catch {
          if (attempt === 2) throw new Error("sign-in page did not load");
          await anon.waitForTimeout(15000);
        }
      }
      const href = await link.getAttribute("href");
      if (!WEB_URL.test(href)) throw new Error(`footer link ${href}`);
    });
    if (SITE) {
      await report.step(`${tag}: website footer links`, async () => {
        await anon.goto(SITE);
        const footer = anon.locator("footer");
        const source = await footer.locator('a[href*="github.com/zrzur/website"]').first().getAttribute("href");
        if (!SITE_URL.test(source)) throw new Error(`site source ${source}`);
        const notices = await footer.locator('a[href$="THIRD-PARTY-NOTICES.txt"]').first().getAttribute("href");
        const res = await fetch(new URL(notices, SITE));
        if (!res.ok || !(await res.text()).includes("Third-party notices")) throw new Error("site notices");
      });
    }
    await plain.close();
  }
}
await browser.close();
process.exit(report.done() ? 1 : 0);
