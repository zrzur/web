import { Browser, Page, expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  API,
  APP,
  BOTS,
  LOCALES,
  SERVERS,
  SITE,
  SIZES,
  sessionToken,
  signIn,
  signOut,
  stubDiscover,
} from "./discover-fixtures.mjs";

/**
 * The real journey, as a person makes it, in the app (signed in) and on the
 * site (a visitor), in ar / en / de, on a desktop and at 375 px: search,
 * filter, read why a paid place is there, open a server, report it, join it,
 * go back, open a bot, add it, report it, go back.
 *
 * Fabricated in this browser, because the dev stack has one listed server and
 * no bots: the lists and pictures (discover-fixtures.mjs), the bot's invite,
 * and the answer to the report, so the shared stack's staff queue stays clean.
 * Real: the login, the one listed server, and joining it, which this test
 * undoes afterwards.
 */

const SHOTS =
  process.env.E2E_SHOTS ??
  fileURLToPath(
    new URL(
      "../../../../../../screenshots/design-discover/journey/",
      import.meta.url,
    ),
  );
mkdirSync(SHOTS, { recursive: true });

type Real = { _id: string; name: string; link?: string; owner?: string };

const RUST = SERVERS[5];
const TECH_ALSO = SERVERS[12];
const OTHER = SERVERS[1];
const PAID = SERVERS[3];
const BOT = BOTS[2];

let state: Awaited<ReturnType<typeof signIn>> | undefined;
let real: Real[] = [];

test.beforeAll(async ({ browser, request }) => {
  const answer = await request.get(`${API}/discover/servers?limit=8`);
  real = await answer.json();
  expect(real.length, "the dev stack has a listed server").toBeGreaterThan(0);
  state = await signIn(browser);
});

test.afterAll(async ({ browser }) => {
  await signOut(browser, state);
});

const card = (page: Page, id: string) =>
  page.locator(`[data-listing="${id}"]`).first();

/** The person's way into a card: its name */
const openCard = (page: Page, id: string) =>
  card(page, id).locator("h3 span").first().click();

async function noSidewaysScroll(page: Page, width: number) {
  const wide = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(wide).toBeLessThanOrEqual(width);
}

async function search(page: Page, words: string) {
  const field = page.locator('input[type="search"]');
  // phones: an icon first; with a keyboard, the "/" key
  if (await field.isVisible()) await page.keyboard.press("/");
  else
    await page
      .locator("[data-discover-scroll] header button[aria-expanded]")
      .click();
  await expect(field).toBeFocused();
  await field.pressSequentially(words, { delay: 30 });
}

/** The steps of the report dialog, to its last button */
async function reportInDialog(page: Page, id: string, open: number) {
  const posts: string[] = [];
  await page.route(/\/safety\/reports$/, (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.fallback();
    posts.push(request.postData() ?? "");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ reference: "TEST-REF" }),
    });
  });
  const dialog = page.getByRole("dialog").last();
  await expect(dialog.getByRole("listitem").first()).toBeVisible({
    timeout: 20_000,
  });
  await dialog.getByRole("listitem").last().click();
  // reason, perhaps a finer reason, details, review
  for (let step = 0; step < 6 && !posts.length; step++) {
    const choices = dialog.getByRole("listitem");
    if (await choices.count()) await choices.first().click();
    const text = dialog.locator("textarea");
    if (await text.isVisible()) await text.fill("Test report from the e2e run");
    await dialog.locator("button:not([disabled])").last().click();
    await page.waitForTimeout(200);
  }
  await expect
    .poll(() => posts.length, { message: "the report was sent" })
    .toBe(1);
  expect(posts[0]).toContain(id);
  // the receipt, then it closes
  await dialog.locator("button:not([disabled])").last().click();
  await expect(page.getByRole("dialog")).toHaveCount(open);
}

for (const locale of LOCALES) {
  for (const size of SIZES) {
    for (const where of ["app", "site"] as const) {
      test(`${where} ${locale} ${size.name}`, async ({ browser }) => {
        test.setTimeout(180_000);
        const inApp = where === "app";
        const base = inApp ? `${APP}/discover` : SITE;
        const tag = `${where}-${locale}-${size.width}`;
        const context = await browser.newContext({
          locale,
          viewport: { width: size.width, height: size.height },
          storageState: inApp ? state : undefined,
        });
        await stubDiscover(context, { realServers: real });
        // the public report form lives on the website: only its address counts
        await context.route("https://zrzur.com/**", (route) =>
          route.fulfill({
            contentType: "text/html",
            body: "<title>form</title>",
          }),
        );
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        const listed = real[0];
        let leave: (() => Promise<void>) | undefined;

        try {
          // the page
          await page.goto(base);
          await expect(page.locator("[data-hero] h1")).toBeVisible({
            timeout: 45_000,
          });
          await expect(card(page, OTHER._id)).toBeVisible();
          await noSidewaysScroll(page, size.width);
          await page.screenshot({ path: `${SHOTS}${tag}-1-wall.png` });

          // search
          await search(page, "rust");
          await expect(card(page, RUST._id)).toBeVisible();
          await expect(card(page, OTHER._id)).toBeHidden();
          await expect(page.locator("h2[data-view-heading]")).toContainText(
            "rust",
          );
          await expect(page).toHaveURL(/q=rust/);
          await page.screenshot({ path: `${SHOTS}${tag}-2-search.png` });
          await page.locator('input[type="search"]').press("Escape");
          await expect(page.locator("[data-hero] h1")).toBeVisible();

          // filter
          await page.locator('[data-words] a[href$="/technology"]').click();
          await expect(page).toHaveURL(/\/technology$/);
          await expect(card(page, RUST._id)).toBeVisible();
          await expect(card(page, TECH_ALSO._id)).toBeVisible();
          await expect(card(page, OTHER._id)).toBeHidden();
          await expect(
            page.locator('[data-words] a[href$="/technology"]'),
          ).toHaveAttribute("aria-current", "true");
          await noSidewaysScroll(page, size.width);
          await page.locator("[data-words] a").first().click();
          await expect(page.locator("[data-hero] h1")).toBeVisible();

          // a paid place says so, on every size, and says why
          const label = card(page, PAID._id).getByTestId("ad-label");
          await label.scrollIntoViewIfNeeded();
          await expect(label).toBeVisible();
          const box = (await label.boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(size.width);
          const why = label.getByTestId("ad-why");
          const target = (await why.boundingBox())!;
          if (size.width <= 600) {
            expect(target.width).toBeGreaterThanOrEqual(44);
            expect(target.height).toBeGreaterThanOrEqual(44);
          }
          await why.click();
          const note = page.getByTestId("ad-note");
          await expect(note).toBeVisible();
          await expect(note).toContainText(PAID.name);
          await page.screenshot({ path: `${SHOTS}${tag}-3-ad.png` });
          await page.keyboard.press("Escape");
          await expect(note).toBeHidden();
          await expect(why).toBeFocused();

          // open a server
          await openCard(page, listed._id);
          const heading = page.locator("[data-page] h1");
          await expect(heading).toContainText(listed.name, { timeout: 20_000 });
          await expect(page).toHaveURL(
            new RegExp(`/${listed.link ?? listed._id}`),
          );
          await noSidewaysScroll(page, size.width);
          await page.screenshot({ path: `${SHOTS}${tag}-4-server.png` });

          // report it
          await page.locator("[data-page] [data-report]").click();
          if (inApp) {
            await reportInDialog(page, listed._id, 0);
          } else {
            // no account: the public form, with the server filled in
            await page.waitForURL(/^https:\/\/zrzur\.com\/(ar\/|de\/)?report/);
            const url = new URL(page.url());
            expect(url.pathname).toBe(
              locale === "en" ? "/report" : `/${locale}/report`,
            );
            expect(url.searchParams.get("kind")).toBe("DiscoverServer");
            expect(url.searchParams.get("location")).toContain(
              listed.link ?? listed._id,
            );
            await page.goBack();
            await expect(heading).toBeVisible({ timeout: 45_000 });
          }

          // join it
          if (inApp) {
            const token = await sessionToken(page);
            const headers = { "x-session-token": token as string };
            const me = await (
              await page.request.get(`${API}/users/@me`, { headers })
            ).json();
            const member = await page.request.get(
              `${API}/servers/${listed._id}/members/${me._id}`,
              { headers },
            );
            if (!member.ok())
              leave = async () => {
                const server = await (
                  await page.request.get(`${API}/servers/${listed._id}`, {
                    headers,
                  })
                ).json();
                // only ever a membership this test made: never the owner's
                if (server.owner === me._id) return;
                await page.request.delete(`${API}/servers/${listed._id}`, {
                  headers,
                });
              };
            await page.locator("[data-page] [data-join]").click();
            await page.waitForURL(new RegExp(`/server/${listed._id}`), {
              timeout: 30_000,
            });
            await page.goBack();
            await expect(heading).toBeVisible({ timeout: 45_000 });
          } else {
            await page.locator("[data-page] [data-join]").click();
            const choice = page.getByRole("dialog");
            await expect(choice).toContainText(listed.name);
            await page.screenshot({ path: `${SHOTS}${tag}-5-join.png` });
            await page.keyboard.press("Escape");
            await expect(choice).toBeHidden();
          }

          // back to the wall
          await page.goBack();
          await expect(card(page, OTHER._id)).toBeVisible({ timeout: 45_000 });

          // open a bot
          await page.getByRole("tab").nth(1).click();
          await expect(page).toHaveURL(/\/bots$/);
          await expect(card(page, BOT._id)).toBeVisible();
          await openCard(page, BOT._id);
          const details = page.getByRole("dialog", { name: BOT.username });
          await expect(details).toBeVisible();
          await expect(page).toHaveURL(new RegExp(BOT._id));
          await noSidewaysScroll(page, size.width);
          await page.screenshot({ path: `${SHOTS}${tag}-6-bot.png` });

          // add it
          await details.locator("button").last().click();
          if (inApp) {
            const add = page
              .getByRole("dialog")
              .filter({ hasText: "Test bot" });
            await expect(add).toBeVisible();
            await page.screenshot({ path: `${SHOTS}${tag}-7-add.png` });
            await page.keyboard.press("Escape");
            await expect(page.getByRole("dialog")).toHaveCount(1);
          } else {
            await page.waitForURL(`${APP}/**`);
            expect(page.url()).toContain(`/bot/${BOT._id}`);
            await page.goBack();
            await expect(details).toBeVisible({ timeout: 45_000 });
          }

          // report it
          await details.locator("button").nth(-2).click();
          if (inApp) {
            await reportInDialog(page, BOT._id, 1);
          } else {
            await page.waitForURL(/^https:\/\/zrzur\.com\/(ar\/|de\/)?report/);
            const url = new URL(page.url());
            expect(url.searchParams.get("kind")).toBe("Bot");
            expect(url.searchParams.get("location")).not.toContain("?");
            await page.goBack();
            await expect(details).toBeVisible({ timeout: 45_000 });
          }

          // back
          await page.keyboard.press("Escape");
          await expect(details).toBeHidden();
          await expect(page).toHaveURL(/\/bots$/);
          await expect(card(page, BOT._id)).toBeVisible();
          await noSidewaysScroll(page, size.width);
          expect(errors).toEqual([]);
        } finally {
          await leave?.();
          await context.close();
        }
      });
    }
  }
}

/** What scrolls: the page in the app, the frame around it on the site */
const scrolled = (page: Page) =>
  page.evaluate(() => {
    let el = document.querySelector("[data-discover-scroll]");
    while (el && getComputedStyle(el).overflowY !== "auto")
      el = el.parentElement;
    return el?.scrollTop ?? -1;
  });

for (const size of SIZES) {
  for (const where of ["app", "site"] as const) {
    test(`back lands where you were: ${where} ${size.name}`, async ({
      browser,
    }) => {
      test.setTimeout(90_000);
      const context = await browser.newContext({
        locale: "en",
        viewport: { width: size.width, height: size.height },
        storageState: where === "app" ? state : undefined,
      });
      await stubDiscover(context);
      const page = await context.newPage();
      try {
        await page.goto(where === "app" ? `${APP}/discover` : SITE);
        const far = card(page, SERVERS[8]._id);
        await far.waitFor({ state: "attached", timeout: 45_000 });
        await page.waitForTimeout(800);
        await far.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        const before = await scrolled(page);
        expect(before).toBeGreaterThan(200);
        await far.locator("h3 span").first().click();
        await expect(page.locator("[data-page] h1")).toBeVisible();
        await expect.poll(() => scrolled(page)).toBeLessThan(5);
        await page.goBack();
        await expect(far).toBeVisible();
        await expect
          .poll(async () => Math.abs((await scrolled(page)) - before))
          .toBeLessThan(40);
      } finally {
        await context.close();
      }
    });
  }
}

const VERSIONS = [
  { where: "app", base: `${APP}/discover` },
  { where: "site", base: SITE },
] as const;

async function openVersion(
  browser: Browser,
  where: "app" | "site",
  locale: string,
  size: { width: number; height: number },
) {
  const context = await browser.newContext({
    locale,
    viewport: { width: size.width, height: size.height },
    storageState: where === "app" ? state : undefined,
  });
  await stubDiscover(context);
  return context.newPage();
}

for (const size of SIZES) {
  for (const { where, base } of VERSIONS) {
    test(`typing on a server page keeps the field: ${where} ${size.name}`, async ({
      browser,
    }) => {
      test.setTimeout(90_000);
      const page = await openVersion(browser, where, "en", size);
      try {
        await page.goto(`${base}/mock-2`);
        await expect(page.locator("[data-page] h1")).toBeVisible({
          timeout: 45_000,
        });
        const field = page.locator('input[type="search"]');
        if (await field.isVisible()) await page.keyboard.press("/");
        else
          await page
            .locator("[data-discover-scroll] header button[aria-expanded]")
            .click();
        await expect(field).toBeFocused();
        // slower than the pause before the link changes
        await page.keyboard.type("rust", { delay: 180 });
        await expect(field).toHaveValue("rust");
        await expect(field).toBeFocused();
        await expect(card(page, RUST._id)).toBeVisible();
      } finally {
        await page.context().close();
      }
    });

    test(`a category starts a fresh list, a second click takes it off: ${where} ${size.name}`, async ({
      browser,
    }) => {
      test.setTimeout(90_000);
      const page = await openVersion(browser, where, "en", size);
      try {
        const word = page.locator('[data-words] a[href*="technology"]');
        const field = page.locator('input[type="search"]');
        await page.goto(`${base}?q=rust&sort=new`);
        await expect(card(page, RUST._id)).toBeVisible({ timeout: 45_000 });
        await word.click();
        await expect(page).toHaveURL(/technology$/);
        await expect(field).toHaveValue("");
        await expect(word).toHaveAttribute("aria-current", "true");
        await expect(card(page, TECH_ALSO._id)).toBeVisible();

        // a language goes too
        await page.goto(`${base}/de`);
        await expect(word).toBeVisible({ timeout: 45_000 });
        await word.click();
        await expect(page).toHaveURL(/technology$/);

        // and a tag
        await page.goto(`${base}?tag=rust`);
        await expect(card(page, RUST._id)).toBeVisible({ timeout: 45_000 });
        await word.click();
        await expect(page).toHaveURL(/technology$/);

        // the second click goes back to browsing
        await word.click();
        await expect(page).not.toHaveURL(/technology/);
        await expect(page.locator("[data-hero] h1")).toBeVisible();
      } finally {
        await page.context().close();
      }
    });

    test(`Arabic search, as people type it: ${where} ${size.name}`, async ({
      browser,
    }) => {
      test.setTimeout(90_000);
      const page = await openVersion(browser, where, "ar", size);
      try {
        await page.goto(base);
        await expect(page.locator("[data-hero] h1")).toBeVisible({
          timeout: 45_000,
        });
        // the name is written with a ta marbuta, the person types a ha
        await search(page, "الحاره");
        await expect(card(page, SERVERS[0]._id)).toBeVisible();
        await expect(card(page, RUST._id)).toBeHidden();
        await expect(page.locator("h2[data-view-heading]")).toContainText(
          "الحاره",
        );
        await noSidewaysScroll(page, size.width);
      } finally {
        await page.context().close();
      }
    });
  }
}

for (const size of SIZES) {
  for (const { where, base } of VERSIONS) {
    test(`a search typed on a page opened from a card keeps the field: ${where} ${size.name}`, async ({
      browser,
    }) => {
      test.setTimeout(90_000);
      const page = await openVersion(browser, where, "en", size);
      try {
        await page.goto(base);
        const button = card(page, RUST._id).locator("> button");
        await button.waitFor({ state: "attached", timeout: 45_000 });
        // a person on the keyboard: the card, Enter, then the search
        await button.focus();
        await page.keyboard.press("Enter");
        await expect(page.locator("[data-page] h1")).toBeVisible();
        const field = page.locator('input[type="search"]');
        if (await field.isVisible()) await page.keyboard.press("/");
        else
          await page
            .locator("[data-discover-scroll] header button[aria-expanded]")
            .click();
        await expect(field).toBeFocused();
        await page.keyboard.type(RUST.name.slice(0, 6), { delay: 180 });
        await page.waitForTimeout(300);
        await expect(field).toBeFocused();
        await expect(field).toHaveValue(RUST.name.slice(0, 6));
      } finally {
        await page.context().close();
      }
    });
  }
}

test("the site's frame knows it has moved, by observer", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const page = await openVersion(browser, "site", "en", SIZES[0]);
  try {
    await page.goto(SITE);
    const frame = page.locator("[data-moved]");
    await expect(frame).toHaveAttribute("data-moved", "false", {
      timeout: 45_000,
    });
    await frame.evaluate((el) => el.scrollTo(0, 200));
    await expect(frame).toHaveAttribute("data-moved", "true");
    await frame.evaluate((el) => el.scrollTo(0, 0));
    await expect(frame).toHaveAttribute("data-moved", "false");
  } finally {
    await page.context().close();
  }
});

/** Far down the wall, then into a server's page; ready for what comes next */
async function openFromWall(page: Page, base: string, keyboard: boolean) {
  await page.goto(base);
  const far = card(page, SERVERS[8]._id);
  await far.waitFor({ state: "attached", timeout: 45_000 });
  // billing arrives after the page and the lists load once more
  await page.waitForTimeout(800);
  await far.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  expect(await scrolled(page)).toBeGreaterThan(200);
  if (keyboard) {
    await far.locator("> button").focus();
    await page.keyboard.press("Enter");
  } else await far.locator("h3 span").first().click();
  await expect(page.locator("[data-page] h1")).toBeVisible();
}

for (const size of SIZES) {
  for (const { where, base } of VERSIONS) {
    test(`Bots tab on a server page starts at the top: ${where} ${size.name}`, async ({
      browser,
    }) => {
      test.setTimeout(90_000);
      const page = await openVersion(browser, where, "en", size);
      try {
        await openFromWall(page, base, false);
        await page.getByRole("tab").nth(1).click();
        await expect(page.locator("[data-hero] h1")).toBeVisible();
        await expect(page).toHaveURL(/\/bots$/);
        await page.waitForTimeout(300);
        expect(await scrolled(page)).toBeLessThan(5);
      } finally {
        await page.context().close();
      }
    });

    test(`Servers tab on a server page keeps the tab: ${where} ${size.name}`, async ({
      browser,
    }) => {
      test.setTimeout(90_000);
      const page = await openVersion(browser, where, "en", size);
      try {
        await openFromWall(page, base, true);
        const tab = page.getByRole("tab").first();
        await tab.focus();
        await page.keyboard.press("Enter");
        await expect(page.locator("[data-hero] h1")).toBeVisible();
        await page.waitForTimeout(300);
        await expect(tab).toBeFocused();
        expect(await scrolled(page)).toBeLessThan(5);
      } finally {
        await page.context().close();
      }
    });
  }

  test(`a link on a server page does not pull back to the card: ${size.name}`, async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const page = await openVersion(browser, "site", "en", size);
    try {
      await openFromWall(page, SITE, true);
      // the category in the page's own numbers
      await page.locator("[data-page] dd a").first().click();
      await expect(page.locator("[data-page] h1")).toBeHidden();
      await page.waitForTimeout(300);
      expect(await scrolled(page)).toBeLessThan(5);
      const inCard = await page.evaluate(
        () => !!document.activeElement?.closest("[data-listing]"),
      );
      expect(inCard).toBe(false);
    } finally {
      await page.context().close();
    }
  });
}
