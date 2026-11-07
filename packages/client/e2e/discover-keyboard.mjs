// Discover by keyboard, in the app at /discover: ar, en, de at 1280 and 375 px.
// After the login form every step uses keys only (Tab, Shift+Tab, Enter, Space,
// Escape, PageDown, typing); no clicks and no element.focus().
//
// Data: real steps use whatever the dev API lists (one server when this was
// written, shown in three sections, so three cards). Steps named "[mocked]"
// change the API's answer in the browser (page.route): no bot is listed on the
// dev stack and no paid place exists, and neither can be seeded without a staff
// account. Nothing is written to the API.
//
// Copied from the internal discover-keyboard-2026-11-04.mjs and updated for the
// page that follows Designs; it signs in once and logs out at the end.
//
// Env: E2E_CHROMIUM, E2E_APP (as discover-fixtures.mjs), E2E_LOCALES (ar,en,de),
// E2E_SIZES (1280,375), E2E_ONLY (substring of step names), E2E_RESULTS (path).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import { API, APP, signIn, signOut } from "./discover-fixtures.mjs";

const pwModule = await import(
  pathToFileURL(
    createRequire(new URL("../package.json", import.meta.url)).resolve(
      "@playwright/test",
    ),
  ).href
);
const pw = pwModule.chromium ? pwModule : pwModule.default;

/** English UI string in a locale, from the catalogs of this checkout */
const catalogs = {};
const tr = (locale, english) => {
  if (locale === "en") return english;
  catalogs[locale] ??= new Map(
    readFileSync(
      new URL(
        `../components/i18n/catalogs/${locale}/messages.po`,
        import.meta.url,
      ),
      "utf8",
    )
      .split(/\r?\n\r?\n/)
      .map((block) => [
        block.match(/^msgid "(.*)"$/m),
        block.match(/^msgstr "(.*)"$/m),
      ])
      .filter(([id, text]) => id && text?.[1])
      .map(([id, text]) => [
        id[1].replace(/\\"/g, '"'),
        text[1].replace(/\\"/g, '"'),
      ]),
  );
  const text = catalogs[locale].get(english);
  if (text === undefined) throw new Error(`no ${locale} text for "${english}"`);
  return text;
};

const SHOTS = fileURLToPath(
  new URL(
    "../../../../../../screenshots/design-discover/keyboard/",
    import.meta.url,
  ),
);
mkdirSync(SHOTS, { recursive: true });
const shots = () => (name) => `${SHOTS}${name}.png`;

function reporter() {
  const results = [];
  return {
    results,
    page: undefined,
    async step(name, fn) {
      try {
        await fn();
        results.push({ name, ok: true });
        console.log(`  ok   ${name}`);
      } catch (error) {
        await this.page
          ?.screenshot({
            path: `${SHOTS}FAIL-${name.replace(/[^\w-]+/g, "_").slice(0, 80)}.png`,
          })
          .catch(() => {});
        results.push({
          name,
          ok: false,
          error: String(error?.message ?? error).slice(0, 400),
        });
        console.log(
          `  FAIL ${name}\n       ${String(error?.message ?? error).split("\n")[0]}`,
        );
      }
    },
    done() {
      const failed = results.filter((r) => !r.ok).length;
      console.log(
        `\ndiscover-keyboard: ${results.length - failed} passed, ${failed} failed`,
      );
      return failed;
    },
  };
}

const SUITE = "discover-keyboard";
const LANGS = process.env.E2E_LOCALES?.split(",") ?? ["ar", "en", "de"];
const SIZES = process.env.E2E_SIZES?.split(",").map(Number) ?? [1280, 375];
const ONLY = process.env.E2E_ONLY;
const report = reporter(SUITE);
const shot = shots(SUITE);
const browser = await pw.chromium.launch({
  executablePath: process.env.E2E_CHROMIUM,
});
const state = await signIn(browser, 0);

const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
const poll = async (page, fn, message, timeout = 4000) => {
  const end = Date.now() + timeout;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > end) throw new Error(message);
    await page.waitForTimeout(50);
  }
};

/** What has the keyboard focus right now, seen from the page */
const active = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { body: true };
    window.__ids ??= new WeakMap();
    window.__next ??= 1;
    if (!window.__ids.has(el)) window.__ids.set(el, window.__next++);
    const scroller = document.querySelector("[data-discover-scroll]");
    const bar = scroller?.querySelector("header");
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const alpha = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      return m ? Number(m[1].split(/[, /]+/)[3] ?? 1) : 1;
    };
    const outline =
      cs.outlineStyle !== "none" &&
      parseFloat(cs.outlineWidth) >= 2 &&
      alpha(cs.outlineColor) > 0;
    // the search fields draw the 2 px ring on their label
    const label = el.closest("label");
    const ring =
      !!label &&
      /(^|\s)0px 0px 0px 2px/.test(getComputedStyle(label).boxShadow);
    const inBar = !!bar?.contains(el);
    // these rows stay or scroll on their own
    const inWords = !!el.closest("[data-words]");
    const card = el.closest("[data-listing]");
    const isOpen =
      !!card && el.parentElement === card && el.tagName === "BUTTON";
    // the pixels under the focused thing: its top edge and its middle
    const covered = (x, y) => {
      if (y < 0 || y >= innerHeight || x < 0 || x >= innerWidth) return true;
      const hit = document.elementFromPoint(x, y);
      if (!hit) return true;
      if (el.contains(hit) || hit.contains(el)) return false;
      if (card && card.contains(hit)) return false;
      if (el.closest("label")?.contains(hit)) return false;
      return true;
    };
    const mid = r.left + r.width / 2;
    const scrollerBox = scroller?.getBoundingClientRect();
    return {
      id: window.__ids.get(el),
      tag: el.tagName.toLowerCase(),
      name: (el.getAttribute("aria-label") || el.textContent || "")
        .trim()
        .slice(0, 40),
      inDiscover: !!scroller?.contains(el),
      inDialog: !!el.closest('[role="dialog"]'),
      inBar,
      inWords,
      stuck: bar?.dataset.stuck === "true",
      listing: card?.dataset.listing,
      isOpen,
      focusVisible: el.matches(":focus-visible"),
      ring: outline || ring,
      covered:
        !inBar &&
        (covered(mid, r.top + 3) || covered(mid, r.top + r.height / 2)),
      // the row of words scrolls by itself: its order is in the row, not on screen
      left: r.left + (el.closest("[data-words]")?.scrollLeft ?? 0),
      right: r.right + (el.closest("[data-words]")?.scrollLeft ?? 0),
      top: r.top + (scroller?.scrollTop ?? 0),
      bottom: r.bottom + (scroller?.scrollTop ?? 0),
      viewTop: r.top,
      inView:
        r.bottom > 0 &&
        r.top < innerHeight &&
        (!scrollerBox || r.top < scrollerBox.bottom),
    };
  });

const press = async (page, key, wait = 60) => {
  await page.keyboard.press(key);
  await page.waitForTimeout(wait);
};

/** Tab until `pred(stop)`; returns that stop */
const tabTo = async (page, pred, what, { shift = false, max = 150 } = {}) => {
  for (let i = 0; i < max; i++) {
    await press(page, shift ? "Shift+Tab" : "Tab");
    const stop = await active(page);
    if (!stop.body && pred(stop)) return stop;
  }
  throw new Error(`${max} Tab presses never reached ${what}`);
};

/** The Discover page, listings shown, focus at the start of the document */
const fresh = async (page, path = "/discover") => {
  await page.goto(`${APP}${path}`);
  await page.locator("[data-discover-scroll]").waitFor({ timeout: 30000 });
  await page.locator("[data-listing]").first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(700);
};

/** Every control a keyboard should reach inside Discover: count and names */
const expected = (page) =>
  page.evaluate(() => {
    window.__ids ??= new WeakMap();
    window.__next ??= 1;
    const scroller = document.querySelector("[data-discover-scroll]");
    return [
      ...scroller.querySelectorAll(
        'a[href], button:not(:disabled), input, [tabindex="0"]',
      ),
    ]
      .filter(
        (el) =>
          el.tabIndex >= 0 &&
          el.getClientRects().length &&
          getComputedStyle(el).visibility !== "hidden",
      )
      .map((el) => {
        if (!window.__ids.has(el)) window.__ids.set(el, window.__next++);
        return {
          id: window.__ids.get(el),
          name: (el.getAttribute("aria-label") || el.textContent || el.tagName)
            .trim()
            .slice(0, 40),
        };
      });
  });

/**
 * Walk Discover with Tab from the start of the document until focus leaves it.
 * Walking off the end is the proof there is no trap.
 */
const walk = async (page, { shift = false, max = 200 } = {}) => {
  const stops = [];
  let inside = false;
  for (let i = 0; i < max; i++) {
    await press(page, shift ? "Shift+Tab" : "Tab");
    const stop = await active(page);
    // the search field's ring fades in over 150 ms
    // ... and let the row of words settle on the one in focus
    if (stop.tag === "input" || stop.inWords) {
      await page.waitForTimeout(220);
      Object.assign(stop, await active(page));
    }
    if (stop.inDiscover) {
      inside = true;
      stops.push(stop);
    } else if (inside) return { stops, left: true };
  }
  return { stops, left: false };
};

/** Reading order: top to bottom, and in a row with the page's direction */
const orderIssues = (stops, rtl) => {
  const issues = [];
  let anchor;
  for (const s of stops) {
    // the stuck rows stay where they are
    if ((s.inBar || s.inWords) && s.stuck) continue;
    if (anchor) {
      const nested =
        s.left >= anchor.left - 2 &&
        s.right <= anchor.right + 2 &&
        s.top >= anchor.top - 2 &&
        s.bottom <= anchor.bottom + 2;
      if (nested) continue;
      const sameRow = s.top < anchor.bottom - 4 && s.bottom > anchor.top + 4;
      if (
        sameRow
          ? rtl
            ? s.right > anchor.right + 4
            : s.left < anchor.left - 4
          : s.top < anchor.top - 4
      )
        issues.push(`"${anchor.name}" then "${s.name}"`);
    }
    anchor = s;
  }
  return issues;
};

/** Change the listing API's answer in this browser only */
const mockListings = (page, change) =>
  page.route(
    (url) => url.href.startsWith(`${API}/discover/`),
    async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const response = await route.fetch();
      const url = new URL(route.request().url());
      const json = await response.json();
      await route.fulfill({ response, json: change(url, json) });
    },
  );

const BOT = {
  _id: "01M0CKB0TKEYB0ARD000000000",
  username: "Keyboard Bot",
  description: "A made-up bot for this test.",
  tags: ["polls", "tools"],
  category: "utility",
  language: "en",
  featured: false,
  verified: false,
  server_count: 3,
};
const isBots = (url) => url.pathname.startsWith("/discover/bots");

process.on("uncaughtException", async (error) => {
  console.error(error);
  await signOut(browser, state).catch(() => {});
  process.exit(2);
});

for (const locale of LANGS) {
  for (const width of SIZES) {
    const tag = `${locale}-${width}`;
    const L = (english) => tr(locale, english);
    const viewport = { width, height: width < 600 ? 812 : 860 };
    const context = await browser.newContext({
      viewport,
      locale,
      isMobile: width < 600,
      hasTouch: width < 600,
      storageState: state,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    report.page = page;
    const step = async (name, fn) => {
      if (ONLY && !name.includes(ONLY)) return;
      await report.step(`${tag} ${name}`, fn);
      await page.unrouteAll({ behavior: "ignoreErrors" }).catch(() => {});
    };

    await step(
      "Tab reaches every control in Discover, then leaves the page (no trap)",
      async () => {
        await fresh(page);
        const dir = await page.evaluate(
          () => getComputedStyle(document.documentElement).direction,
        );
        assert(
          dir === (locale === "ar" ? "rtl" : "ltr"),
          `page direction is ${dir}`,
        );
        const want = await expected(page);
        const { stops, left } = await walk(page);
        const got = new Set(stops.map((s) => s.id));
        const missed = want.filter((w) => !got.has(w.id)).map((w) => w.name);
        assert(left, `focus never left Discover after ${stops.length} stops`);
        assert(!missed.length, `not reached: ${missed.join(" | ")}`);
        // phones: the field is behind its icon
        const search =
          width < 900
            ? (s) => s.inBar && s.tag === "button"
            : (s) => s.tag === "input";
        assert(stops.some(search), "the search was not reached");
        if (width < 900) {
          // the button is not the point: Enter gives the field, Escape gives it back
          await fresh(page);
          const toggle = await tabTo(page, search, "the search button");
          await press(page, "Enter", 200);
          const field = await active(page);
          assert(
            field.tag === "input" && field.inBar,
            "Enter did not open the search",
          );
          await page.keyboard.type("ab");
          assert((await active(page)).tag === "input", "typing lost the field");
          await press(page, "Escape", 200);
          await press(page, "Escape", 200);
          assert(
            (await active(page)).id === toggle.id,
            "Escape did not return to the button",
          );
        }
        assert(
          stops.filter((s) => s.isOpen).length >= 1,
          "no listing's open button was reached",
        );
        console.log(
          `       ${tag}: ${stops.length} stops, ${stops.filter((s) => s.isOpen).length} listings`,
        );
      },
    );

    await step(
      "every listing: its open button comes first, then its own controls",
      async () => {
        await fresh(page);
        const { stops } = await walk(page);
        const cards = await page.locator("[data-listing]").count();
        assert(
          stops.filter((s) => s.isOpen).length === cards,
          `${stops.filter((s) => s.isOpen).length} open buttons for ${cards} cards`,
        );
        let current;
        for (const s of stops) {
          if (s.isOpen) current = s.listing;
          else if (s.listing)
            assert(
              s.listing === current,
              `"${s.name}" comes before its listing's open button`,
            );
        }
      },
    );

    await step(
      "the order follows the page: top to bottom, and in rows with the language direction",
      async () => {
        await fresh(page);
        const { stops } = await walk(page);
        const issues = orderIssues(stops, locale === "ar");
        assert(!issues.length, issues.slice(0, 4).join("; "));
      },
    );

    await step(
      "focus is visible at every stop: 2 px ring, in view, not under the sticky bar",
      async () => {
        await fresh(page);
        const { stops } = await walk(page);
        const noRing = stops
          .filter((s) => !s.ring || !s.focusVisible)
          .map((s) => s.name);
        assert(!noRing.length, `no ring: ${noRing.join(" | ")}`);
        const hidden = stops
          .filter((s) => s.covered || !s.inView)
          .map((s) => s.name);
        assert(!hidden.length, `hidden: ${hidden.join(" | ")}`);
        await page.screenshot({ path: shot(`${tag}-tab-end`) });
      },
    );

    await step(
      "Shift+Tab walks the same stops back, each in view, and leaves the page",
      async () => {
        await fresh(page);
        const forward = await walk(page);
        const last = forward.stops.at(-1);
        // back into the page from whatever is after it
        await tabTo(page, (s) => s.id === last.id, "the last stop again", {
          shift: true,
          max: 3,
        });
        const back = await walk(page, { shift: true });
        const seen = new Set([last.id, ...back.stops.map((s) => s.id)]);
        const missed = forward.stops
          .filter((s) => !seen.has(s.id))
          .map((s) => s.name);
        assert(back.left, "Shift+Tab never left Discover");
        assert(!missed.length, `not reached backwards: ${missed.join(" | ")}`);
        const hidden = back.stops
          .filter((s) => s.covered || !s.inView)
          .map((s) => s.name);
        assert(!hidden.length, `hidden going back: ${hidden.join(" | ")}`);
        const ids = forward.stops
          .filter((s) => !s.inBar)
          .map((s) => s.id)
          .reverse();
        const backIds = [last.id, ...back.stops.map((s) => s.id)].filter((id) =>
          ids.includes(id),
        );
        assert(
          ids.join() === backIds.join(),
          "Shift+Tab does not walk the reverse of Tab",
        );
      },
    );

    for (const [key, label] of [
      ["Enter", "Enter"],
      ["Space", "Space"],
    ]) {
      await step(
        `${label} on every listing opens it, Escape comes back to that same card`,
        async () => {
          await fresh(page);
          const cards = await page.locator("[data-listing]").count();
          let last = 0;
          for (let n = 0; n < cards; n++) {
            const open = await tabTo(
              page,
              (s) => s.isOpen && s.id !== last && s.top > 0,
              `listing ${n + 1}`,
            );
            const scrolled = await page.evaluate(
              () => document.querySelector("[data-discover-scroll]").scrollTop,
            );
            await press(page, key, 300);
            await poll(
              page,
              () =>
                page.evaluate(() =>
                  /^\/discover\/[^/]+/.test(location.pathname),
                ),
              `${label} did not open listing ${n + 1}`,
            );
            await page.locator("h1").first().waitFor({ timeout: 10000 });
            const inside = await poll(
              page,
              async () => {
                const a = await active(page);
                return a.body ? undefined : a;
              },
              "focus was lost on the listing's page",
            ).catch(() => ({ body: true }));
            assert(
              !inside.body,
              `focus fell to the document on listing ${n + 1}`,
            );
            assert(
              inside.ring && inside.focusVisible,
              "no ring on the listing's page",
            );
            await press(page, "Escape", 300);
            await poll(
              page,
              () => page.evaluate(() => location.pathname === "/discover"),
              `Escape did not leave listing ${n + 1}`,
            );
            const back = await poll(
              page,
              async () => {
                const a = await active(page);
                return a.isOpen ? a : undefined;
              },
              `focus did not return to listing ${n + 1}`,
            );
            const now = await page.evaluate(() => {
              const all = [...document.querySelectorAll("[data-listing]")];
              return all.indexOf(
                document.activeElement.closest("[data-listing]"),
              );
            });
            assert(
              now === n,
              `focus came back to card ${now + 1}, not ${n + 1}`,
            );
            assert(
              back.ring && back.focusVisible,
              "no focus ring after coming back",
            );
            assert(
              !back.covered && back.inView,
              "the card is out of view after coming back",
            );
            const after = await page.evaluate(
              () => document.querySelector("[data-discover-scroll]").scrollTop,
            );
            assert(
              Math.abs(after - scrolled) < 120,
              `the page moved from ${scrolled} to ${after}`,
            );
            last = back.id;
            assert(open, "");
          }
        },
      );
    }

    await step(
      "Escape with nothing to close on the browse page does nothing; a listing opened from search returns to the search",
      async () => {
        await fresh(page);
        await press(page, "Escape", 200);
        assert(
          await page.evaluate(() => location.pathname === "/discover"),
          "Escape left Discover",
        );
        await press(page, "/", 100);
        const input = await active(page);
        assert(input.tag === "input", "/ does not go to the search");
        const word = await page.evaluate(() =>
          document
            .querySelector("[data-listing] h3 span")
            .textContent.slice(0, 3),
        );
        await page.keyboard.type(word);
        await press(page, "Enter", 600);
        await poll(
          page,
          () => page.evaluate(() => location.search.includes("q=")),
          "the search did not run",
        );
        await tabTo(page, (s) => s.isOpen, "a result");
        await press(page, "Enter", 400);
        await poll(
          page,
          () =>
            page.evaluate(() => /^\/discover\/[^/]+/.test(location.pathname)),
          "Enter did not open the result",
        );
        await press(page, "Escape", 300);
        await poll(
          page,
          () => page.evaluate(() => location.search.includes("q=")),
          "Escape did not go back to the results",
        );
        await poll(
          page,
          async () => (await active(page)).isOpen,
          "focus did not return to the result",
        );
      },
    );

    await step(
      "a listing's page: Tab reaches its way in; Escape from a direct link goes to Discover and the lists load",
      async () => {
        const [first] = await (
          await fetch(`${API}/discover/servers?limit=1`)
        ).json();
        const slug = first.link ?? first._id;
        await page.goto(`${APP}/discover/${slug}`);
        await page.locator("h1").first().waitFor({ timeout: 20000 });
        await page.waitForTimeout(500);
        const join = await tabTo(
          page,
          (s) => s.inDiscover && s.name === L("Go to server"),
          "the page's main button",
        );
        assert(join.ring, "no ring on the main button");
        await press(page, "Escape", 300);
        await poll(
          page,
          () => page.evaluate(() => location.pathname === "/discover"),
          "Escape did not go to Discover",
        );
        await page
          .locator("[data-listing]")
          .first()
          .waitFor({ timeout: 10000 });
        const a = await poll(
          page,
          async () => {
            const x = await active(page);
            return x.body ? undefined : x;
          },
          "focus fell to the document",
        );
        assert(a.inDiscover && a.ring, `focus on "${a.name}"`);
      },
    );

    await step(
      "cards with nested controls: Enter on the card's button acts on that button only",
      async () => {
        await fresh(page);
        const action = await tabTo(
          page,
          (s) => s.listing && !s.isOpen,
          "a control inside a card",
        );
        assert(action.name, "the card's button has no name");
        const before = await page.evaluate(() => location.pathname);
        assert(before === "/discover", before);
        await press(page, "Enter", 400);
        const path = await poll(
          page,
          async () => {
            const p = await page.evaluate(() => location.pathname);
            return p !== before ? p : undefined;
          },
          "Enter on the card's button did nothing",
        );
        assert(
          path.startsWith("/server/"),
          `went to ${path}, not to the server`,
        );
      },
    );

    await step(
      "filters: words and sort work by keyboard and keep focus",
      async () => {
        await fresh(page, "/discover?view=all");
        await tabTo(page, (s) => s.name === L("Popular"), "the sort choice");
        await press(page, "ArrowRight", 400);
        await poll(
          page,
          () => page.evaluate(() => location.search.includes("sort=new")),
          "the arrow key did not sort",
        );
        const sorted = await active(page);
        assert(
          sorted.name === L("New") && sorted.ring,
          `after sorting focus is on "${sorted.name ?? "document"}"`,
        );
        const chip = await tabTo(
          page,
          (s) => s.inWords && s.name !== L("All"),
          "a filter word",
          { shift: true },
        );
        await press(page, "Enter", 400);
        await poll(
          page,
          () =>
            page.evaluate(() =>
              /category|\/discover\/./.test(
                location.search + location.pathname,
              ),
            ),
          "Enter did not filter",
        );
        const a = await active(page);
        assert(
          !a.body && a.id === chip.id,
          `the filter word lost focus (${a.name ?? "document"})`,
        );
        assert(a.ring, "no ring on the word");
      },
    );

    await step(
      "going back to browsing from a filter keeps focus on the page",
      async () => {
        await fresh(page, "/discover?view=all");
        await tabTo(page, (s) => s.name === L("All"), "the All chip");
        await press(page, "Enter", 500);
        await poll(
          page,
          () => page.evaluate(() => !location.search),
          "All did not go back to browsing",
        );
        const a = await active(page);
        assert(
          !a.body,
          "focus fell to the document when the chip left the page",
        );
        assert(a.inDiscover && a.inView, `focus went to "${a.name}"`);
        assert(a.ring, "no ring where focus landed");
      },
    );

    await step(
      "a filter word keeps focus on the results, the next Tab goes on from there",
      async () => {
        await fresh(page);
        const tile = await tabTo(
          page,
          (s) => s.inWords && s.name !== L("All"),
          "a filter word",
        );
        await press(page, "Enter", 600);
        await poll(
          page,
          () => page.evaluate(() => location.pathname !== "/discover"),
          "Enter did not open the category",
        );
        const a = await active(page);
        assert(!a.body, `focus fell to the document after "${tile.name}"`);
        assert(
          a.inDiscover && a.inView && a.ring,
          `focus on "${a.name}" is not visible`,
        );
        const next = await tabTo(
          page,
          (s) => s.inDiscover,
          "the next control",
          { max: 2 },
        );
        assert(next.top >= a.top - 80, `Tab jumped up to "${next.name}"`);
      },
    );

    await step(
      "scrolled down: the sticky bar's search takes typing and keeps focus",
      async () => {
        await fresh(page);
        await tabTo(page, (s) => s.inBar, "the bar");
        for (let i = 0; i < 8; i++) await press(page, "PageDown", 150);
        await poll(
          page,
          () =>
            page.evaluate(
              () =>
                document.querySelector("[data-discover-scroll] header").dataset
                  .stuck === "true",
            ),
          "PageDown did not scroll the page",
        );
        if (width < 900) {
          const toggle = await tabTo(
            page,
            (s) =>
              s.inBar && s.name === L("Search servers") && s.tag === "button",
            "the search button in the bar",
            { max: 6 },
          );
          await press(page, "Enter", 200);
          assert(
            (await active(page)).tag === "input",
            "the search button did not open the field",
          );
          await press(page, "Escape", 200);
          const closed = await active(page);
          assert(
            closed.id === toggle.id,
            "Escape did not close the field back to its button",
          );
          await press(page, "Enter", 200);
        } else {
          await tabTo(
            page,
            (s) => s.inBar && s.tag === "input",
            "the bar's search",
            { max: 6 },
          );
        }
        await page.keyboard.type("zz", { delay: 40 });
        await page.waitForTimeout(900);
        const a = await active(page);
        assert(
          a.tag === "input",
          `typing lost the field (${a.body ? "document" : a.name})`,
        );
        await page.keyboard.type("q");
        await poll(
          page,
          () =>
            page.evaluate(() =>
              /zzq/.test(decodeURIComponent(location.search)),
            ),
          "further typing did not reach the search",
        );
      },
    );

    await step(
      "Servers and Bots tabs: Enter and Space switch, focus stays on the tab",
      async () => {
        await fresh(page);
        const bots = await tabTo(
          page,
          (s) => s.inBar && s.name === L("Bots"),
          "the Bots tab",
        );
        await press(page, "Space", 400);
        await poll(
          page,
          () => page.evaluate(() => location.pathname === "/discover/bots"),
          "Space did not switch to Bots",
        );
        assert((await active(page)).id === bots.id, "focus left the tab");
        await press(page, "Shift+Tab", 100);
        await press(page, "Enter", 400);
        await poll(
          page,
          () => page.evaluate(() => location.pathname === "/discover"),
          "Enter did not switch to Servers",
        );
      },
    );

    await step(
      "[mocked] bot dialog: Enter opens, focus inside, Tab stays inside, Escape returns to the card",
      async () => {
        await mockListings(page, (url, json) => (isBots(url) ? [BOT] : json));
        await fresh(page, "/discover/bots");
        for (const key of ["Enter", "Space"]) {
          const open = await tabTo(page, (s) => s.isOpen, "the bot's card");
          await press(page, key, 300);
          const dialog = page.locator('[role="dialog"][aria-modal="true"]');
          await dialog.waitFor({ timeout: 5000 });
          assert(
            (await active(page)).inDialog,
            `${key}: focus did not move into the dialog`,
          );
          for (let i = 0; i < 14; i++) {
            await press(page, "Tab");
            const a = await active(page);
            assert(a.inDialog, "Tab left the open dialog");
            assert(
              a.ring || a.tag === "div",
              `no ring on "${a.name}" in the dialog`,
            );
          }
          await press(page, "Shift+Tab");
          assert(
            (await active(page)).inDialog,
            "Shift+Tab left the open dialog",
          );
          await press(page, "Escape", 300);
          await dialog.waitFor({ state: "detached", timeout: 3000 });
          const back = await active(page);
          assert(
            back.id === open.id,
            `focus came back to "${back.name ?? "document"}"`,
          );
          assert(back.ring, "no ring after the dialog closed");
          // Tab from here reaches the next control, not the top of the page
          await press(page, "Shift+Tab");
        }
      },
    );

    await step(
      "[mocked] a dialog over the listing dialog: Escape closes only the top one",
      async () => {
        await mockListings(page, (url, json) => (isBots(url) ? [BOT] : json));
        await fresh(page, "/discover/bots");
        await tabTo(page, (s) => s.isOpen, "the bot's card");
        await press(page, "Enter", 300);
        const report_ = await tabTo(
          page,
          (s) => s.name === L("Report"),
          "the Report button",
          { max: 12 },
        );
        await press(page, "Enter", 500);
        const dialogs = page.locator('[role="dialog"]');
        await poll(
          page,
          async () => (await dialogs.count()) >= 2,
          "Report did not open a dialog",
        );
        await press(page, "Escape", 500);
        assert(
          (await dialogs.count()) === 1,
          `${await dialogs.count()} dialogs after one Escape`,
        );
        assert(
          await page.evaluate(() =>
            /\/discover\/bots\/./.test(location.pathname),
          ),
          "the listing dialog closed too",
        );
        const a = await active(page);
        assert(
          a.id === report_.id,
          `focus on "${a.name ?? "document"}" after the top dialog closed`,
        );
      },
    );

    await step(
      '[mocked] paid card: "?" opens its note and not the listing, Escape closes only the note',
      async () => {
        await mockListings(page, (url, json) =>
          !isBots(url) && Array.isArray(json) && json[0]
            ? json.map((s) => ({ ...s, boost: "SuperBoost" }))
            : json,
        );
        await fresh(page);
        const why = await tabTo(
          page,
          (s) => s.name === L("Why am I seeing this?"),
          'the "?" on a paid card',
        );
        assert(why.listing, 'the "?" is outside its card');
        for (const key of ["Enter", "Space"]) {
          await press(page, key, 200);
          await page
            .locator('[data-testid="ad-note"]')
            .waitFor({ timeout: 3000 });
          assert(
            await page.evaluate(() => location.pathname === "/discover"),
            `${key} opened the listing`,
          );
          await press(page, "Escape", 200);
          assert(
            !(await page.locator('[data-testid="ad-note"]').count()),
            "Escape did not close the note",
          );
          assert(
            await page.evaluate(() => location.pathname === "/discover"),
            "Escape left the page",
          );
          assert(
            (await active(page)).id === why.id,
            'focus did not return to the "?"',
          );
        }
      },
    );

    await step(
      "[mocked] headline card: open button, its own controls, Enter opens, Escape returns",
      async () => {
        await mockListings(page, (url, json) =>
          !isBots(url) && Array.isArray(json) && json[0]
            ? json.map((s) => ({ ...s, boost: "MegaBoost" }))
            : json,
        );
        await fresh(page);
        await page
          .locator('[data-testid="discover-headline"]')
          .waitFor({ timeout: 5000 });
        const open = await tabTo(page, (s) => s.isOpen, "the headline");
        const inHeadline = await page.evaluate(
          () =>
            !!document.activeElement.closest(
              '[data-testid="discover-headline"]',
            ),
        );
        assert(inHeadline, "the first open button is not the headline's");
        assert(open.ring, "no ring on the headline");
        await press(page, "Enter", 400);
        await poll(
          page,
          () =>
            page.evaluate(() => /^\/discover\/[^/]+/.test(location.pathname)),
          "Enter did not open the headline",
        );
        await press(page, "Escape", 300);
        await poll(
          page,
          () => page.evaluate(() => location.pathname === "/discover"),
          "Escape did not come back",
        );
        await poll(
          page,
          async () => {
            const inside = await page.evaluate(
              () =>
                !!document.activeElement.closest(
                  '[data-testid="discover-headline"]',
                ),
            );
            return inside;
          },
          "focus did not return to the headline",
        );
      },
    );

    await step(
      "[mocked] Load more: focus moves to the first new card",
      async () => {
        let sample;
        await mockListings(page, (url, json) => {
          if (isBots(url) || !Array.isArray(json)) return json;
          // past the real list the API answers with nothing
          sample = json[0] ?? sample;
          if (!sample) return json;
          const offset = Number(url.searchParams.get("offset") ?? 0);
          const count = offset
            ? 2
            : Number(url.searchParams.get("limit") ?? 24);
          return Array.from({ length: count }, (_, i) => ({
            ...sample,
            _id: `MOCK${offset + i}`,
            link: undefined,
            name: `Mock ${offset + i}`,
          }));
        });
        await fresh(page, "/discover?view=all");
        const before = await page.locator("[data-listing]").count();
        assert(before === 24, `${before} cards on the first page`);
        await tabTo(page, (s) => s.name === L("Load more"), "Load more", {
          max: 150,
        });
        await press(page, "Enter", 800);
        await poll(
          page,
          async () =>
            (await page.locator("[data-listing]").count()) === before + 2,
          "Load more did not add cards",
        );
        const a = await poll(
          page,
          async () => {
            const x = await active(page);
            return x.isOpen ? x : undefined;
          },
          "focus did not move to the new cards",
        );
        assert(a.name.includes(`Mock ${before}`), `focus on "${a.name}"`);
      },
    );

    await step("no page errors", async () => {
      assert(!errors.length, errors.slice(0, 3).join(" | "));
    });

    await context.close();
  }
}

await signOut(browser, state);
await browser.close();
const failed = report.done();
if (process.env.E2E_RESULTS)
  writeFileSync(
    process.env.E2E_RESULTS,
    JSON.stringify(report.results, null, 2),
  );
process.exit(failed ? 1 : 0);
