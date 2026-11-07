import { Browser, expect, test } from "@playwright/test";

import {
  API,
  APP,
  LOCALES,
  SERVERS,
  SITE,
  SIZES,
  signIn,
  signOut,
  stubDiscover,
} from "./discover-fixtures.mjs";

/**
 * What the law asks of Discover and Designs, as people meet it: a paid
 * server's own page says it is an ad, similar communities are never paid
 * places, and anyone can report a community design, with or without an
 * account, from its page and from its dialog, on the Designs site too.
 *
 * Fabricated in this browser, as the dev stack has none of it: listings and
 * one published community design. Real: the login and the pages.
 *
 * The Designs site runs on designs.localhost, which the dev API does not
 * allow: for that origin requests go without it and answers carry an allow
 * header here.
 */

const DESIGNS = process.env.E2E_DESIGNS ?? "http://designs.localhost:31133";
const ITEM_ID = "01HTESTDES1GN0000000000001";
const ITEM = {
  _id: ITEM_ID,
  kind: "Decoration",
  name: "Test halo",
  description: "A design for the test.",
  tags: [],
  status: "Published",
  creator_id: "",
  file: {
    _id: "d1",
    tag: "attachments",
    filename: "d1.png",
    metadata: { type: "Image", width: 64, height: 64 },
    content_type: "image/png",
    size: 1,
  },
  version: 1,
  uses: 3,
  favourite: false,
};

const PAID = SERVERS[3]; // Boost
/** A free server on the topic of a paid one */
const NEIGHBOUR = {
  ...SERVERS[13],
  _id: "01HTESTNE1GHB0VR0000000001",
  name: "Free neighbour",
  link: "mock-40",
};
const FREE = SERVERS[1];

let state: Awaited<ReturnType<typeof signIn>> | undefined;

test.beforeAll(async ({ browser }) => {
  state = await signIn(browser);
});

test.afterAll(async ({ browser }) => {
  await signOut(browser, state);
});

type Size = (typeof SIZES)[number];

async function open(
  browser: Browser,
  locale: string,
  size: Size,
  account: boolean,
) {
  const context = await browser.newContext({
    locale,
    viewport: { width: size.width, height: size.height },
    storageState: account ? state : undefined,
  });
  await stubDiscover(context, { realServers: [NEIGHBOUR] });
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
  };
  await context.route(`${API}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: cors });
    if (path === `/community/items/${ITEM_ID}`)
      return route.fulfill({
        json: { item: ITEM, version: 1, history: [], reporters: [] },
        headers: cors,
      });
    if (/^\/community\/(decorations|nameplates)$/.test(path))
      return route.fulfill({
        json: {
          items: path.endsWith("decorations") ? [ITEM] : [],
          creators: [],
        },
        headers: cors,
      });
    if (
      request.url().startsWith(API) &&
      request.headers().origin?.includes("designs.")
    ) {
      // the dev API refuses this origin: ask without it
      const headers = { ...request.headers() };
      delete headers.origin;
      const response = await route.fetch({ headers });
      return route.fulfill({
        response,
        headers: { ...response.headers(), ...cors },
      });
    }
    return route.fallback();
  });
  await context.route("https://zrzur.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>form</title>" }),
  );
  return context.newPage();
}

const reportAddress = (locale: string) =>
  locale === "en" ? "/report" : `/${locale}/report`;

for (const locale of LOCALES) {
  for (const size of SIZES) {
    test.describe(`${locale} ${size.name}`, () => {
      test.setTimeout(120_000);

      for (const where of ["app", "site"] as const) {
        test(`a paid server's own page says it is an ad: ${where}`, async ({
          browser,
        }) => {
          const page = await open(browser, locale, size, where === "app");
          try {
            const base = where === "app" ? `${APP}/discover` : SITE;
            await page.goto(`${base}/${PAID.link}`);
            const place = page.locator("[data-page]");
            await expect(place.locator("h1")).toBeVisible({ timeout: 45_000 });
            const label = place.getByTestId("ad-label");
            await expect(label).toBeVisible();
            await label.getByTestId("ad-why").click();
            await expect(page.getByTestId("ad-note")).toContainText(PAID.name);
            await page.keyboard.press("Escape");

            // and a free one does not
            await page.goto(`${base}/${FREE.link}`);
            await expect(place.locator("h1")).toBeVisible({ timeout: 45_000 });
            await expect(place.getByTestId("ad-label")).toHaveCount(0);
          } finally {
            await page.context().close();
          }
        });
      }

      test("similar communities are never paid places", async ({ browser }) => {
        const page = await open(browser, locale, size, false);
        try {
          // same topic: the paid one, and a free neighbour that must show
          await page.goto(`${SITE}/${SERVERS[13].link}`);
          await expect(page.locator("[data-page] h1")).toBeVisible({
            timeout: 45_000,
          });
          await expect(
            page.locator(`[data-page] a[href="/${NEIGHBOUR.link}"]`),
          ).toBeVisible({ timeout: 20_000 });
          await expect(
            page.locator(`[data-page] a[href="/${SERVERS[0].link}"]`),
          ).toHaveCount(0);
        } finally {
          await page.context().close();
        }
      });

      test("a visitor reports a design from its page, on the Designs site", async ({
        browser,
      }) => {
        const page = await open(browser, locale, size, false);
        try {
          await page.goto(`${DESIGNS}/${ITEM_ID}`);
          const report = page.locator("[data-design-report]");
          await expect(report).toBeVisible({ timeout: 45_000 });
          await report.click();
          await page.waitForURL(/^https:\/\/zrzur\.com\//);
          const url = new URL(page.url());
          expect(url.pathname).toBe(reportAddress(locale));
          expect(url.searchParams.get("kind")).toBe("CommunityItem");
          expect(url.searchParams.get("location")?.toLowerCase()).toContain(
            ITEM_ID.toLowerCase(),
          );
        } finally {
          await page.context().close();
        }
      });

      test("signed in, a design's page opens the report dialog", async ({
        browser,
      }) => {
        const page = await open(browser, locale, size, true);
        try {
          await page.goto(`${APP}/designs/${ITEM_ID}`);
          const report = page.locator("[data-design-report]");
          await expect(report).toBeVisible({ timeout: 45_000 });
          await report.click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await expect(
            page.getByRole("dialog").getByRole("listitem").first(),
          ).toBeVisible({
            timeout: 20_000,
          });
          expect(new URL(page.url()).hostname).toBe("localhost");
        } finally {
          await page.context().close();
        }
      });

      test("signed in, a design's dialog opens the report dialog", async ({
        browser,
      }) => {
        const page = await open(browser, locale, size, true);
        try {
          await page.goto(`${APP}/designs/community`);
          await page
            .locator("button", { hasText: ITEM.name })
            .first()
            .click({ timeout: 45_000 });
          const details = page.getByRole("dialog");
          await details.locator("[data-design-report]").click();
          await expect(
            page.getByRole("dialog").getByRole("listitem").first(),
          ).toBeVisible({ timeout: 20_000 });
        } finally {
          await page.context().close();
        }
      });

      test("a visitor reports a design from its dialog, and sees no empty creator button", async ({
        browser,
      }) => {
        const page = await open(browser, locale, size, false);
        const posts: string[] = [];
        page.on("request", (request) => {
          if (request.method() === "POST" && request.url().includes("/report"))
            posts.push(request.url());
        });
        try {
          await page.goto(`${DESIGNS}/community`);
          const tile = page.locator("button", { hasText: ITEM.name }).first();
          await tile.click({ timeout: 45_000 });
          const dialog = page.getByRole("dialog");
          await expect(dialog).toBeVisible();
          // the creator is not public: nothing to press
          await expect(dialog.locator("button.creator")).toHaveCount(0);
          await dialog.locator("[data-design-report]").click();
          await page.waitForURL(/^https:\/\/zrzur\.com\//);
          const url = new URL(page.url());
          expect(url.pathname).toBe(reportAddress(locale));
          expect(url.searchParams.get("kind")).toBe("CommunityItem");
          expect(posts).toEqual([]);
        } finally {
          await page.context().close();
        }
      });
    });
  }
}
