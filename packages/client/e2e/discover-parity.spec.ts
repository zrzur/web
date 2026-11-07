import { Browser, Locator, Page, expect, test } from "@playwright/test";

import {
  APP,
  BOTS,
  LOCALES,
  SITE,
  SIZES,
  TOP_ROW,
  signIn,
  signOut,
  stubDiscover,
} from "./discover-fixtures.mjs";

/**
 * Discover in the app and the Discover site are one design: this opens both
 * at once, with the same listings, and fails on any difference that is not
 * the frame (the rail around the app, the header and footer of the site).
 * Then it holds both against /designs, the page they are modelled on.
 *
 * Covered: the views, the page scrolled, tablet width, hover and keyboard
 * focus, and the loading, error, empty, billing-off and promote-slot states.
 *
 * Build once for two origins and serve it on one port:
 *   VITE_HOST=localhost:31133 VITE_DISCOVER_URL=http://127.0.0.1:31133
 *   VITE_API_URL=http://127.0.0.1:14702 (other VITE_DEV_* of the dev stack)
 * The session is the second dev-stack account; it is ended in afterAll.
 */

/** Allowed difference in px: subpixel layout only */
const SLACK = 0.5;

const WIDTHS = [...SIZES, { name: "tablet", width: 800, height: 900 }];

/** Parts of the page, each in reading order. Everything is inside the frame. */
const PARTS = [
  "[data-discover-scroll] header",
  '[role="tablist"] a',
  'input[type="search"]',
  "[data-hero]",
  "[data-hero] svg",
  "[data-view-heading]",
  "[data-hero] p",
  "[data-words] > *",
  "section h2",
  "section strong",
  "[role='radio']",
  "article[data-listing]",
  "article[data-listing] h3",
  "article[data-listing] [data-picture]",
  "article[data-listing] [data-description]",
  "article[data-listing] [data-testid='ad-label']",
  "article[data-listing] [data-action] button",
  "[data-skeleton]",
  "[data-empty]",
  "[data-empty] strong",
  "[data-owners]",
  "[data-owners-action]",
  "[data-page] h1",
  "[data-page] dl",
  "[data-page] dd",
  "[data-page] button",
  '[role="dialog"]',
  '[role="dialog"] h2',
  '[role="dialog"] button',
].join(", ");

const STYLES = [
  "color",
  "backgroundColor",
  "backgroundImage",
  "borderTopColor",
  "borderTopWidth",
  "borderTopLeftRadius",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "boxShadow",
  "opacity",
  "outlineStyle",
  "outlineWidth",
  "outlineColor",
  "outlineOffset",
] as const;

type Part = {
  tag: string;
  text: string;
  /** Its width and place follow the account or the frame, its look does not */
  free: boolean;
  /** The Hero title follows the width the frame leaves */
  fluid: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  style: string[];
};

/** Every part, placed from the top of the page's own content */
async function read(page: Page) {
  // the note for people without an account is a state, not a design
  await page.addStyleTag({ content: "[data-visitor-note] { display: none }" });
  await page.waitForTimeout(200);
  return page.evaluate(
    ({ parts, styles }) => {
      const root = document.querySelector("[data-discover-scroll]")!;
      const box = root.getBoundingClientRect();
      // the column is centred in what the frame leaves: measure from it
      const column = root
        .querySelector("header")!
        .parentElement!.getBoundingClientRect();
      const start = column.left;
      const top = Math.max(box.top, 0);
      return {
        /** The rail and scrollbar change the box, not the column inside it */
        width: Math.round(column.width),
        page: getComputedStyle(root.closest("main")!).backgroundColor,
        parts: [...document.querySelectorAll<HTMLElement>(parts)]
          .filter((el) => el.getClientRects().length)
          .map((el) => {
            const rect = el.getBoundingClientRect();
            const css = getComputedStyle(el);
            // what floats over the page keeps to the screen, not the frame;
            // a dialog is measured from its own corner
            const panel = el.closest('[role="dialog"]');
            const dialog = panel === el ? rect : panel?.getBoundingClientRect();
            const left = dialog ? dialog.left : start;
            const y = css.position === "fixed" ? window.innerHeight : top;
            const owners = el.matches("[data-owners]");
            const free = el.matches("[data-owners-action]");
            return {
              tag:
                (el.matches("[data-owners-action]")
                  ? "action"
                  : el.tagName.toLowerCase()) +
                (el.dataset.listing ? `#${el.dataset.listing}` : "") +
                (el.dataset.stuck ? `[${el.dataset.stuck}]` : ""),
              // the card's own words count; its button depends on the account
              text: free
                ? ""
                : ((owners ? el.querySelector("div") : el)?.innerText ?? "")
                    .trim()
                    .slice(0, 40),
              // the sky runs edge to edge of whatever the frame leaves
              free: free || el.matches("[data-hero], [data-hero] svg"),
              fluid: el.matches("[data-hero] h1"),
              x: +(rect.left - left).toFixed(1),
              y: +(rect.top - (dialog ? dialog.top : y)).toFixed(1),
              width: +rect.width.toFixed(1),
              height: +rect.height.toFixed(1),
              style: styles.map((name) => css[name] as string),
            };
          }),
      };
    },
    { parts: PARTS, styles: [...STYLES] },
  );
}

/** Cards in each row of the wall: the same at any width of the frame */
const rows = (parts: Part[]) => {
  const count = new Map<number, number>();
  for (const part of parts)
    if (part.tag.startsWith("article"))
      count.set(part.y, (count.get(part.y) ?? 0) + 1);
  return [...count.values()];
};

function compare(name: string, app: Part[], site: Part[], exact: boolean) {
  const problems: string[] = [];
  const keys = (parts: Part[]) => parts.map((p) => `${p.tag}:${p.text}`);
  expect(keys(site), `${name}: order and text`).toEqual(keys(app));
  if (!exact) expect(rows(site), `${name}: rows`).toEqual(rows(app));
  app.forEach((a, i) => {
    const b = site[i];
    if (exact)
      for (const size of ["x", "y", "width", "height"] as const) {
        if (a.free && (size === "x" || size === "width")) continue;
        if (Math.abs(a[size] - b[size]) > SLACK)
          problems.push(
            `${a.tag} "${a.text}" ${size}: ${a[size]} / ${b[size]}`,
          );
      }
    a.style.forEach((value, n) => {
      // the title follows the width the frame leaves, as on Designs
      const size = ["fontSize", "lineHeight"].includes(STYLES[n]);
      if (!exact && size && a.fluid) return;
      if (value !== b.style[n])
        problems.push(
          `${a.tag} "${a.text}" ${STYLES[n]}: ${value} / ${b.style[n]}`,
        );
    });
  });
  expect(problems, `${name}: app / site`).toEqual([]);
}

/** Both sides, read at once and compared. Exact when the frame leaves both the same width. */
async function same(name: string, app: Page, site: Page, size: Size) {
  const a = await read(app);
  const b = await read(site);
  expect(a.parts.length, name).toBeGreaterThan(2);
  expect(b.page, `${name}: page colour`).toBe(a.page);
  // only a tablet may be loose: elsewhere the pixel check must not switch off
  if (size.name !== "tablet")
    expect(b.width, `${name}: column width`).toBe(a.width);
  compare(name, a.parts, b.parts, a.width === b.width);
}

const VIEWS: {
  name: string;
  app: string;
  site: string;
  /** Sign the page is ready */
  wait: string;
}[] = [
  { name: "servers", app: "/discover", site: "/", wait: "[data-hero]" },
  { name: "bots", app: "/discover/bots", site: "/bots", wait: "[data-hero]" },
  {
    name: "search",
    app: "/discover?q=rust",
    site: "/?q=rust",
    wait: "article[data-listing]",
  },
  {
    name: "category",
    app: "/discover/gaming",
    site: "/gaming",
    wait: "article[data-listing]",
  },
  {
    name: "server page",
    app: "/discover/mock-2",
    site: "/mock-2",
    wait: "[data-page] h1",
  },
  {
    name: "server without a banner",
    app: "/discover/mock-3",
    site: "/mock-3",
    wait: "[data-page] h1",
  },
  {
    name: "bot details",
    app: `/discover/bots/${BOTS[0]._id}`,
    site: `/bots/${BOTS[0]._id}`,
    wait: '[role="dialog"]',
  },
];

let state: Awaited<ReturnType<typeof signIn>> | undefined;

test.beforeAll(async ({ browser }) => {
  state = await signIn(browser);
});

test.afterAll(async ({ browser }) => {
  await signOut(browser, state);
});

type Size = (typeof WIDTHS)[number];
type Stub = Parameters<typeof stubDiscover>[1];

/** One browser for the app and one for the site, at the same size and language */
async function open(
  browser: Browser,
  origin: string,
  path: string,
  locale: string,
  size: Size,
  stub?: Stub,
) {
  const context = await browser.newContext({
    locale,
    viewport: { width: size.width, height: size.height },
    storageState: origin === APP ? state : undefined,
    colorScheme: "dark",
  });
  await stubDiscover(context, stub);
  const page = await context.newPage();
  await page.goto(`${origin}${path}`);
  return page;
}

async function both(
  browser: Browser,
  view: { app: string; site: string },
  locale: string,
  size: Size,
  run: (app: Page, site: Page) => Promise<void>,
  stub?: Stub,
) {
  const app = await open(browser, APP, view.app, locale, size, stub);
  const site = await open(browser, SITE, view.site, locale, size, stub);
  try {
    await run(app, site);
  } finally {
    await app.context().close();
    await site.context().close();
  }
}

const ready = async (app: Page, site: Page, selector: string) => {
  await app.locator(selector).first().waitFor({ timeout: 45_000 });
  await site.locator(selector).first().waitFor({ timeout: 45_000 });
  await app.waitForTimeout(800);
  await site.waitForTimeout(800);
};

/** The same distance down the page's content, whichever box scrolls */
const scrollDown = (page: Page, by: number) =>
  page.evaluate((distance) => {
    const root = document.querySelector("[data-discover-scroll]")!;
    let box: Element | null = root;
    while (box && getComputedStyle(box).overflowY !== "auto")
      box = box.parentElement;
    const lead =
      root.getBoundingClientRect().top - box!.getBoundingClientRect().top;
    box!.scrollTop = box!.scrollTop + lead + distance;
  }, by);

/** What a control looks like, right now */
const look = (locator: Locator) =>
  locator.evaluate(
    (el, names) => {
      const css = getComputedStyle(el);
      return names.map((name) => css[name as "color"]);
    },
    [...STYLES] as string[],
  );

const CONTROLS = [
  '[role="tablist"] a',
  "[data-words] a",
  "article[data-listing]",
  "article[data-listing] [data-action] button",
];

for (const locale of LOCALES) {
  for (const size of WIDTHS) {
    test.describe(`${locale} ${size.name}`, () => {
      test.setTimeout(300_000);

      test("the app and the site are one design", async ({ browser }) => {
        for (const view of VIEWS)
          await both(browser, view, locale, size, async (app, site) => {
            await ready(app, site, view.wait);
            await same(view.name, app, site, size);
          });
      });

      test("scrolled down they are still one design", async ({ browser }) => {
        await both(browser, VIEWS[0], locale, size, async (app, site) => {
          await ready(app, site, "[data-hero]");
          await scrollDown(app, 900);
          await scrollDown(site, 900);
          await app.waitForTimeout(400);
          await site.waitForTimeout(400);
          await same("scrolled", app, site, size);
        });
      });

      test("hover and keyboard focus look the same", async ({ browser }) => {
        await both(browser, VIEWS[0], locale, size, async (app, site) => {
          await ready(app, site, "[data-hero]");
          for (const selector of CONTROLS) {
            const a = app.locator(selector).nth(1);
            const b = site.locator(selector).nth(1);
            await a.hover();
            await b.hover();
            await app.waitForTimeout(260);
            await site.waitForTimeout(260);
            expect(await look(b), `${selector} hover`).toEqual(await look(a));
          }
          await app.mouse.move(0, 0);
          await site.mouse.move(0, 0);
          await app.keyboard.press("Tab");
          await site.keyboard.press("Tab");
          for (const selector of [
            '[role="tablist"] a',
            "[data-words] a",
            "article[data-listing] > button",
          ]) {
            const a = app.locator(selector).nth(1);
            const b = site.locator(selector).nth(1);
            await a.focus();
            await b.focus();
            await app.waitForTimeout(200);
            await site.waitForTimeout(200);
            const seen = await look(b);
            expect(seen, `${selector} focus`).toEqual(await look(a));
            expect(seen[STYLES.indexOf("outlineStyle")]).toBe("solid");
          }
        });
      });

      test("loading, error and empty look the same", async ({ browser }) => {
        await both(
          browser,
          VIEWS[0],
          locale,
          size,
          async (app, site) => {
            await ready(app, site, "[data-skeleton]");
            await same("loading", app, site, size);
          },
          { mode: "hold" },
        );
        await both(
          browser,
          VIEWS[0],
          locale,
          size,
          async (app, site) => {
            await ready(app, site, "[data-empty]");
            await same("error", app, site, size);
          },
          { mode: "fail" },
        );
        await both(
          browser,
          VIEWS[0],
          locale,
          size,
          async (app, site) => {
            await ready(app, site, "[data-empty]");
            await same("empty", app, site, size);
          },
          { mode: "empty" },
        );
      });

      test("the top row: billing off, and the promote slot", async ({
        browser,
      }) => {
        const paid = `[data-listing="${TOP_ROW[0]._id}"]`;
        // no places on sale: no row in either
        await both(
          browser,
          VIEWS[0],
          locale,
          size,
          async (app, site) => {
            await ready(app, site, "[data-hero]");
            await expect(app.locator(paid)).toHaveCount(0);
            await expect(site.locator(paid)).toHaveCount(0);
            await same("billing off", app, site, size);
          },
          { billing: false },
        );
        // the free place is offered to owners, in the app: the paid card and
        // the free place get the same room
        const app = await open(browser, APP, "/discover", locale, size, {
          open: 1,
        });
        try {
          const slot = app.locator("[data-promote-slot]");
          await slot.waitFor({ timeout: 45_000 });
          const place = (await app.locator(paid).boundingBox())!;
          const free = (await slot.boundingBox())!;
          expect(Math.abs(place.width - free.width)).toBeLessThanOrEqual(SLACK);
          // beside the paid places where the row has room for it
          if (size.width > 899) expect(free.y).toBe(place.y);
          const wide = await app.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          );
          expect(wide).toBe(true);
        } finally {
          await app.context().close();
        }
      });

      test("Discover speaks the language of /designs", async ({ browser }) => {
        const discover = await open(browser, APP, "/discover", locale, size);
        const designs = await open(browser, APP, "/designs", locale, size);
        try {
          await discover.locator("[data-hero]").waitFor({ timeout: 45_000 });
          await designs.locator("main h1").waitFor({ timeout: 45_000 });
          // Designs' flock flies in once: compare what it settles on
          await designs.waitForTimeout(1200);

          const take = (selector: string) => (page: Page) =>
            page
              .locator(selector)
              .first()
              .evaluate((el) => {
                const css = getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return {
                  x: Math.round(rect.left),
                  width: Math.round(rect.width),
                  fontSize: css.fontSize,
                  fontWeight: css.fontWeight,
                  color: css.color,
                  background: css.backgroundColor,
                };
              });

          // the big title, on the same line of the same grid
          const title = take("main h1");
          expect(await title(discover)).toMatchObject({
            ...(await title(designs)),
            width: expect.any(Number),
          });
          expect(await take("main h1 + p")(discover)).toEqual(
            await take("main h1 + p")(designs),
          );

          // the filter words
          const word = take("nav:not([role=tablist]) > [aria-current]");
          expect(await word(discover)).toMatchObject({
            fontSize: (await word(designs)).fontSize,
            fontWeight: (await word(designs)).fontWeight,
            color: (await word(designs)).color,
          });

          // the ground and the sky
          const ground = (page: Page) =>
            page
              .locator("main")
              .first()
              .evaluate((el) => {
                const main = getComputedStyle(el).backgroundColor;
                const dots = el.querySelector("svg path[fill-opacity]");
                return { main, dots: !!dots };
              });
          expect(await ground(discover)).toEqual(await ground(designs));
        } finally {
          await discover.context().close();
          await designs.context().close();
        }
      });
    });
  }
}

/** Every wall on the page: its cells by row, with where each card's parts sit */
const walls = (page: Page) =>
  page.evaluate(() => {
    const cells = [
      ...document.querySelectorAll(
        "article[data-listing], [data-promote-slot]",
      ),
    ];
    return [...new Set(cells.map((el) => el.parentElement!))].map((grid) => {
      const rows = new Map<number, DOMRect[]>();
      for (const child of grid.children) {
        const box = child.getBoundingClientRect();
        const row = Math.round(box.top);
        rows.set(row, [...(rows.get(row) ?? []), box]);
      }
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        rows: [...rows.values()].map((row) =>
          row.map((box) => ({
            width: box.width,
            height: box.height,
            left: box.left,
          })),
        ),
      };
    });
  });

/** Cards of the page, measured part by part */
const cards = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("article[data-listing]")].map((card) => {
      const box = card.getBoundingClientRect();
      const foot = card.querySelector("[data-footer]")!;
      const footer = foot.getBoundingClientRect();
      const picture = card.querySelector("[data-picture]")!;
      const banner = picture.firstElementChild!.getBoundingClientRect();
      const avatar = card
        .querySelector("[data-avatar]")!
        .getBoundingClientRect();
      const stats = card.querySelector("[data-stats]")!.getBoundingClientRect();
      const flag = card.querySelector("[data-footer] > button");
      const action = card
        .querySelector("[data-action] button")!
        .getBoundingClientRect();
      const count = card.querySelector("[data-stats] > span")!;
      const rtl = getComputedStyle(card).direction === "rtl";
      return {
        width: box.width,
        height: box.height,
        tags: !!card.querySelector("[data-tags]"),
        /** Space under the last row: the same for all when it is pinned */
        underFooter: box.bottom - footer.bottom,
        fits:
          foot.scrollWidth <= foot.clientWidth + 1 &&
          card.scrollHeight <= card.clientHeight + 1 &&
          // a long word stays out of the flag's way
          count.scrollWidth <= count.clientWidth + 1 &&
          stats.bottom <= footer.bottom + 1,
        actionSize: [action.width, action.height],
        bannerFull: Math.abs(banner.width - (box.width - 2)) <= 1,
        avatarOnEdge:
          avatar.top < banner.bottom && avatar.bottom > banner.bottom,
        avatarAtStart: rtl
          ? box.right - avatar.right < box.width / 4
          : avatar.left - box.left < box.width / 4,
        statsAtStart: rtl
          ? box.right - stats.right < 32
          : stats.left - box.left < 32,
        flagBeforeJoin: !flag
          ? true
          : rtl
            ? flag.getBoundingClientRect().right > action.right
            : flag.getBoundingClientRect().left < action.left,
      };
    }),
  );

const spread = (values: number[]) => Math.max(...values) - Math.min(...values);

/** One size: every card in every wall, in both frames */
const holdsOneSize = (list: Awaited<ReturnType<typeof cards>>) => {
  expect(spread(list.map((c) => c.width)), "one width").toBeLessThanOrEqual(1);
  expect(spread(list.map((c) => c.height)), "one height").toBeLessThanOrEqual(
    1,
  );
  expect(
    spread(list.map((c) => c.underFooter)),
    "the last row is pinned",
  ).toBeLessThanOrEqual(1);
  for (const card of list) {
    expect(card.fits, "nothing spills out of the card").toBe(true);
    expect(card.bannerFull, "banner full width").toBe(true);
    expect(card.avatarOnEdge, "icon over the banner's edge").toBe(true);
    expect(card.avatarAtStart, "icon at the start").toBe(true);
    expect(card.statsAtStart, "members at the start").toBe(true);
    expect(card.flagBeforeJoin, "flag, then Join at the end").toBe(true);
  }
};

const COLUMNS = {
  desktop: 4,
  phone: 1,
  tablet: 2,
  "1000": 3,
  "1100": 4,
} as Record<string, number>;

/** The grid has more widths to hold than the rest of the page */
const GRID_WIDTHS = [
  ...WIDTHS,
  { name: "1000", width: 1000, height: 800 },
  { name: "1100", width: 1100, height: 800 },
];

for (const locale of LOCALES) {
  for (const size of GRID_WIDTHS) {
    test.describe(`one size of card, ${locale} ${size.name}`, () => {
      test.setTimeout(180_000);

      for (const view of [
        { name: "servers", app: "/discover", site: "/" },
        { name: "bots", app: "/discover/bots", site: "/bots" },
      ]) {
        test(`${view.name}: the same grid in the app and on the site`, async ({
          browser,
        }) => {
          const app = await open(browser, APP, view.app, locale, size);
          const site = await open(browser, SITE, view.site, locale, size);
          try {
            for (const page of [app, site]) {
              await page
                .locator("article[data-listing]")
                .first()
                .waitFor({ timeout: 45_000 });
              await page.waitForTimeout(500);
              const list = await cards(page);
              holdsOneSize(list);
              if (size.width <= 600)
                for (const card of list) {
                  expect(card.actionSize[0]).toBeGreaterThanOrEqual(44);
                  expect(card.actionSize[1]).toBeGreaterThanOrEqual(44);
                }
              if (view.name === "servers") {
                expect(list.some((c) => c.tags)).toBe(true);
                expect(list.some((c) => !c.tags)).toBe(true);
              }
            }
            for (const page of [app, site]) {
              expect(await page.locator("[data-side], aside").count()).toBe(0);
              // the grid has the page's full width
              const room = await page
                .locator("article[data-listing]")
                .first()
                .evaluate((el) => {
                  const page = el.closest("[data-discover-scroll]")!;
                  const content = page.firstElementChild!;
                  const css = getComputedStyle(content);
                  return (
                    content.clientWidth -
                    parseFloat(css.paddingLeft) -
                    parseFloat(css.paddingRight) -
                    el.parentElement!.clientWidth
                  );
                });
              expect(Math.abs(room)).toBeLessThanOrEqual(1);
            }
            const [inApp, onSite] = [await walls(app), await walls(site)];
            expect(inApp[0].columns).toBe(COLUMNS[size.name]);
            expect(onSite[0].columns).toBe(COLUMNS[size.name]);
            for (const grid of [...inApp, ...onSite])
              for (const row of grid.rows.slice(0, -1))
                expect(row).toHaveLength(grid.columns);
          } finally {
            await app.context().close();
            await site.context().close();
          }
        });
      }
    });
  }
}

for (const size of WIDTHS) {
  test.describe(`the wall, ${size.name}`, () => {
    test.setTimeout(180_000);

    for (const top of [1, 2, 3, 5, 7]) {
      test(`${top} paid places in the same grid`, async ({ browser }) => {
        const site = await open(browser, SITE, "/", "en", size, { top });
        try {
          const paid = site.locator("[data-top] article");
          await paid.first().waitFor();
          await site.waitForTimeout(500);
          // the headline and the row
          await expect(paid).toHaveCount(top + 1);
          for (const place of await paid.all()) {
            await expect(place.getByTestId("ad-label")).toBeVisible();
            await expect(place.getByTestId("ad-why")).toBeVisible();
          }
          holdsOneSize(await cards(site));
        } finally {
          await site.context().close();
        }
      });
    }

    test("a lone free place takes one cell", async ({ browser }) => {
      const app = await open(browser, APP, "/discover", "en", size, {
        count: 8,
        top: 0,
        open: 1,
      });
      try {
        const slot = app.locator("[data-promote-slot]");
        await slot.waitFor({ timeout: 45_000 });
        const [own] = await cards(app);
        const box = (await slot.boundingBox())!;
        expect(Math.abs(box.width - own.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(box.height - own.height)).toBeLessThanOrEqual(1);
      } finally {
        await app.context().close();
      }
    });
  });
}

for (const size of SIZES) {
  test(`a headline with no row on sale has no heading, ${size.name}`, async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    await both(
      browser,
      VIEWS[0],
      "en",
      size,
      async (app, site) => {
        for (const page of [app, site]) {
          await page
            .getByTestId("discover-headline")
            .waitFor({ timeout: 45_000 });
          await expect(
            page.getByRole("heading", { name: "Top row" }),
          ).toHaveCount(0);
        }
      },
      { billing: false },
    );
  });
}

for (const locale of LOCALES) {
  for (const size of [SIZES[0], { name: "tablet", width: 800, height: 900 }]) {
    test(`every word is in reach of a mouse, ${locale} ${size.name}`, async ({
      browser,
    }) => {
      test.setTimeout(120_000);
      const site = await open(browser, SITE, "/", locale, size);
      try {
        const words = site.locator("[data-words] > a");
        await words.first().waitFor({ timeout: 45_000 });
        const row = (await site.locator("[data-words]").boundingBox())!;
        for (const word of await words.all()) {
          const box = (await word.boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(row.x - 1);
          expect(box.x + box.width).toBeLessThanOrEqual(row.x + row.width + 1);
        }
        await words.last().click();
        await expect(site).toHaveURL(/\/other$/);
      } finally {
        await site.context().close();
      }
    });
  }
}

test("a very wide window keeps the page's four columns", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const wide = { name: "wide", width: 1920, height: 1080 };
  const site = await open(browser, SITE, "/", "en", wide);
  try {
    await site.locator("article[data-listing]").first().waitFor();
    await site.waitForTimeout(500);
    expect((await walls(site))[0].columns).toBe(4);
    holdsOneSize(await cards(site));
  } finally {
    await site.context().close();
  }
});

test("the settings preview wears the same card as Discover", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  // billing off: the settings page reads more of it than the stub answers
  const app = await open(browser, APP, "/discover", "en", SIZES[0], {
    billing: false,
  });
  try {
    const card = app.locator("article[data-listing]").first();
    await card.waitFor({ timeout: 45_000 });
    await app.waitForTimeout(800);
    const seen = (el: Element) => {
      const css = getComputedStyle(el);
      return [
        css.backgroundImage,
        css.backgroundColor,
        css.boxShadow,
        css.borderTopColor,
        css.borderTopLeftRadius,
      ];
    };
    const onDiscover = await card.evaluate(seen);
    const height = (await card.boundingBox())!.height;

    // the owner's way in: the card that offers their own server
    await app.locator("[data-owners] button[data-owners-action]").click();
    const hint = app.getByText("This is how it will look on Discover.");
    await hint.waitFor({ timeout: 20_000 });
    const settings = hint.locator("..");
    await settings.locator("article").waitFor();
    expect(await settings.locator("article").evaluate(seen)).toEqual(
      onDiscover,
    );
    // the settings page scales in as it opens
    await expect
      .poll(
        async () => (await settings.locator("article").boundingBox())!.height,
      )
      .toBe(height);
  } finally {
    await app.context().close();
  }
});
