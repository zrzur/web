// The design audit of 2026-11-13, as a person meets it: the sign-up note does
// not cover the form's title, arrows point the right way in Arabic, the list
// of suggestions is whole and readable, the message menu keeps red for what
// removes something, search filters read "from:" in every language, every
// status choice fits a phone, and switches and sliders are big enough to hit.
// Runs in en/ar/de on desktop and at 375 px.
//
//   node e2e/stack-runner/app-design-audit.mjs
//
// Env: E2E_LIB (folder with stack.mjs and catalog.mjs), E2E_WEB (this web
//   checkout, for the catalogs), E2E_CHROMIUM (headless shell), E2E_BASE,
//   E2E_LOCALES. Signs in with the first dev account of stack.mjs. Only the
//   setup (a server of its own with two messages) and the clean-up go through
//   the API; every step under test is a click, a tap or typing.
import { pathToFileURL } from "node:url";

const lib = process.env.E2E_LIB;
if (!lib) {
  console.error("Set E2E_LIB to the folder with stack.mjs and catalog.mjs");
  process.exit(2);
}
const dir = pathToFileURL(`${lib.replace(/\/?$/, "/")}`);
const {
  API,
  APP,
  LOCALES,
  VIEWPORTS,
  accounts,
  api,
  login,
  pw,
  reporter,
  token,
} = await import(new URL("stack.mjs", dir));
const { tr } = await import(new URL("catalog.mjs", dir));

const account = accounts[0];
const browser = await pw.chromium.launch({
  executablePath: process.env.E2E_CHROMIUM,
  headless: true,
});
const report = reporter("app-design-audit");
const locales = process.env.E2E_LOCALES?.split(",") ?? LOCALES;

// setup: a server this account owns, so it may manage messages there
const setup = await token(account);
const made = await api(setup, "POST", "/servers/create", {
  name: `E2E design audit ${Date.now().toString(36)}`,
});
const server = made.server ?? made;
const channel = (made.channels ?? [])[0]?._id ?? server.channels[0];
for (const content of ["first message of the design audit", "second message"])
  await api(setup, "POST", `/channels/${channel}/messages`, { content });
const channelUrl = `${APP}/server/${server._id}/channel/${channel}`;

const signOut = (session) =>
  session
    ? fetch(`${API}/auth/session/logout`, {
        method: "POST",
        headers: { "x-session-token": session },
      }).catch(() => {})
    : undefined;

/** Runs in the page: direction icons whose mirroring does not fit the page */
const wrongWayIcons = () => {
  const rtl = document.documentElement.dir === "rtl";
  const directional =
    /^(caret-(left|right)|caret-double-(left|right)|arrow-(left|right)|arrow-bend-up-(left|right)|arrow-u-up-(left|right)|reply|undo|redo|send|paper-plane-tilt|sign-in|sign-out)$/;
  const flip = (el) => {
    const style = getComputedStyle(el);
    let sign = 1;
    if (style.scale && style.scale !== "none" && parseFloat(style.scale) < 0)
      sign *= -1;
    const matrix = style.transform.match(/matrix\(([^,]+),/);
    if (matrix && parseFloat(matrix[1]) < 0) sign *= -1;
    return sign;
  };
  const wrong = [];
  for (const icon of document.querySelectorAll(".z-icon[data-icon]")) {
    const name = icon.getAttribute("data-icon");
    if (!directional.test(name) || !icon.checkVisibility()) continue;
    let sign = 1;
    for (let el = icon; el && el !== document.body; el = el.parentElement)
      sign *= flip(el);
    for (const inner of icon.querySelectorAll("svg, svg *"))
      sign *= flip(inner);
    // mirrored exactly once in right-to-left, never in left-to-right
    if (rtl ? sign > 0 : sign < 0) wrong.push(name);
  }
  return wrong;
};

const inside = (inner, outer, slack = 1) =>
  inner.x >= outer.x - slack &&
  inner.y >= outer.y - slack &&
  inner.x + inner.width <= outer.x + outer.width + slack &&
  inner.y + inner.height <= outer.y + outer.height + slack;

try {
  for (const locale of locales) {
    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
      const at = `${locale} ${name}`;
      const phone = viewport.width < 600;
      const t = (text, context) => tr(locale, text, context);
      const screen = { x: 0, y: 0, ...viewport };

      // signed out: the sign-up page
      {
        const context = await browser.newContext({
          viewport,
          locale,
          isMobile: phone,
          hasTouch: phone,
        });
        const page = await context.newPage();
        report.page = page;
        await report.step(
          `${at}: sign-up asks for the consent box, and no note covers the form`,
          async () => {
            await page.goto(`${APP}/login/create`, {
              waitUntil: "domcontentloaded",
            });
            const email = page.locator('input[type="email"]').first();
            await email.waitFor({ timeout: 30000 });
            await email.click();
            await page.waitForTimeout(300);
            // the old "your email stays private" note is gone
            if (await page.getByRole("note").count())
              throw new Error("a note shows over the form");
            const box = page.locator('input[name="accept-terms"]');
            if (await box.isChecked()) throw new Error("the box starts ticked");
            await email.fill("consent-check@zrzur.test");
            await page
              .locator('input[name="new-password"]')
              .fill("a-Long-enough-pass-9431");
            // nothing may be sent while the box is empty
            let sent = false;
            page.on("request", (r) => {
              if (r.url().includes("/auth/account/create")) sent = true;
            });
            await page.locator('button[type="submit"]').click();
            const problem = page.getByText(
              t("Tick the box to accept before you continue."),
            );
            await problem.waitFor({ timeout: 5000 });
            await page.waitForTimeout(500);
            if (sent)
              throw new Error("the account request went out without consent");
            // a tap on the box ticks it and the problem goes away
            await box.check({ force: true });
            if (!(await box.isChecked()))
              throw new Error("the box did not tick");
            await problem.waitFor({ state: "detached", timeout: 3000 });
            const target = await box.boundingBox();
            const min = phone ? 43.5 : 19.5;
            if (target.width < min || target.height < min)
              throw new Error(`box target ${target.width} x ${target.height}`);
          },
        );
        await report.step(
          `${at}: sign-up arrows point the right way`,
          async () => {
            const wrong = await page.evaluate(wrongWayIcons);
            if (wrong.length) throw new Error(`wrong way: ${wrong.join(", ")}`);
          },
        );
        await context.close();
      }

      const { page, context, errors } = await login(browser, account, {
        viewport,
        locale,
      });
      report.page = page;
      const seen = {};
      page.on("request", (r) => {
        seen.token = r.headers()["x-session-token"] ?? seen.token;
      });
      const composer = () => page.locator('[contenteditable="true"]').last();
      const rows = () =>
        page.locator("main [id]").filter({ has: page.locator("time") });
      try {
        await report.step(`${at}: the channel opens`, async () => {
          await page.goto(channelUrl, { waitUntil: "domcontentloaded" });
          await composer().waitFor({ timeout: 30000 });
          await rows().first().waitFor({ timeout: 20000 });
        });

        await report.step(
          `${at}: Select messages is not a red row`,
          async () => {
            const row = rows().last();
            if (phone) {
              const box = await row.boundingBox();
              await page.touchscreen.tap(
                box.x + box.width / 2,
                box.y + box.height / 2,
              );
              await row.dispatchEvent("contextmenu");
            } else
              await row.click({ button: "right", position: { x: 200, y: 12 } });
            try {
              const select = page
                .getByText(t("Select messages"), { exact: true })
                .first();
              const remove = page
                .getByText(t("Delete message"), { exact: true })
                .first();
              await select.waitFor({ timeout: 8000 });
              await remove.waitFor({ timeout: 8000 });
              const colour = (item) =>
                item.evaluate((el) => getComputedStyle(el).color);
              const [quiet, red] = [await colour(select), await colour(remove)];
              if (quiet === red) throw new Error(`both rows are ${red}`);
              const order = await select.evaluate(
                (el, other) =>
                  !!(
                    el.compareDocumentPosition(other) &
                    Node.DOCUMENT_POSITION_FOLLOWING
                  ),
                await remove.elementHandle(),
              );
              if (!order)
                throw new Error("Select messages comes after Delete message");
            } finally {
              // a failed check must not leave the menu over the next step
              await page.keyboard.press("Escape");
              await page.waitForTimeout(400);
            }
          },
        );

        if (!phone)
          await report.step(
            `${at}: message toolbar arrows point the right way`,
            async () => {
              await page.mouse.move(0, 0);
              await rows().last().hover();
              await page
                .getByRole("toolbar", { name: t("Message actions") })
                .waitFor({ timeout: 5000 });
              const wrong = await page.evaluate(wrongWayIcons);
              if (wrong.length)
                throw new Error(`wrong way: ${wrong.join(", ")}`);
            },
          );

        await report.step(
          `${at}: suggestions are a whole, readable list`,
          async () => {
            await composer().click();
            await page.keyboard.type(":smi");
            const list = page.locator(".cm-tooltip-autocomplete").first();
            await list.waitFor({ timeout: 15000 });
            await page.waitForTimeout(300);
            const box = await list.boundingBox();
            if (!inside(box, screen))
              throw new Error("the list leaves the screen");
            const problems = await list.evaluate(
              (el, minRow) => {
                const found = [];
                const style = getComputedStyle(el);
                if (parseFloat(style.borderTopLeftRadius) < 10)
                  found.push("square corners");
                if (parseFloat(style.borderTopWidth) < 1)
                  found.push("no border");
                const frame = el.getBoundingClientRect();
                for (const row of el.querySelectorAll("li")) {
                  const r = row.getBoundingClientRect();
                  if (r.height < minRow - 0.5)
                    found.push(`row ${Math.round(r.height)} px`);
                  const label = row.querySelector(".cm-completionLabel");
                  if (!label) continue;
                  const l = label.getBoundingClientRect();
                  // cut off: wider than its box with no "…", or outside the list
                  if (
                    label.scrollWidth > label.clientWidth + 1 &&
                    getComputedStyle(label).textOverflow !== "ellipsis"
                  )
                    found.push(`cut: ${label.textContent}`);
                  if (l.left < frame.left - 1 || l.right > frame.right + 1)
                    found.push(`outside: ${label.textContent}`);
                }
                return [...new Set(found)];
              },
              phone ? 44 : 32,
            );
            await page.keyboard.press("Escape");
            for (let i = 0; i < 4; i++) await page.keyboard.press("Backspace");
            if (problems.length) throw new Error(problems.join("; "));
          },
        );

        if (!phone)
          await report.step(
            `${at}: search filters read from: in every language`,
            async () => {
              const box = page
                .locator(`input[aria-label="${t("Search messages")}"]`)
                .first();
              await box.click();
              const option = page.getByRole("option").first();
              await option.waitFor({ timeout: 8000 });
              const label = option.locator(".label");
              const word = (await label.textContent()).trim();
              if (!/^[a-z]+:$/.test(word))
                throw new Error(`first filter is "${word}"`);
              // the colon is drawn after the word: at its right end
              const colonLast = await label.evaluate((el) => {
                const text = el.firstChild;
                const range = document.createRange();
                range.setStart(text, text.length - 1);
                range.setEnd(text, text.length);
                const colon = range.getBoundingClientRect();
                range.setStart(text, 0);
                range.setEnd(text, 1);
                return colon.left > range.getBoundingClientRect().left;
              });
              if (!colonLast)
                throw new Error(`"${word}" is drawn with the colon first`);
              await page.keyboard.press("Escape");
              await composer().click();
            },
          );

        await report.step(
          `${at}: every status choice is on screen`,
          async () => {
            await page.goto(`${APP}/you`, { waitUntil: "domcontentloaded" });
            const chips = page.locator("[role=radiogroup] [role=radio]");
            await chips.first().waitFor({ timeout: 20000 });
            await page.waitForTimeout(400);
            const count = await chips.count();
            if (count < 4) throw new Error(`${count} choices`);
            for (let i = 0; i < count; i++) {
              const box = await chips.nth(i).boundingBox();
              if (!box || box.x < 0 || box.x + box.width > viewport.width + 0.5)
                throw new Error(`choice ${i + 1} is cut off at the edge`);
              if (phone && box.height < 43.5)
                throw new Error(`choice ${i + 1} is ${box.height} px tall`);
            }
          },
        );

        await report.step(
          `${at}: switches and sliders are big enough to hit`,
          async () => {
            await page.goto(`${APP}/settings`, {
              waitUntil: "domcontentloaded",
            });
            const entry = page
              .locator("a.button[role=link]")
              .filter({ hasText: t("Voice & Video") })
              .first();
            await entry.waitFor({ timeout: 20000 });
            await entry.click();
            const slider = page
              .locator('input[type="range"]')
              .locator("visible=true")
              .first();
            await slider.waitFor({ timeout: 15000 });
            const min = phone ? 43.5 : 23.5;
            const sliderBox = await slider.boundingBox();
            if (sliderBox.height < 23.5)
              throw new Error(`slider is ${sliderBox.height} px tall`);
            const toggle = page
              .locator('[role="switch"]')
              .locator("visible=true")
              .first();
            await toggle.scrollIntoViewIfNeeded();
            const toggleBox = await toggle.boundingBox();
            if (toggleBox.height < min)
              throw new Error(`switch is ${toggleBox.height} px tall`);
          },
        );

        await report.step(`${at}: no page errors`, async () => {
          if (errors.length) throw new Error(errors.join(" | ").slice(0, 300));
        });
      } finally {
        await signOut(seen.token);
        await context.close();
      }
    }
  }
} finally {
  await api(setup, "DELETE", `/servers/${server._id}`).catch(() => {});
  await signOut(setup);
  await browser.close();
}
process.exit(report.done() ? 1 : 0);
