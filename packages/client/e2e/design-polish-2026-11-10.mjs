// Design polish (2026-11-10), as people see it, in ar, en and de at desktop
// and 375 px, on the local dev stack:
// - login: no dots bubble above the card, nothing above the heading, fields
//   named;
// - a YouTube link in a channel: the player card does not repeat the site
//   name; "Privacy policy" is its own target beside Load;
// - settings: the profile colours are our own wells, the system colour box
//   invisible over them (44 px on phones);
// - Home: "New from creators" uses the same heading as "Your servers";
// - Discover (phones): "All" and the footer words are 44 px targets;
// - website: Menu and the footer links are 44 px on phones; the footer link
//   "Third-party notices" opens a page in the visitor's language and
//   direction that fits the screen;
// - light theme (part "light", only with E2E_LIGHT_EMAIL / _PASSWORD, a
//   throwaway account, since the theme is synced): the Home greeting is
//   readable (4.5:1), and the theme is set back to dark afterwards.
// Read-only on shared data: it signs in, looks and clicks; nothing is saved.
//
// Uses the dev-stack helpers of the private test environment
// (internal/test-env/e2e/lib, or E2E_LIB).
// Usage: node design-polish-2026-11-10.mjs
// Env: E2E_BASE (web build under test), E2E_DISCOVER, E2E_SITE (website),
//   E2E_API, E2E_CHROMIUM, E2E_WEB (web checkout, for the catalogs),
//   E2E_LANGS=en,ar,de, E2E_SIZES=desktop,phone,
//   E2E_PARTS=login,embed,settings,home,discover,site,
//   E2E_SERVER / E2E_CHANNEL (a channel holding a YouTube link),
//   E2E_LIGHT_EMAIL / E2E_LIGHT_PASSWORD.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = fileURLToPath(import.meta.url).split("\\").join("/");
const INTERNAL = here.includes("/internal/")
  ? `${here.split("/internal/")[0]}/internal/`
  : undefined;
const libDir = process.env.E2E_LIB
  ? pathToFileURL(`${process.env.E2E_LIB.replace(/\/?$/, "/")}`)
  : existsSync(new URL("./lib/dev-stack.mjs", import.meta.url))
    ? new URL("./lib/", import.meta.url)
    : pathToFileURL(`${INTERNAL}test-env/e2e/lib/`);
const { VIEWPORTS, accounts, login, pw, shots, reporter } = await import(
  new URL("stack.mjs", libDir)
);
const { tr } = await import(new URL("catalog.mjs", libDir));

const APP = process.env.E2E_BASE ?? "http://127.0.0.1:31060";
const DISCOVER = process.env.E2E_DISCOVER ?? "http://127.0.0.1:31062";
const SITE = process.env.E2E_SITE ?? "http://127.0.0.1:31066";
const LANGS = (process.env.E2E_LANGS ?? "en,ar,de").split(",");
const SIZES = (process.env.E2E_SIZES ?? "desktop,phone").split(",");
const PARTS = (
  process.env.E2E_PARTS ?? "login,embed,settings,home,discover,site"
).split(",");
const LOCALE = { en: "en-US", ar: "ar", de: "de" };
// the dev stack's test server and its General channel (holds a YouTube link)
const SERVER = process.env.E2E_SERVER ?? "01M6H53ZDR6PJGQ22WBDYAZ6AD";
const CHANNEL = process.env.E2E_CHANNEL ?? "01M6H53ZDRK9YVYQNSAWNQKJKM";

const r = reporter("design-polish-2026-11-10");
const shot = shots("design-polish-2026-11-10");
const browser = await pw.chromium.launch({
  executablePath: process.env.E2E_CHROMIUM,
});
const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
const box = async (locator) => {
  const b = await locator.boundingBox();
  if (!b) throw new Error("element has no box");
  return { w: Math.round(b.width), h: Math.round(b.height) };
};

async function anonPage(lang, size) {
  const context = await browser.newContext({
    viewport: VIEWPORTS[size],
    locale: LOCALE[lang],
    isMobile: size === "phone",
    hasTouch: size === "phone",
  });
  await context.addInitScript((l) => {
    try {
      localStorage.setItem("lang", l);
      localStorage.setItem("zrzur-site-language", l);
    } catch {
      /* storage blocked */
    }
  }, lang);
  return { context, page: await context.newPage() };
}

for (const lang of LANGS)
  for (const size of SIZES) {
    const tag = `${lang} ${size}`;
    const phone = size === "phone";

    if (PARTS.includes("login")) {
      const { context, page } = await anonPage(lang, size);
      r.page = page;
      await r.step(`login: no bubble, heading first, fields named (${tag})`, async () => {
        await page.goto(`${APP}/login`);
        const heading = page.getByRole("heading", {
          level: 1,
          name: tr(lang, "Welcome back"),
        });
        await heading.waitFor();
        assert(
          (await page.locator("[data-mood]").count()) === 0,
          "the dots bubble is still on the page",
        );
        // nothing drawn between the top bar and the card with the heading
        const above = await heading.evaluate((h) => {
          const form = h.parentElement.parentElement;
          const top = form.getBoundingClientRect().top;
          return [...document.querySelectorAll("main *")]
            .filter((el) => !el.contains(form) && !form.contains(el))
            .filter((el) => !el.closest("header, footer, svg, canvas"))
            .filter((el) => {
              const b = el.getBoundingClientRect();
              return b.width > 24 && b.height > 24 && b.top > 56 && b.bottom <= top;
            })
            .map((el) => el.outerHTML.slice(0, 80));
        });
        assert(above.length === 0, `something sits above the heading: ${above[0]}`);
        await page.getByLabel(tr(lang, "Email")).fill("someone@example.com");
        await page
          .getByLabel(tr(lang, "Password"), { exact: true })
          .fill("not-a-password");
        await page.screenshot({ path: shot(`login-${lang}-${size}`) });
      });
      await context.close();
    }

    if (["embed", "settings", "home"].some((p) => PARTS.includes(p))) {
      const { page, context } = await login(browser, accounts[0], {
        viewport: VIEWPORTS[size],
        locale: LOCALE[lang],
      });
      await page.evaluate((l) => localStorage.setItem("lang", l), lang);
      r.page = page;

      if (PARTS.includes("embed"))
        await r.step(
          `channel: YouTube card names the site once, privacy link beside Load (${tag})`,
          async () => {
            await page.goto(`${APP}/server/${SERVER}/channel/${CHANNEL}`);
            const card = page.locator('[data-testid="player-placeholder"]').last();
            await card.waitFor({ timeout: 30000 });
            await card.scrollIntoViewIfNeeded();
            const text = await card.innerText();
            assert(!/YouTube/.test(text), `the card repeats the site name: ${text.slice(0, 80)}`);
            const link = card.getByRole("link", { name: tr(lang, "Privacy policy") });
            const l = await box(link);
            assert(l.h >= (phone ? 44 : 24), `privacy link is ${l.h} px high`);
            const beside = await link.evaluate(
              (a) => !!a.parentElement.querySelector("button"),
            );
            assert(beside, "privacy link is not beside Load");
            await card.screenshot({ path: shot(`embed-${lang}-${size}`) });
          },
        );

      if (PARTS.includes("settings"))
        await r.step(`settings: profile colours are our wells (${tag})`, async () => {
          await page.goto(`${APP}/settings`);
          // desktop opens on another page: the person picks Profiles
          if (!phone)
            await page
              .getByRole("button", { name: tr(lang, "Profile"), exact: true })
              .first()
              .click()
              .catch(() => {});
          const input = page.locator('input[type="color"]').first();
          await input.waitFor({ state: "attached", timeout: 20000 });
          await input.scrollIntoViewIfNeeded();
          const look = await input.evaluate((el) => {
            const well = el.parentElement;
            const b = well.getBoundingClientRect();
            return {
              opacity: getComputedStyle(el).opacity,
              bg: getComputedStyle(well).backgroundColor,
              w: Math.round(b.width),
              h: Math.round(b.height),
            };
          });
          assert(look.opacity === "0", `the system colour box shows (opacity ${look.opacity})`);
          assert(look.bg !== "rgba(0, 0, 0, 0)", "the well shows no colour");
          assert(
            Math.min(look.w, look.h) >= (phone ? 44 : 40),
            `the well is ${look.w}x${look.h}`,
          );
          await page.screenshot({ path: shot(`settings-${lang}-${size}`) });
        });

      if (PARTS.includes("home"))
        await r.step(`home: "New from creators" heading matches "Your servers" (${tag})`, async () => {
          await page.goto(`${APP}/app`);
          const ours = page.getByRole("heading", { level: 2, name: tr(lang, "Your servers") });
          const creators = page.getByRole("heading", {
            level: 2,
            name: tr(lang, "New from creators"),
          });
          await ours.waitFor({ timeout: 20000 });
          await creators.waitFor({ timeout: 20000 });
          const style = (h) =>
            h.evaluate((el) => {
              const s = getComputedStyle(el);
              return [s.fontSize, s.fontWeight, s.textTransform, s.color].join(" ");
            });
          const [a, b] = [await style(ours), await style(creators)];
          assert(a === b, `"Your servers" ${a} vs "New from creators" ${b}`);
        });

      await context.close();
    }

    if (PARTS.includes("discover") && phone) {
      const { context, page } = await anonPage(lang, size);
      r.page = page;
      await r.step(`discover: "All" and footer words are 44 px targets (${tag})`, async () => {
        await page.goto(`${DISCOVER}/`);
        const all = page
          .getByRole("navigation", { name: tr(lang, "Categories") })
          .getByRole("link", { name: tr(lang, "All"), exact: true });
        await all.waitFor({ timeout: 20000 });
        const a = await box(all);
        assert(a.w >= 44 && a.h >= 44, `"All" is ${a.w}x${a.h}`);
        const terms = page
          .locator("footer")
          .getByRole("link", { name: tr(lang, "Terms"), exact: true });
        await terms.scrollIntoViewIfNeeded();
        const t = await box(terms);
        assert(t.w >= 44 && t.h >= 44, `"Terms" is ${t.w}x${t.h}`);
      });
      await context.close();
    }

    if (PARTS.includes("site")) {
      const { context, page } = await anonPage(lang, size);
      r.page = page;
      const prefix = lang === "en" ? "" : `/${lang}`;
      await r.step(`website: 44 px targets; notices page in ${lang} (${tag})`, async () => {
        await page.goto(`${SITE}${prefix}/`);
        if (phone) {
          const m = await box(page.locator(".menu-button"));
          assert(m.w >= 44 && m.h >= 44, `Menu is ${m.w}x${m.h}`);
        }
        const footer = page.locator(".site-footer");
        await footer.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        if (phone) {
          const small = await footer.locator(".footer-column a").evaluateAll((as) =>
            as
              .map((a) => [a.textContent.trim(), a.getBoundingClientRect()])
              .filter(([, b]) => b.width > 0 && (b.height < 44 || b.width < 44))
              .map(([t, b]) => `${t} ${Math.round(b.width)}x${Math.round(b.height)}`),
          );
          assert(small.length === 0, `small footer links: ${small.slice(0, 3).join(", ")}`);
        }
        // the visitor clicks the footer link
        const pages = context.pages().length;
        await footer
          .locator('a[href*="third-party-notices"], a[href*="THIRD-PARTY"]')
          .first()
          .click();
        await page.waitForTimeout(1500);
        assert(
          context.pages().length === pages,
          "the notices opened in a new tab (the raw text file)",
        );
        const doc = await page.evaluate(() => ({
          lang: document.documentElement.lang,
          dir: document.documentElement.dir,
          h1: document.querySelector("h1")?.textContent ?? "",
          over:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        }));
        assert(doc.lang.startsWith(lang), `notices page lang="${doc.lang}"`);
        assert(
          doc.dir === (lang === "ar" ? "rtl" : "ltr"),
          `notices page dir="${doc.dir}"`,
        );
        assert(doc.h1.length > 0, "notices page has no heading");
        assert(doc.over <= 0, `notices page is ${doc.over} px too wide`);
        await page.screenshot({ path: shot(`notices-${lang}-${size}`) });
      });
      await context.close();
    }

    if (PARTS.includes("light") && process.env.E2E_LIGHT_EMAIL) {
      const { page, context } = await login(
        browser,
        { email: process.env.E2E_LIGHT_EMAIL, password: process.env.E2E_LIGHT_PASSWORD },
        { viewport: VIEWPORTS[size], locale: LOCALE[lang] },
      );
      await page.evaluate((l) => localStorage.setItem("lang", l), lang);
      r.page = page;
      const setMode = async (mode) => {
        await page.goto(`${APP}/settings`);
        await page
          .locator("[role=link]")
          .filter({ visible: true })
          .filter({ hasText: tr(lang, "Appearance") })
          .first()
          .click({ timeout: 10000 });
        await page
          .getByRole("radio", { name: tr(lang, mode), exact: true })
          .or(page.getByRole("button", { name: tr(lang, mode), exact: true }))
          .first()
          .click({ timeout: 10000 });
        await page.waitForTimeout(800);
        await page.keyboard.press("Escape");
      };
      await r.step(`light theme: the Home greeting is readable (${tag})`, async () => {
        await setMode("Light");
        await page.goto(`${APP}/app`);
        // the connected Home, not the first screen shown while connecting
        await page
          .getByRole("heading", { level: 2, name: tr(lang, "Your servers") })
          .waitFor({ timeout: 30000 });
        // the greeting: the heading inside the welcome card
        const h1 = page.locator("section h1").filter({ visible: true }).first();
        await h1.waitFor({ timeout: 20000 });
        const ratio = await h1.evaluate((el) => {
          // any CSS colour (rgb, oklch, color-mix) to [r, g, b, alpha 0..255]
          const paint = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
          const rgb = (c) => {
            paint.clearRect(0, 0, 1, 1);
            paint.fillStyle = c;
            paint.fillRect(0, 0, 1, 1);
            return [...paint.getImageData(0, 0, 1, 1).data];
          };
          const lum = ([r, g, b]) => {
            const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
          };
          let bg = el;
          while (bg && rgb(getComputedStyle(bg).backgroundColor)[3] === 0) bg = bg.parentElement;
          const [a, b] = [lum(rgb(getComputedStyle(el).color)), lum(rgb(getComputedStyle(bg ?? document.body).backgroundColor))];
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
        await page.screenshot({ path: shot(`home-light-${lang}-${size}`) });
        assert(ratio >= 4.5, `greeting contrast ${ratio.toFixed(2)}:1`);
      });
      await setMode("Dark").catch(() => {});
      await context.close();
    }
  }

await browser.close();
process.exit(r.done() ? 1 : 0);
