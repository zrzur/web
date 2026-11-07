import { expect, Page, test } from "@playwright/test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { signOut } from "./discover-fixtures.mjs";

/**
 * Every paid placement on Discover carries the ad label and a working
 * "Why am I seeing this?" note, in ar / en / de, at desktop and phone size.
 *
 * Run against a web build of this branch (PLAYWRIGHT_BASE_URL) whose API is
 * the dev stack (http://127.0.0.1:14702). The in-app /discover needs a
 * signed-in user: the spec signs in once per worker through the real login
 * page with the first dev-stack account, read at run time from
 * the file named by ZRZUR_DEV_ACCOUNTS (or hand in a ready state file with SS_PATH). The dev
 * stack has no paid listing and billing may be off, so the Discover answers
 * (lists, top row, billing plans) are fabricated; the page, labels and
 * popovers are the real UI and are used the way a user does.
 */
const LOCALES = [
  {
    locale: "ar",
    ad: "إعلان",
    why: "لماذا أرى هذا؟",
    bots: "البوتات",
    serverSentence: "اشتراه أحد مديري هذا السيرفر",
    botSentence: "اشتراه مالك هذا البوت",
  },
  {
    locale: "en",
    ad: "Ad",
    why: "Why am I seeing this?",
    bots: "Bots",
    serverSentence: "bought by a manager of this server",
    botSentence: "bought by the owner of this bot",
  },
  {
    locale: "de",
    ad: "Anzeige",
    why: "Warum sehe ich das?",
    bots: "Bots",
    serverSentence: "gekauft von einer Person, die diesen Server verwaltet",
    botSentence: "gekauft von der Person, der dieser Bot gehört",
  },
];
const SIZES = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 375, height: 800 },
];

// ---- sign in (once per worker) ---------------------------------------

const STATE =
  process.env.SS_PATH ??
  join(mkdtempSync(join(tmpdir(), "zrzur-s4-")), "state.json");

test.beforeAll(async ({ browser }) => {
  if (process.env.SS_PATH || (existsSync(STATE) && readFileSync(STATE, "utf8")))
    return;
  const file =
    process.env.ZRZUR_DEV_ACCOUNTS ??
    fileURLToPath(
      new URL(
        "../../../../../../test-data/dev-stack-accounts.json",
        import.meta.url,
      ),
    );
  const account = JSON.parse(readFileSync(file, "utf8")).accounts[0];
  const context = await browser.newContext({
    locale: "en",
    storageState: undefined,
  });
  const page = await context.newPage();
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 60_000,
  });
  await page.waitForTimeout(3000);
  await context.storageState({ path: STATE, indexedDB: true });
  await context.close();
});

// the session made above ends with the worker, on failure too; a state handed
// in by SS_PATH belongs to whoever made it
test.afterAll(async ({ browser, baseURL }) => {
  if (process.env.SS_PATH || !existsSync(STATE)) return;
  await signOut(browser, JSON.parse(readFileSync(STATE, "utf8")), baseURL);
});

// ---- fabricated Discover answers ---------------------------------------

const base = (id: string) => ({
  _id: id,
  description: "Test listing",
  nsfw: false,
  tags: [],
  category: "gaming",
  language: "en",
  featured: false,
});
const server = (id: string, extra: Record<string, unknown> = {}) => ({
  ...base(id),
  name: `Server ${id}`,
  member_count: 10,
  ...extra,
});
const bot = (id: string, extra: Record<string, unknown> = {}) => ({
  ...base(id),
  username: `Bot ${id}`,
  server_count: 3,
  ...extra,
});

/** One of each paid kind and a plain one (the main lists) */
const SERVERS = [
  server("PAIDMEGA", { boost: "MegaBoost" }),
  server("PAIDSUPER", { boost: "SuperBoost" }),
  server("PAIDBOOST", { boost: "Boost" }),
  server("PLAIN"),
];
/** Only the free hand-picked one (the featured=true list) */
const PICKED = [server("PICKED", { featured: true })];
const BOTS = [bot("BOTBOOST", { boost: "Boost" }), bot("BOTPLAIN")];
const PAID_IDS = ["PAIDMEGA", "PAIDSUPER", "PAIDBOOST", "TOPROW"];

async function stubDiscover(page: Page) {
  await page.route(/\/billing\/plans/, (route) =>
    route.fulfill({ json: { available: true, checkout_available: false } }),
  );
  await page.route(/\/discover\/promoted\/bots/, (route) =>
    route.fulfill({
      json: { slots: 3, open: 0, bots: [bot("BOTTOP", { promoted: true })] },
    }),
  );
  await page.route(/\/discover\/promoted(\?|$)/, (route) =>
    route.fulfill({
      json: {
        slots: 3,
        open: 0,
        servers: [server("TOPROW", { promoted: true })],
      },
    }),
  );
  await page.route(/\/discover\/bots(\?|$)/, (route) =>
    route.fulfill({ json: BOTS }),
  );
  await page.route(/\/discover\/servers(\?|$)/, (route) =>
    route.fulfill({
      json: route.request().url().includes("featured=true") ? PICKED : SERVERS,
    }),
  );
}

const card = (page: Page, id: string) =>
  page.locator(`[data-listing="${id}"]`).first();

async function ready(page: Page) {
  await page.goto("/discover");
  await expect(page.getByTestId("ad-label").first()).toBeVisible({
    timeout: 45_000,
  });
}

for (const L of LOCALES) {
  for (const size of SIZES) {
    test.describe(`${L.locale} ${size.name}`, () => {
      test.use({
        locale: L.locale,
        viewport: { width: size.width, height: size.height },
        storageState: STATE,
      });
      // the app opens a live connection to the dev stack; on a busy stack it can
      // sit on "Connecting…" for a while, so a failed attempt is retried
      test.describe.configure({ timeout: 90_000, retries: 2 });

      test("every paid server place says ad, with a note", async ({ page }) => {
        await stubDiscover(page);
        await ready(page);

        // every paid place (three boosts, the top row) carries the chip
        for (const id of PAID_IDS) {
          const chip = card(page, id).getByTestId("ad-label").first();
          await expect(chip, id).toContainText(L.ad);
          await expect(chip.getByTestId("ad-why")).toBeVisible();
        }
        // the Headline hero too, and it announces the ad
        const hero = page.getByTestId("discover-headline");
        await expect(hero.getByTestId("ad-label")).toContainText(L.ad);
        await expect(
          hero.getByRole("button", { name: `Server PAIDMEGA, ${L.ad}` }),
        ).toHaveCount(1);
        // the free hand-picked and the plain ones are not ads
        await expect(card(page, "PICKED")).toBeVisible();
        for (const id of ["PICKED", "PLAIN"]) {
          await expect(
            page.locator(`[data-listing="${id}"]`).getByTestId("ad-label"),
          ).toHaveCount(0);
        }

        // the chip sits on a solid colour, not on the artwork
        const chip = card(page, "PAIDBOOST").getByTestId("ad-label").first();
        const bg = await chip.evaluate(
          (el) => getComputedStyle(el).backgroundColor,
        );
        expect(bg).not.toMatch(/rgba|transparent/);

        // a screen reader hears "Ad" on the card
        await expect(
          card(page, "PAIDBOOST").getByRole("button", {
            name: `Server PAIDBOOST, ${L.ad}`,
          }),
        ).toHaveCount(1);

        const why = chip.getByTestId("ad-why");
        await why.scrollIntoViewIfNeeded();
        const box = (await why.boundingBox())!;
        if (size.width <= 600) {
          // phone: a 44 px target, fully visible (not clipped by the card)
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
          const cardBox = (await card(page, "PAIDBOOST").boundingBox())!;
          expect(box.y).toBeGreaterThanOrEqual(cardBox.y);
          expect(box.x + box.width).toBeLessThanOrEqual(
            cardBox.x + cardBox.width,
          );
        }
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(size.width);

        // the note: opens with focus, on screen (mirrored in Arabic), says
        // who it is for and who bought it, closes on an outside click
        await why.click();
        const note = page.getByTestId("ad-note");
        await expect(note).toBeVisible();
        await expect(note).toBeFocused();
        await expect(note).toContainText(L.why);
        await expect(note).toContainText("Server PAIDBOOST");
        await expect(note).toContainText(L.serverSentence);
        const n = (await note.boundingBox())!;
        expect(n.x).toBeGreaterThanOrEqual(0);
        expect(n.x + n.width).toBeLessThanOrEqual(size.width);
        if (L.locale === "ar" && size.width > 600) {
          // right edges line up (the note hangs from the "?" towards the left)
          expect(Math.abs(n.x + n.width - (box.x + box.width))).toBeLessThan(
            48,
          );
        }
        await page.mouse.click(size.width / 2, 4);
        await expect(note).toBeHidden();

        // Escape closes the note and gives focus back to the "?"
        await why.click();
        await expect(note).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(note).toBeHidden();
        await expect(why).toBeFocused();
      });

      test("a paid card opens by click and by keyboard; Escape closes only the note", async ({
        page,
      }) => {
        // servers open their own page; bots open the details dialog
        await stubDiscover(page);
        await ready(page);
        const tab = page.getByText(L.bots, { exact: true }).first();
        await expect(tab).toBeVisible({ timeout: 20_000 });
        await tab.click();
        const boosted = card(page, "BOTBOOST");
        await expect(boosted).toBeVisible({ timeout: 20_000 });
        const dialog = page.getByRole("dialog", { name: "Bot BOTBOOST" });

        // a user clicks the card (its name), not the invisible helper button
        await boosted.getByText("Bot BOTBOOST").click();
        await expect(dialog).toBeVisible();
        await expect(dialog.getByTestId("ad-label")).toContainText(L.ad);
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();

        // keyboard: focus the card's button and press Enter
        await boosted
          .getByRole("button", { name: `Bot BOTBOOST, ${L.ad}` })
          .focus();
        await page.keyboard.press("Enter");
        await expect(dialog).toBeVisible();

        await dialog.getByTestId("ad-why").click();
        const note = page.getByTestId("ad-note");
        await expect(note).toBeVisible();
        await expect(note).toContainText(L.botSentence);
        await page.keyboard.press("Escape");
        await expect(note).toBeHidden();
        await expect(dialog).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
      });

      test("bot listings say ad, and the note names the bot", async ({
        page,
      }) => {
        await stubDiscover(page);
        await ready(page);
        const tab = page.getByText(L.bots, { exact: true }).first();
        await expect(tab).toBeVisible({ timeout: 20_000 });
        await tab.click();
        const boosted = card(page, "BOTBOOST");
        await expect(boosted.getByTestId("ad-label")).toContainText(L.ad, {
          timeout: 20_000,
        });
        await expect(
          page.locator('[data-listing="BOTPLAIN"]').getByTestId("ad-label"),
        ).toHaveCount(0);
        await boosted.getByTestId("ad-why").click();
        const note = page.getByTestId("ad-note");
        await expect(note).toContainText("Bot BOTBOOST");
        await expect(note).toContainText(L.botSentence);
        await expect(note).not.toContainText(L.serverSentence);
      });

      test("no sideways scroll", async ({ page }) => {
        await stubDiscover(page);
        await ready(page);
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        );
        expect(overflow).toBe(false);
      });
    });
  }
}
