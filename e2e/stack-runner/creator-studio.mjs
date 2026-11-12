// Creator Studio: a row in the sidebar for people with the creator rank and
// nobody else, the studio in the Designs stage, uploading a design, the
// public-name choice in Profile settings, and creators shown by name and
// avatar only. Runs in en/ar/de on desktop and at 375 px.
//
//   node e2e/stack-runner/creator-studio.mjs
//
// Env: E2E_LIB (folder with stack.mjs and catalog.mjs), E2E_WEB (this web
//   checkout, for the catalogs), E2E_CHROMIUM (headless shell), E2E_BASE,
//   E2E_LOCALES, E2E_VIEWPORTS, E2E_SHOTS (folder for screenshots). Uses the
//   first account of dev-stack-accounts.json and logs out.
//
//   E2E_REAL_CREATOR=1: for an account that really has the rank. Nothing is
//   faked and the upload is real: it leaves one draft on that account.
//
// Without it the rank is a wire fixture, either way: `/community/permissions`,
// `/community/mine`, the upload and the create request are answered here and
// nothing is written.
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const lib = process.env.E2E_LIB;
if (!lib) {
  console.error("Set E2E_LIB to the folder with stack.mjs and catalog.mjs");
  process.exit(2);
}
const dir = pathToFileURL(`${lib.replace(/\/?$/, "/")}`);
const { API, APP, LOCALES, VIEWPORTS, accounts, pw, reporter } = await import(
  new URL("stack.mjs", dir)
);
const { tr } = await import(new URL("catalog.mjs", dir));

const REAL = !!process.env.E2E_REAL_CREATOR;
const MAKER = {
  _id: "01FIXTUREMAKER000000000000",
  username: "sara",
  discriminator: "4321",
  display_name: "Sara the maker",
};

const NAMELESS = {
  _id: "01FIXTUREMAKERNONAME000000",
  username: "nameless",
  discriminator: "8765",
};

const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};

/** Sessions not yet logged out; a stopped run still ends them */
const live = new Set();
const endSession = (session) =>
  fetch(`${API}/auth/session/logout`, {
    method: "POST",
    headers: { "x-session-token": session.token },
  }).catch(() => {});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await Promise.all([...live].map(endSession));
    process.exit(130);
  });
}

async function signIn(browser, { viewport, locale }) {
  const phone = viewport.width < 600;
  const context = await browser.newContext({
    viewport,
    locale,
    isMobile: phone,
    hasTouch: phone,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const session = {};
  const state = {
    creator: false,
    standing: undefined,
    privileged: false,
    listNameless: false,
    permissionsDown: false,
    downSlow: 0,
    asked: 0,
    nameDown: false,
    nameSlow: 0,
    slow: 0,
    items: [],
    refuse: false,
    publicName: [],
    shownPublic: false,
  };
  page.on("response", async (response) => {
    if (!response.url().endsWith("/auth/session/login")) return;
    const body = await response.json().catch(() => undefined);
    if (body?.token) {
      session.token = body.token;
      live.add(session);
    }
  });
  const fixture = (pattern, handler) =>
    context.route(pattern, (route) =>
      !route.request().url().startsWith(API) || (REAL && pattern.real !== true)
        ? route.fallback()
        : handler(route),
    );
  await fixture(/\/community\/permissions$/, async (route) => {
    state.asked += 1;
    if (state.permissionsDown) {
      if (state.downSlow)
        await new Promise((done) => setTimeout(done, state.downSlow));
      return route.fulfill({ status: 500, json: { type: "InternalError" } });
    }
    if (state.standing)
      return route.fulfill({
        json: {
          permissions: ["cosmetics.manage_own"],
          creator: state.standing,
        },
      });
    if (state.privileged)
      return route.fulfill({
        json: { permissions: ["cosmetics.submit", "cosmetics.manage_own"] },
      });
    // the first account really has the rank now: "no rank" is a fixture too
    if (!state.creator) return route.fulfill({ json: { permissions: [] } });
    if (state.slow) await new Promise((r) => setTimeout(r, state.slow));
    return route.fulfill({
      json: {
        permissions: ["cosmetics.submit", "cosmetics.manage_own"],
        creator: "Active",
        show_public_name: state.shownPublic,
      },
    });
  });
  // the suspension notice reads why and since when (the wire fixture's rank)
  await fixture(/\/community\/creators\/@me\/standing$/, (route) =>
    state.standing
      ? route.fulfill({
          json: {
            standing: state.standing,
            reason: "Fixture: a design copied someone else's art",
            since: Date.now() - 86400000,
            can_appeal: false,
          },
        })
      : route.fallback(),
  );
  await fixture(/\/community\/mine$/, (route) =>
    state.creator || state.standing
      ? route.fulfill({ json: state.items })
      : route.fallback(),
  );
  await fixture(/\/community\/(decorations|nameplates)$/, (route) => {
    const request = route.request();
    if (request.method() !== "POST" || !state.creator) return route.fallback();
    if (state.refuse)
      return route.fulfill({
        status: 403,
        json: {
          type: "MissingPlatformPermission",
          permission: "cosmetics.submit",
        },
      });
    const body = request.postDataJSON();
    const item = {
      _id: `01FIXTUREITEM${state.items.length}`,
      kind: "Decoration",
      name: body.name,
      creator_id: "me",
      file: fileOf("01FIXTUREFILE"),
      status: body.submit ? "Published" : "Draft",
      tags: [],
      revision: 1,
      popularity: 0,
      version: 0,
    };
    state.items = [item, ...state.items];
    return route.fulfill({ json: item });
  });
  await context.route(/\/community\/(decorations|nameplates)\?/, (route) =>
    !state.listNameless
      ? route.fallback()
      : route.fulfill({
          json: route.request().url().includes("/decorations")
            ? {
                items: [
                  {
                    _id: "01FIXTURENAMELESSITEM",
                    kind: "Decoration",
                    name: "Ring",
                    creator_id: NAMELESS._id,
                    file: fileOf("01FIXTUREFILE"),
                    status: "Published",
                    tags: [],
                    revision: 1,
                    popularity: 1,
                    version: 0,
                  },
                ],
                creators: [NAMELESS],
              }
            : { items: [], creators: [] },
        }),
  );
  await context.route(/:14704\/decorations$/, (route) =>
    REAL || route.request().method() !== "POST"
      ? route.fallback()
      : route.fulfill({ json: { id: "01FIXTUREFILE" } }),
  );
  await fixture(/\/community\/items\/[^/]+\/submit$/, (route) =>
    state.refuse
      ? route.fulfill({
          status: 403,
          json: {
            type: "MissingPlatformPermission",
            permission: "cosmetics.submit",
          },
        })
      : route.fallback(),
  );
  await fixture(/\/community\/creators\/@me\/public-name$/, (route) => {
    if (state.nameDown)
      return route.fulfill({ status: 500, json: { type: "InternalError" } });
    const body = route.request().postDataJSON();
    state.publicName.push(body);
    state.shownPublic = body.show_public_name;
    return state.nameSlow
      ? new Promise((done) => setTimeout(done, state.nameSlow)).then(() =>
          route.fulfill({ status: 204, body: "" }),
        )
      : route.fulfill({ status: 204, body: "" });
  });
  await context.route(/\/community\/creators\/01FIXTUREMAKER/, (route) =>
    REAL
      ? route.fallback()
      : route.fulfill({
          json: {
            creator: route.request().url().endsWith(NAMELESS._id)
              ? NAMELESS
              : MAKER,
            items: [],
          },
        }),
  );
  await typeLogin(page, accounts[0]);
  return { page, context, session, state, errors };
}

async function typeLogin(page, account) {
  await page.goto(`${APP}/login`);
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 30000,
  });
}

/** Every remembered rank in this browser */
const rememberedRanks = (page) =>
  page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.startsWith("zrzur:creator:")),
  );

const myId = async (session) => {
  const answer = await fetch(`${API}/users/@me`, {
    headers: { "x-session-token": session.token },
  });
  return (await answer.json())._id;
};

const fileOf = (id) => ({
  _id: id,
  tag: "decorations",
  filename: "ring.png",
  metadata: { type: "Image", width: 1024, height: 1024 },
  content_type: "image/png",
  size: 1000,
});

async function logOut({ page, session }, t) {
  let viaPage = false;
  try {
    await page.goto(`${APP}/app`, { waitUntil: "domcontentloaded" });
    await page.goto(`${APP}/settings`, { waitUntil: "domcontentloaded" });
    const out = page.getByText(t("Log out"), { exact: true }).first();
    await out.waitFor({ timeout: 20000 });
    await out.scrollIntoViewIfNeeded();
    await out.click();
    await page.waitForURL(/\/login|^[^/]*\/\/[^/]+\/?$/, { timeout: 20000 });
    viaPage = true;
  } finally {
    if (!viaPage && session.token) await endSession(session);
    live.delete(session);
  }
  return viaPage;
}

/** A ring on a clear ground, the size a decoration should be */
const artwork = (page) =>
  page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const draw = canvas.getContext("2d");
    draw.strokeStyle = "#E0195F";
    draw.lineWidth = 24;
    draw.beginPath();
    draw.arc(128, 128, 100, 0, Math.PI * 2);
    draw.stroke();
    return canvas.toDataURL("image/png").split(",")[1];
  });

const report = reporter("creator-studio");
const browser = await pw.chromium.launch({
  executablePath: process.env.E2E_CHROMIUM,
  headless: true,
});
const locales = process.env.E2E_LOCALES?.split(",") ?? LOCALES;
const only = process.env.E2E_VIEWPORTS?.split(",");
const shotsDir = process.env.E2E_SHOTS?.replace(/\/?$/, "/");
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

for (const locale of locales) {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    if (only && !only.includes(name)) continue;
    const at = `${locale} ${name}`;
    const phone = viewport.width < 600;
    const t = (text) => tr(locale, text);
    const signedIn = await signIn(browser, { viewport, locale });
    const { page, context, session, state, errors } = signedIn;
    report.page = page;
    const press = (target) => (phone ? target.tap() : target.click());
    /** The window comes back, as when someone returns to the tab */
    const focusWindow = () =>
      page.evaluate(() => window.dispatchEvent(new Event("focus")));
    /** A page change inside the app: nothing is loaded again */
    const leaveFor = (path) =>
      page.evaluate((to) => {
        history.pushState({}, "", to);
        dispatchEvent(new PopStateEvent("popstate"));
      }, path);
    const shot = async (surface) => {
      if (shotsDir)
        await page.screenshot({
          path: `${shotsDir}${locale}-${name}-${surface}.png`,
        });
    };
    // the catalog helper finds a shorter "Profile" in Arabic than this row
    const profileRow = locale === "ar" ? "الملف الشخصي" : t("Profile");
    const settled = () => page.waitForTimeout(600);
    const studioRow = page.locator('a[href="/designs/studio"]');
    const designsRow = page.locator('a[href="/designs"]').first();
    /** The conversations sidebar: on a phone it is its own screen */
    const home = async () => {
      await page.goto(`${APP}/friends`);
      await designsRow.waitFor({ state: "attached", timeout: 20000 });
      if (phone) {
        // the list is a drawer, opened with this button as a person does;
        // SlideDrawer ignores a row tapped in the first 200 ms of its slide
        const back = page
          .getByRole("button", {
            name: new RegExp(`^(${t("Back")}|${t("Toggle main sidebar")})$`),
          })
          .first();
        await back.waitFor({ timeout: 20000 });
        await back.tap();
        await settled();
      }
    };

    try {
      if (!REAL) {
        await report.step(`${at}: no rank, no row, ever`, async () => {
          await page.addInitScript(() => {
            window.__sawStudio = false;
            new MutationObserver(() => {
              if (document.querySelector('a[href="/designs/studio"]'))
                window.__sawStudio = true;
            }).observe(document, { childList: true, subtree: true });
          });
          await home();
          await page.waitForTimeout(2500);
          assert(!(await studioRow.count()), "the row is there");
          assert(
            !(await page.evaluate(() => window.__sawStudio)),
            "the row flashed",
          );
        });

        await report.step(
          `${at}: no rank, the address leads to Designs`,
          async () => {
            await page.goto(`${APP}/designs/studio`);
            await page.waitForURL(
              (url) => url.pathname.replace(/\/$/, "") === "/designs",
              { timeout: 15000 },
            );
            assert(
              !(await page.getByText(t("Start a design")).count()),
              "the studio showed",
            );
          },
        );

        await report.step(`${at}: no rank, no public-name choice`, async () => {
          await page.goto(`${APP}/settings`);
          await page
            .getByText(profileRow, { exact: true })
            .first()
            .waitFor({ timeout: 20000 });
          await page.waitForTimeout(1500);
          assert(
            !(await page
              .getByText(t("Show my name on the public Designs site"))
              .count()),
            "the choice is there",
          );
        });
      }

      if (!REAL) {
        const id = await myId(session);
        const stale = () =>
          page.evaluate(
            (key) => localStorage.setItem(key, "1"),
            `zrzur:creator:${id}`,
          );

        await report.step(
          `${at}: staff rights alone are not the rank`,
          async () => {
            state.privileged = true;
            await home();
            await page.waitForTimeout(2000);
            assert(
              !(await studioRow.count()),
              "a privileged account has the row",
            );
            await page.goto(`${APP}/designs/studio`);
            await page.waitForURL(
              (url) => url.pathname.replace(/\/$/, "") === "/designs",
              { timeout: 15000 },
            );
            state.privileged = false;
          },
        );

        await report.step(
          `${at}: an old remembered rank goes away`,
          async () => {
            await stale();
            await home();
            await studioRow
              .first()
              .waitFor({ state: "detached", timeout: 10000 });
            assert(
              !(await rememberedRanks(page)).length,
              "it stayed remembered",
            );
          },
        );

        await report.step(`${at}: a failed check fails closed`, async () => {
          await stale();
          state.permissionsDown = true;
          await home();
          await studioRow
            .first()
            .waitFor({ state: "detached", timeout: 10000 });
        });

        await report.step(
          `${at}: a failed check says so, no redirect`,
          async () => {
            await page.goto(`${APP}/designs/studio`);
            await page
              .getByText(t("Creator Studio couldn't be opened"))
              .waitFor({ timeout: 20000 });
            assert(/\/designs\/studio/.test(page.url()), "it went away");
            state.permissionsDown = false;
            await press(page.getByRole("button", { name: t("Try again") }));
            await page.waitForURL(
              (url) => url.pathname.replace(/\/$/, "") === "/designs",
              { timeout: 15000 },
            );
          },
        );

        await report.step(
          `${at}: Try again keeps the notice, button off`,
          async () => {
            state.permissionsDown = true;
            await page.goto(`${APP}/designs/studio`);
            const notice = page.getByText(
              t("Creator Studio couldn't be opened"),
            );
            await notice.waitFor({ timeout: 20000 });
            state.downSlow = 1500;
            const again = page.getByRole("button", { name: t("Try again") });
            await press(again);
            await page.waitForTimeout(300);
            assert(await notice.isVisible(), "the notice went during the try");
            assert(await again.isDisabled(), "the button can be pressed twice");
            await page.waitForFunction(
              (word) =>
                [...document.querySelectorAll("button")].some(
                  (button) =>
                    button.textContent.includes(word) && !button.disabled,
                ),
              t("Try again"),
              { timeout: 10000 },
            );
            assert(await notice.isVisible(), "the notice went after failing");
            state.downSlow = 0;
          },
        );

        await report.step(
          `${at}: Try again repairs the sidebar too`,
          async () => {
            assert(!(await studioRow.count()), "the row came early");
            state.permissionsDown = false;
            state.creator = true;
            await press(page.getByRole("button", { name: t("Try again") }));
            await page
              .getByText(t("Start a design"), { exact: true })
              .waitFor({ timeout: 20000 });
            await leaveFor("/friends");
            await studioRow
              .first()
              .waitFor({ state: "attached", timeout: 10000 });
          },
        );

        await report.step(
          `${at}: a rank taken away goes on window focus`,
          async () => {
            state.creator = false;
            await focusWindow();
            await studioRow
              .first()
              .waitFor({ state: "detached", timeout: 10000 });
          },
        );

        await report.step(
          `${at}: a rank given arrives on window focus`,
          async () => {
            state.creator = true;
            await focusWindow();
            await studioRow
              .first()
              .waitFor({ state: "attached", timeout: 10000 });
            state.creator = false;
          },
        );

        await report.step(`${at}: entering Designs asks again`, async () => {
          const before = state.asked;
          await leaveFor("/designs");
          await page.waitForTimeout(800);
          assert(state.asked > before, "no new question");
        });
      }

      if (!REAL) {
        const design = (name, status) => ({
          _id: `01FIXTURE${status}`,
          kind: "Decoration",
          name,
          creator_id: "me",
          file: fileOf("01FIXTUREFILE"),
          status,
          tags: [],
          revision: 1,
          popularity: 0,
          version: 0,
        });
        const noMakingOrChanging = async () => {
          for (const word of [
            "Upload design",
            "Template",
            "Edit",
            "Publish",
            "Archive",
            "Save draft",
          ]) {
            const count = await page
              .locator("main")
              .getByRole("button", { name: t(word), exact: true })
              .count();
            assert(!count, `a ${word} button`);
          }
          assert(
            !(await page.locator("main input[type=file]").count()),
            "a file field",
          );
          assert(
            !(await page.getByText(t("Start a design")).count()),
            "a way to start a design",
          );
        };

        await report.step(
          `${at}: suspended keeps the row, read-only`,
          async () => {
            state.standing = "Suspended";
            state.items = [
              design("Paused draft", "Draft"),
              design("Paused published", "Published"),
            ];
            await home();
            await studioRow.first().waitFor({ timeout: 20000 });
            await press(studioRow.first());
            await page.waitForURL(/\/designs\/studio/, { timeout: 15000 });
            await page
              .getByText(
                t(
                  "Your creator access is paused. Your designs are hidden from everyone until it is lifted. You can still see them and download a copy.",
                ),
              )
              .waitFor({ timeout: 20000 });
            await page
              .getByText("Paused draft", { exact: true })
              .first()
              .waitFor({ timeout: 10000 });
            await noMakingOrChanging();
            await page
              .getByText(t("The designs you made, kept here."), { exact: true })
              .waitFor({ timeout: 5000 });
            await shot("suspended-drafts");
          },
        );

        await report.step(
          `${at}: suspended sees published designs`,
          async () => {
            await press(
              page.getByRole("tab", { name: new RegExp(`^${t("Published")}`) }),
            );
            await page
              .getByText("Paused published", { exact: true })
              .first()
              .waitFor({ timeout: 10000 });
            await noMakingOrChanging();
            await shot("suspended-published");
          },
        );

        await report.step(`${at}: suspended can load the address`, async () => {
          await page.goto(`${APP}/designs/studio`);
          await page
            .getByText("Paused draft", { exact: true })
            .first()
            .waitFor({ timeout: 20000 });
          assert(/\/designs\/studio/.test(page.url()), "it went away");
          await noMakingOrChanging();
        });

        await report.step(
          `${at}: suspended, no drafts says no drafts`,
          async () => {
            const kept = state.items;
            state.items = [design("Paused published", "Published")];
            await page.goto(`${APP}/designs/studio`);
            await page
              .getByText(t("No drafts."), { exact: true })
              .waitFor({ timeout: 20000 });
            state.items = kept;
          },
        );

        await report.step(`${at}: suspended, no spot to fill`, async () => {
          await page.goto(`${APP}/designs/creators`);
          await page
            .getByText(t("The Zrzur team"), { exact: true })
            .first()
            .waitFor({ timeout: 20000 });
          await page.waitForTimeout(800);
          assert(!(await page.getByText(t("Your spot")).count()), "a spot");
        });

        await report.step(
          `${at}: suspended has no public-name choice`,
          async () => {
            await page.goto(`${APP}/settings`);
            await page
              .getByText(profileRow, { exact: true })
              .first()
              .waitFor({ timeout: 20000 });
            await page.waitForTimeout(1500);
            assert(
              !(await page
                .getByText(t("Show my name on the public Designs site"))
                .count()),
              "the choice is there",
            );
          },
        );

        await report.step(`${at}: revoked stays out`, async () => {
          state.standing = "Revoked";
          // this browser remembers the row from the suspended steps
          await home();
          await studioRow
            .first()
            .waitFor({ state: "detached", timeout: 10000 });
          await page.goto(`${APP}/designs/studio`);
          await page.waitForURL(
            (url) => url.pathname.replace(/\/$/, "") === "/designs",
            { timeout: 15000 },
          );
          assert(!(await rememberedRanks(page)).length, "it stayed remembered");
          state.standing = undefined;
          state.items = [];
        });
      }

      state.creator = true;

      if (!REAL) {
        await report.step(
          `${at}: a creator can load the address directly`,
          async () => {
            await page.goto(`${APP}/designs/studio`);
            await page
              .getByText(t("Start a design"), { exact: true })
              .waitFor({ timeout: 20000 });
            assert(/\/designs\/studio/.test(page.url()), "it went away");
          },
        );

        await report.step(`${at}: the wait has words on it`, async () => {
          await page.evaluate(() => localStorage.clear());
          state.slow = 2000;
          await page.goto(`${APP}/designs/studio`);
          await page
            .getByText(t("Loading…"), { exact: true })
            .first()
            .waitFor({ timeout: 10000 });
          await page
            .getByText(t("Start a design"), { exact: true })
            .waitFor({ timeout: 10000 });
          state.slow = 0;
        });

        if (!phone)
          await report.step(`${at}: the keyboard keeps its tab`, async () => {
            await page.evaluate(() => localStorage.clear());
            state.slow = 2000;
            await page.goto(`${APP}/designs`);
            const tab = page.getByRole("button", {
              name: t("Gallery"),
              exact: true,
            });
            await tab.waitFor({ timeout: 20000 });
            await tab.focus();
            await page
              .getByRole("button", { name: t("Creator Studio"), exact: true })
              .waitFor({ timeout: 10000 });
            state.slow = 0;
            assert(
              await tab.evaluate((el) => el === document.activeElement),
              "the focus was lost",
            );
          });
      }

      await report.step(
        `${at}: the rank brings the row, under Saved notes`,
        async () => {
          await home();
          await studioRow.first().waitFor({ timeout: 20000 });
          const words = (await studioRow.first().innerText()).trim();
          const icon = await studioRow.first().locator("svg").count();
          assert(icon, "the row has no icon");
          assert(words === t("Creator Studio"), `says ${words}`);
          const [row, saved, messages] = await Promise.all([
            studioRow.first().boundingBox(),
            page
              .getByText(t("Saved notes"), { exact: true })
              .first()
              .boundingBox(),
            page
              .getByText(t("Direct messages"), { exact: true })
              .first()
              .boundingBox(),
          ]);
          const gap = row.y - (saved.y + saved.height);
          assert(gap > 0 && gap < 32, `${gap} px below Saved notes`);
          assert(row.y < messages.y, "the row is below Direct messages");
          assert(row.height >= (phone ? 44 : 32), `row ${row.height}`);
          await shot("sidebar");
        },
      );

      await report.step(
        `${at}: known creators get it with no wait`,
        async () => {
          state.slow = 4000;
          await home();
          // the answer is still on its way
          await studioRow.first().waitFor({ state: "attached", timeout: 3000 });
        },
      );

      await report.step(`${at}: the row opens the studio`, async () => {
        await press(studioRow.first());
        // at once, with the answer about the rank still on its way
        await page.waitForURL(/\/designs\/studio/, { timeout: 2000 });
        state.slow = 0;
        await page
          .getByText(t("Start a design"), { exact: true })
          .waitFor({ timeout: 20000 });
      });

      await report.step(`${at}: it is a chapter of Designs`, async () => {
        const chapter = page
          .locator("[aria-current='page'], [aria-selected='true']")
          .filter({ hasText: t("Creator Studio") })
          .first();
        if (!phone) await chapter.waitFor({ timeout: 10000 });
        const heading = page.locator("main h1").first();
        assert(
          (await heading.innerText()).trim() === t("Creator Studio"),
          "another title",
        );
        const sky = await page
          .locator("main svg")
          .evaluateAll((all) =>
            all.some((svg) => svg.getBoundingClientRect().width > 300),
          );
        assert(sky, "no sky");
        const bar = await page.locator("[data-full='true']").boundingBox();
        assert(bar.height <= 72, `the bar is ${bar.height} tall`);
        await shot("studio");
      });

      await report.step(
        `${at}: a refused upload says so in plain words`,
        async () => {
          if (REAL) return;
          const upload = page.getByRole("button", { name: t("Upload design") });
          await press(upload.first());
          await page
            .locator("input[type=file]")
            .first()
            .setInputFiles({
              name: "ring.png",
              mimeType: "image/png",
              buffer: Buffer.from(await artwork(page), "base64"),
            });
          const title = page
            .locator("main input[type=text], main input:not([type])")
            .first();
          await title.waitFor({ timeout: 10000 });
          await title.fill("Pink ring");
          state.refuse = true;
          const before = state.asked;
          await press(page.getByRole("button", { name: t("Save draft") }));
          const alert = page.locator("main [role=alert]").first();
          await alert.waitFor({ timeout: 10000 });
          const words = await alert.innerText();
          assert(!/Missing|cosmetics|Error/.test(words), `shows ${words}`);
          await page.waitForTimeout(400);
          assert(state.asked > before, "the rank was not asked again");
          state.refuse = false;
          await shot("studio-error");
        },
      );

      await report.step(`${at}: upload, name, save, listed`, async () => {
        const saved = page.getByRole("button", { name: t("Save draft") });
        if (REAL || !(await saved.count())) {
          await press(
            page.getByRole("button", { name: t("Upload design") }).first(),
          );
          await page
            .locator("input[type=file]")
            .first()
            .setInputFiles({
              name: "ring.png",
              mimeType: "image/png",
              buffer: Buffer.from(await artwork(page), "base64"),
            });
          const title = page
            .locator("main input[type=text], main input:not([type])")
            .first();
          await title.fill(`Pink ring ${locale} ${name}`.slice(0, 32));
        }
        await press(saved);
        await page
          .getByText(/Pink ring/)
          .first()
          .waitFor({ timeout: 20000 });
        await page
          .getByText(t("Draft"), { exact: true })
          .first()
          .waitFor({ timeout: 10000 });
        await shot("studio-listed");
      });

      if (!REAL)
        await report.step(
          `${at}: a refused publish shows the new rank at once`,
          async () => {
            state.refuse = true;
            state.standing = "Suspended";
            await press(page.getByRole("button", { name: t("Publish") }));
            await page
              .getByText(
                t(
                  "Your creator access is paused. Your designs are hidden from everyone until it is lifted. You can still see them and download a copy.",
                ),
              )
              .waitFor({ timeout: 10000 });
            assert(
              !(await page.getByText(t("Start a design")).count()),
              "a way to start a design",
            );
            state.refuse = false;
            state.standing = undefined;
            await focusWindow();
            await page
              .getByText(t("Start a design"), { exact: true })
              .waitFor({ timeout: 10000 });
          },
        );

      await report.step(`${at}: no sideways scroll in the studio`, async () => {
        // real content past the edges of the Designs scroller. Not its
        // scrollWidth: the bar's edge-to-edge strip, once stuck, adds to that
        // on every Designs page, and the scroller clips it on purpose. The
        // sky is drawn wider than the page and clipped too.
        const past = await page
          .locator("[data-designs-scroll]")
          .evaluate((scroller) => {
            const edge = scroller.getBoundingClientRect();
            return [...scroller.querySelectorAll("*")]
              .filter((part) => {
                if (part.closest("svg")) return false;
                const box = part.getBoundingClientRect();
                return (
                  box.width &&
                  (box.right > edge.right + 1 || box.left < edge.left - 1)
                );
              })
              .slice(0, 4)
              .map(
                (part) => `${part.tagName} ${part.textContent.slice(0, 30)}`,
              );
          });
        assert(!past.length, `past the edge: ${past.join("; ")}`);
      });

      await report.step(
        `${at}: the public name is not in the studio`,
        async () => {
          const choice = t("Show my name on the public Designs site");
          assert(
            !(await page.getByText(choice).count()),
            "still in the studio",
          );
        },
      );

      await report.step(
        `${at}: the public name is in Profile settings`,
        async () => {
          await page.goto(`${APP}/settings`);
          if (phone) {
            const profile = page.getByText(profileRow, { exact: true }).first();
            await profile.waitFor({ timeout: 20000 });
            await settled();
            await profile.tap();
            await settled();
          }
          const toggle = page.getByRole("switch", {
            name: t("Show my name on the public Designs site"),
          });
          await toggle.waitFor({ timeout: 20000 });
          const on = async () =>
            (await toggle.getAttribute("aria-checked")) === "true";
          if (!REAL) {
            state.nameDown = true;
            await press(toggle);
            await page
              .locator("[role=alert]")
              .first()
              .waitFor({ timeout: 10000 });
            await page
              .getByText(t("Details"), { exact: true })
              .first()
              .waitFor({ timeout: 5000 });
            assert(!(await on()), "the switch stayed on after a failure");
            state.nameDown = false;
            state.nameSlow = 800;
          }
          await press(toggle);
          if (!REAL) {
            assert(await toggle.isDisabled(), "a second press is possible");
            await page.waitForTimeout(1000);
            state.nameSlow = 0;
            assert(await on(), "the switch is off after saving");
          }
          if (!REAL) {
            await page.waitForTimeout(500);
            assert(
              state.publicName.at(-1)?.show_public_name === true,
              `sent ${JSON.stringify(state.publicName)}`,
            );
          }
          await shot("profile-public-name");
          if (!REAL) {
            // closed and opened again in the same visit, no reload
            await page.keyboard.press("Escape");
            await page.waitForTimeout(500);
            await page.evaluate(() => {
              history.pushState({}, "", "/settings");
              dispatchEvent(new PopStateEvent("popstate"));
            });
            if (phone) {
              const profile = page
                .getByText(profileRow, { exact: true })
                .first();
              await profile.waitFor({ timeout: 20000 });
              await settled();
              await profile.tap();
              await settled();
            }
            const again = page.getByRole("switch", {
              name: t("Show my name on the public Designs site"),
            });
            await again.waitFor({ timeout: 20000 });
            assert(
              (await again.getAttribute("aria-checked")) === "true",
              "the saved choice did not come back",
            );
          }
        },
      );

      if (!REAL) {
        await report.step(
          `${at}: a creator shows a name, never a tag`,
          async () => {
            await page.goto(`${APP}/designs/creator/${MAKER._id}`);
            await page
              .getByText(MAKER.display_name, { exact: true })
              .first()
              .waitFor({ timeout: 20000 });
            const words = await page.locator("main").innerText();
            assert(!words.includes(`#${MAKER.discriminator}`), "the tag shows");
            assert(!words.includes(`@${MAKER.username}`), "the handle shows");
          },
        );

        await report.step(`${at}: no display name, still no tag`, async () => {
          await page.goto(`${APP}/designs/creator/${NAMELESS._id}`);
          await page
            .getByText(NAMELESS.username, { exact: true })
            .first()
            .waitFor({ timeout: 20000 });
          const words = await page.locator("main").innerText();
          assert(!words.includes("#"), "a # shows");
          assert(!words.includes(NAMELESS.discriminator), "the tag shows");
          assert(!words.includes(`@${NAMELESS.username}`), "the handle shows");
        });

        await report.step(`${at}: no display name, still listed`, async () => {
          state.listNameless = true;
          await page.goto(`${APP}/designs/creators`);
          await page
            .getByText(NAMELESS.username, { exact: true })
            .first()
            .waitFor({ timeout: 20000 });
          state.listNameless = false;
          const words = await page.locator("main").innerText();
          assert(!words.includes(NAMELESS.discriminator), "the tag shows");
          assert(!words.includes(`#${NAMELESS.username}`), "a # shows");
          assert(!/#\d{4}/.test(words), "a tag shows");
        });
      }

      await report.step(`${at}: no page errors`, async () => {
        assert(!errors.length, errors.join(" | ").slice(0, 300));
      });
    } finally {
      await report.step(`${at}: logs out`, async () => {
        assert(
          await logOut(signedIn, t),
          "logged out by the API, not the page",
        );
      });
      if (!REAL)
        await report.step(
          `${at}: nothing stays for the next account`,
          async () => {
            assert(!(await rememberedRanks(page)).length, "a rank stayed");
            state.creator = false;
            await typeLogin(page, accounts[1]);
            await home();
            await page.waitForTimeout(2000);
            assert(!(await studioRow.count()), "the next account has the row");
          },
        );
      if (!REAL)
        await report.step(`${at}: the next account logs out`, async () => {
          assert(await logOut(signedIn, t), "logged out by the API");
        });
      if (!REAL)
        await report.step(
          `${at}: a session ended elsewhere leaves no rank`,
          async () => {
            await typeLogin(page, accounts[1]);
            await page.evaluate(() =>
              localStorage.setItem("zrzur:creator:someone", "1"),
            );
            await endSession(session);
            live.delete(session);
            await page.goto(`${APP}/friends`);
            await page.waitForURL(/\/login|^[^/]*\/\/[^/]+\/?$/, {
              timeout: 30000,
            });
            assert(!(await rememberedRanks(page)).length, "a rank stayed");
          },
        );
      await context.close();
    }
  }
}

await Promise.all([...live].map(endSession));
await browser.close();
for (const step of report.results.filter((entry) => !entry.ok)) {
  console.log(`
${step.name}
${step.error}`);
}
process.exit(report.done() ? 1 : 0);
