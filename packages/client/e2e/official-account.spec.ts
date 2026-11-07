import { Browser, Page, expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import {
  API,
  APP,
  LOCALES,
  SIZES,
  sessionToken,
  signIn,
  signOut,
} from "./discover-fixtures.mjs";

/**
 * Official accounts are not normal users. A person who got a message from one
 * (the first dev-stack account has one, a real support answer) finds no way
 * to add, block, report or open it, or to touch its messages, in the
 * conversation, the list of conversations and the Add friend window.
 * Everything here is real. The account is found by the mark, not by an id.
 */

/** What must never be offered for this account */
const NEVER = [
  "Profile",
  "Message",
  "Mention",
  "Add friend",
  "Block user",
  "Report user",
  "Report message",
  "Copy user ID",
  "Member since",
  "Close chat",
  "React",
  "Reply",
  "Pin message",
  "Unpin message",
  "Copy message link",
  "Start thread",
];

/** An English string in the locale under test */
function say(locale: string, english: string) {
  if (locale === "en") return english;
  const po = readFileSync(
    new URL(
      `../components/i18n/catalogs/${locale}/messages.po`,
      import.meta.url,
    ),
    "utf8",
  );
  const start = po.indexOf(`\nmsgid "${english}"\n`);
  expect(start, english).toBeGreaterThan(-1);
  return po.slice(start).match(/msgstr "(.*)"/)![1];
}

let state: Awaited<ReturnType<typeof signIn>> | undefined;
let channel = "";
let messageId = "";
/** The official account of the conversation */
let official = "";
let names: Record<string, string> = {};

/** Its name in the language of the app */
const nameIn = (locale: string) => names[locale.split("-")[0]];

test.beforeAll(async ({ browser }) => {
  state = await signIn(browser, 0);
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  try {
    await page.goto(`${APP}/login`, { waitUntil: "commit" });
    await page.waitForTimeout(1500);
    const token = await sessionToken(page);
    const answer = await page.request.get(`${API}/users/dms`, {
      headers: { "x-session-token": token as string },
    });
    const dms: { _id: string; recipients?: string[] }[] = await answer.json();
    for (const dm of dms) {
      for (const id of dm.recipients ?? []) {
        const user = await page.request.get(`${API}/users/${id}`, {
          headers: { "x-session-token": token as string },
        });
        const found = (await user.json()) as {
          official?: boolean;
          official_names?: Record<string, string>;
        };
        if (found.official) {
          channel = dm._id;
          official = id;
          names = found.official_names ?? {};
        }
      }
    }
    expect(channel, "a conversation with an official account").toBeTruthy();
    const messages = await page.request.get(
      `${API}/channels/${channel}/messages?limit=1`,
      { headers: { "x-session-token": token as string } },
    );
    messageId = ((await messages.json()) as { _id: string }[])[0]._id;
  } finally {
    await context.close();
  }
});

test.afterAll(async ({ browser }) => {
  await signOut(browser, state);
});

async function open(
  browser: Browser,
  locale: string,
  size: (typeof SIZES)[number],
) {
  const context = await browser.newContext({
    locale,
    viewport: { width: size.width, height: size.height },
    storageState: state,
  });
  const page = await context.newPage();
  await page.goto(`${APP}/channel/${channel}`);
  return page;
}

/** Nothing opened: no card, no dialog */
async function nothingOpened(page: Page) {
  await page.waitForTimeout(500);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#floating")).not.toContainText("@");
}

/** The words in what is on screen outside the conversation */
async function offersNone(page: Page, locale: string) {
  const floating = page.locator("#floating");
  for (const english of NEVER)
    await expect(
      floating.getByText(say(locale, english), { exact: true }),
      english,
    ).toHaveCount(0);
}

for (const locale of LOCALES) {
  for (const size of SIZES) {
    test.describe(`${locale} ${size.name}`, () => {
      test.setTimeout(150_000);

      test("the account in a conversation opens nothing", async ({
        browser,
      }) => {
        const page = await open(browser, locale, size);
        try {
          const message = page.locator(`[id="${messageId}"]`);
          await message.waitFor({ timeout: 45_000 });
          const image = message.locator(`img[src*="${official}"]`).first();
          const shown = nameIn(locale);
          const name = message.getByText(shown, { exact: true }).first();

          // the chip, in the badges design
          await expect(message.locator("[data-badge-tag]")).toBeVisible();

          // a press on the picture or the name does nothing
          await image.click();
          await nothingOpened(page);
          await name.click();
          await nothingOpened(page);

          // no menu of a person on them
          await image.click({ button: "right" });
          await page.waitForTimeout(400);
          await offersNone(page, locale);
          await page.keyboard.press("Escape");
          await name.click({ button: "right" });
          await page.waitForTimeout(400);
          await offersNone(page, locale);
          await page.keyboard.press("Escape");

          // the message's own menu has no report
          await message.locator("p, [dir='auto']").last().click({
            button: "right",
          });
          await page.waitForTimeout(400);
          await offersNone(page, locale);
          await page.keyboard.press("Escape");

          // the conversation header and its start: the name opens nothing
          // (only what a person can reach: a phone keeps the list off screen)
          const spots = await page.evaluate((shown) =>
            [...document.querySelectorAll("body *")]
              .filter((el) => el.children.length === 0)
              .filter((el) => el.textContent?.trim() === shown)
              .map((el) => el.getBoundingClientRect())
              .map((box) => ({
                x: box.x + box.width / 2,
                y: box.y + box.height / 2,
              }))
              .filter(({ x, y }) => {
                const top = document.elementFromPoint(x, y);
                return top?.textContent?.trim() === shown;
              }),
          shown);
          expect(spots.length).toBeGreaterThan(0);
          for (const { x, y } of spots) {
            await page.mouse.click(x, y);
            await nothingOpened(page);
          }
          await expect(
            page.getByText(say(locale, "Member since"), { exact: true }),
          ).toHaveCount(0);

          // nothing clickable about the name
          const cursor = await name.evaluate(
            (el) => getComputedStyle(el).cursor,
          );
          expect(cursor).not.toBe("pointer");
        } finally {
          await page.context().close();
        }
      });

      test("an official message offers copy and mark as unread only", async ({
        browser,
      }) => {
        const page = await open(browser, locale, size);
        try {
          const message = page.locator(`[id="${messageId}"]`);
          await message.waitFor({ timeout: 45_000 });

          // no hover bar
          await message.hover();
          await page.waitForTimeout(400);
          await expect(message.locator(".Toolbar")).toHaveCount(0);
          await expect(
            page.getByRole("toolbar", { name: say(locale, "Message actions") }),
          ).toHaveCount(0);

          await message.locator("p, [dir='auto']").last().click({
            button: "right",
          });
          const floating = page.locator("#floating");
          await expect(
            floating.getByText(say(locale, "Copy text"), { exact: true }),
          ).toBeVisible();
          await expect(
            floating.getByText(say(locale, "Mark as unread"), { exact: true }),
          ).toBeVisible();
          await offersNone(page, locale);

          // the action works: nothing refused, the menu closes
          await floating
            .getByText(say(locale, "Mark as unread"), { exact: true })
            .click();
          await expect(floating.getByText(say(locale, "Copy text"))).toHaveCount(
            0,
          );

          // the message box stays away: the ticket is the way to answer
          await expect(
            page.getByText(say(locale, "Reply in a ticket"), { exact: true }),
          ).toBeVisible();
          await expect(page.locator("textarea")).toHaveCount(0);

          // the picture is the current logo, at the new address
          const image = message.locator(`img[src*="${official}"]`).first();
          await expect(image).toHaveAttribute("src", /default_avatar\?v=2/);
          const logo = await page.request.get(
            (await image.getAttribute("src")) as string,
          );
          expect(logo.headers()["cache-control"]).toBe("public, max-age=3600");

          // no sideways scroll
          const overflow = await page.evaluate(
            () =>
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
          );
          expect(overflow).toBeLessThanOrEqual(0);
        } finally {
          await page.context().close();
        }
      });

      test("the list of conversations offers no person's menu", async ({
        browser,
      }) => {
        const page = await open(browser, locale, size);
        try {
          await page
            .locator(`[id="${messageId}"]`)
            .waitFor({ timeout: 45_000 });
          // phones: the list is its own screen
          if (size.width < 600) {
            await page.goto(`${APP}/app`);
            await page
              .locator(`[aria-label="${say(locale, "Toggle main sidebar")}"]`)
              .first()
              .click({ timeout: 45_000 });
            await page.waitForTimeout(800);
          }
          const row = page.locator(`a[href="/channel/${channel}"]`).first();
          await row.waitFor({ timeout: 45_000 });
          await expect(row.locator("[data-badge-tag]")).toBeVisible();
          await row.click({ button: "right" });
          await page.waitForTimeout(400);
          await offersNone(page, locale);
          await expect(
            page.locator("#floating").getByText(say(locale, "Close chat")),
          ).toHaveCount(0);
        } finally {
          await page.context().close();
        }
      });

      test("Add friend says plainly it cannot be added", async ({
        browser,
      }) => {
        const context = await browser.newContext({
          locale,
          viewport: { width: size.width, height: size.height },
          storageState: state,
        });
        const page = await context.newPage();
        try {
          await page.goto(`${APP}/friends`);
          await page
            .getByRole("button", { name: say(locale, "Add friend") })
            .first()
            .click({ timeout: 45_000 });
          const dialog = page.getByRole("dialog");
          await dialog.locator("input").fill("zrzur#0001");
          await dialog
            .getByRole("button", { name: say(locale, "Send request") })
            .click();
          await expect(dialog).toContainText(
            say(locale, "This is an official Zrzur account. It can't be added."),
          );
          await expect(page.getByRole("dialog")).toHaveCount(1);
        } finally {
          await context.close();
        }
      });
    });
  }
}
