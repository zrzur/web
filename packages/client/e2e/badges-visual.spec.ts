import { Page, expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * Badge visual pass against an isolated local stack: My Badges and the
 * profile popover in English, Arabic and German, dark and light, desktop
 * and phone. Needs the accounts file written by the badge E2E setup
 * (throwaway accounts only, never the owner's):
 *
 *   ZRZUR_BADGE_ACCOUNTS  path to accounts.json
 *   ZRZUR_SHOT_DIR        where screenshots go
 */
const file = process.env.ZRZUR_BADGE_ACCOUNTS;
const dir = process.env.ZRZUR_SHOT_DIR ?? "test-results/badges";
test.skip(!file, "set ZRZUR_BADGE_ACCOUNTS");
// the dev server compiles on first visit
test.setTimeout(120_000);

type Account = { email: string; password: string; id: string };
const data = file
  ? (JSON.parse(readFileSync(file, "utf8")) as {
      users: Record<string, Account>;
      server: string;
      channel: string;
    })
  : undefined;

const LOCALES = [
  ["en", "en-GB", "My Badges", "Your badges"],
  ["ar", "ar", "شاراتي", "شاراتك"],
  ["de", "de-DE", "Meine Abzeichen", "Deine Abzeichen"],
] as const;

async function login(page: Page, who: string) {
  const account = data!.users[who];
  await page.goto("/login/auth", { timeout: 90_000 });
  const form = page.locator("form");
  await form.locator('input[name="email"]').fill(account.email);
  await form.locator('input[name="password"]').fill(account.password);
  await form.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** Settings is a dialog: open it, then the My Badges page */
async function openBadges(page: Page, title: string) {
  await page.goto("/settings");
  // a link in the desktop sidebar; on a phone the page covers the menu,
  // so send the click to the menu entry directly
  const entry = page.getByText(title, { exact: true }).first();
  try {
    await entry.click({ timeout: 8_000 });
  } catch {
    await entry.dispatchEvent("click");
  }
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

for (const [code, locale, pageTitle, heldTitle] of LOCALES) {
  for (const scheme of ["dark", "light"] as const) {
    test.describe(`${code} ${scheme}`, () => {
      test.use({ locale, colorScheme: scheme });

      test(`my badges ${code} ${scheme}`, async ({ page }) => {
        await login(page, "longname");
        await openBadges(page, pageTitle);
        await page
          .getByRole("heading", { name: heldTitle })
          .waitFor({ timeout: 20_000 });
        await expect(
          page.locator('[data-badge="staff"]').first(),
        ).toBeVisible();
        if (code === "ar") {
          expect(await page.evaluate(() => document.documentElement.dir)).toBe(
            "rtl",
          );
        }
        await noSidewaysScroll(page);
        await page.screenshot({
          path: `${dir}/my-badges-${code}-${scheme}.png`,
          fullPage: true,
        });
      });

      test(`profile popover ${code} ${scheme}`, async ({ page }) => {
        await login(page, "normal");
        await page.goto(`/server/${data!.server}/channel/${data!.channel}`);
        // the member with the most badges and the longest name
        const member = page
          .getByText("Longest Display Name In Zrzur!")
          .first();
        await member.waitFor({ timeout: 20_000 });
        await member.click();
        const card = page
          .locator('[role="list"]')
          .filter({ has: page.locator("[data-badge]") })
          .first();
        await card.waitFor();
        expect(
          await card.locator("[data-badge]").count(),
        ).toBeGreaterThanOrEqual(4);
        // each badge has a name for screen readers and is reachable by keyboard
        const first = card.locator('[role="listitem"]').first();
        expect(
          (await first.getAttribute("aria-label"))?.length,
        ).toBeGreaterThan(5);
        expect(await first.getAttribute("tabindex")).toBe("0");
        await first.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${dir}/popover-${code}-${scheme}.png` });
      });
    });
  }
}

test.describe("phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    locale: "ar",
    colorScheme: "dark",
  });

  test("my badges on a phone", async ({ page }) => {
    await login(page, "longname");
    await openBadges(page, "شاراتي");
    await page
      .locator('[data-badge="staff"]')
      .first()
      .waitFor({ timeout: 20_000 });
    await noSidewaysScroll(page);
    await page.screenshot({
      path: `${dir}/my-badges-phone-ar.png`,
      fullPage: true,
    });
  });

  test("empty state for a user with no badges", async ({ page }) => {
    await login(page, "normal");
    await openBadges(page, "شاراتي");
    await page
      .locator('[data-locked="true"]')
      .first()
      .waitFor({ timeout: 20_000 });
    await page.screenshot({
      path: `${dir}/my-badges-empty-ar.png`,
      fullPage: true,
    });
  });
});
