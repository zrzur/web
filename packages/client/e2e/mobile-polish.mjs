// Phone flows in ar / en / de at 375 px (and 390 px):
// sign in, open a server from the rail, open a channel, send a message,
// long-press a message (bottom sheet), channel header, open a dialog,
// sign out and in again. Checks no sideways scroll at every step.
//
// Seeded accounts 1 (owner) and 2 (plain member).
// Env: MP_LOCALES=ar,en,de  MP_SIZES=375x812,390x844  MP_SHOTS=none to skip screenshots
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tr } from "./lib/catalog.mjs";
import { measure } from "./lib/measure.mjs";
import {
  APP,
  closeSessions,
  launch,
  reporter,
  trackSessions,
} from "./lib/stack.mjs";
import { moreFlows } from "./mobile-polish-flows.mjs";
import { seed } from "./mobile-polish-seed.mjs";

const locales = (process.env.MP_LOCALES ?? "ar,en,de").split(",");
const sizes = (process.env.MP_SIZES ?? "375x812,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));
const shotDir = `${(process.env.MP_SHOT_DIR ?? join(tmpdir(), "mobile-polish-shots")).replace(/[/]+$/, "")}/`;
const SHOTS = (process.env.MP_SHOTS ?? "after") !== "none";
if (SHOTS) mkdirSync(shotDir, { recursive: true });

const S = await seed();
const browser = await launch();
const rep = reporter("mobile-polish");
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

try {
for (const locale of locales) {
  for (const [width, height] of sizes) {
    const tag = `${locale}-${width}`;
    const T = (s) => tr(locale, s);
    const ctx = await browser.newContext({
      viewport: { width, height },
      locale,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    trackSessions(page);
    rep.page = page;
    const errors = [];
    page.on("pageerror", (e) =>
      errors.push(
        `${e.name}: ${e.message} @ ${String(e.stack).split("\n").slice(0, 3).join(" | ")}`,
      ),
    );
    const shot = (name) =>
      SHOTS && page.screenshot({ path: `${shotDir}${tag}-${name}.png` });
    const noSideways = async (where) => {
      const m = await page.evaluate(measure);
      expect(!m.wide, `${where}: page scrolls sideways`);
      expect(
        m.smallInput.length === 0,
        `${where}: text field under 16 px: ${m.smallInput}`,
      );
    };
    const step = (name, fn) =>
      rep.step(`${tag} ${name}`, async () => {
        try {
          await fn();
        } catch (e) {
          if (process.env.MP_DEBUG)
            console.log(String(e.message).slice(0, 1500));
          throw e;
        }
      });
    const back = () =>
      page
        .getByRole("button", { name: T("Toggle main sidebar") })
        .or(page.getByRole("button", { name: T("Back"), exact: true }))
        .first();
    const composer = () => page.locator(".cm-content").first();
    // rows of the quiet channel (never written to by the runner)
    // the dev stack throttles websocket connections: a page that stays on
    // "Connecting…" is reloaded after a pause
    const openChannel = async (channelId, ready) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        await page.goto(`${APP}/server/${S.serverId}/channel/${channelId}`);
        try {
          await composer().waitFor({ timeout: 20000 });
          await ready.waitFor({ timeout: 20000 });
          return;
        } catch (e) {
          if (attempt === 3) throw e;
          await page.waitForTimeout(8000);
        }
      }
    };
    const quiet = () =>
      openChannel(
        S.secondId,
        page.getByText("Target message 5", { exact: true }),
      );
    const lastMsg = () => page.getByText("Target message 5", { exact: true });
    const chat = () =>
      openChannel(
        S.textId,
        page.getByText(/^(Filler message|Phone test)/).last(),
      );

    await step("sign in on the phone", async () => {
      await page.goto(`${APP}/login`);
      await page.locator('input[type="email"]').fill(S.a.email);
      await page.locator('input[type="password"]').fill(S.a.password);
      await noSideways("login");
      await shot("login");
      await page.locator('button[type="submit"]').tap();
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
        timeout: 60000,
      });
      await page.waitForSelector("[data-phone-tabs]", { timeout: 30000 });
      await noSideways("after login");
    });

    await step("open a server from the rail", async () => {
      await page.goto(`${APP}/`);
      await back().tap(); // the menu side: tabs, rail, channel list
      await page.waitForSelector("[data-phone-tabs]");
      await page.locator("[data-phone-tabs] button").first().tap(); // Servers
      const rail = page
        .locator(
          `a[href="/server/${S.serverId}"], a[href^="/server/${S.serverId}/"]`,
        )
        .first();
      await rail.scrollIntoViewIfNeeded();
      await shot("rail");
      await rail.tap();
      await page.waitForURL(
        (u) => u.pathname.startsWith(`/server/${S.serverId}`),
        { timeout: 15000 },
      );
      await noSideways("server");
      const cut = await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            "[data-phone-tabs] button > span:last-child",
          ),
        ]
          .filter((e) => e.scrollWidth > e.clientWidth + 1)
          .map((e) => e.textContent),
      );
      expect(cut.length === 0, `tab labels cut off: ${cut}`);
    });

    await step("open a channel", async () => {
      // the rail stays on the menu side: the channel list of that server
      const link = page
        .locator(`a[href="/server/${S.serverId}/channel/${S.secondId}"]`)
        .first();
      await link.waitFor({ timeout: 15000 });
      await page.waitForTimeout(400);
      await shot("channel-list");
      // Playwright's tap sends an untrusted click that the router ignores for links;
      // a click on the touch-enabled page is what a finger produces on a real phone
      await link.click();
      await composer().waitFor({ timeout: 20000 });
      await page.waitForURL((u) => u.pathname.includes(S.secondId), {
        timeout: 10000,
      });
      await noSideways("channel");
    });

    await step(
      "channel header keeps the name and one More button",
      async () => {
        await chat();
        const h = await page.evaluate(() => {
          const title = [...document.querySelectorAll("*")].find(
            (e) =>
              e.children.length === 0 &&
              e.textContent?.trim() === "General" &&
              e.getBoundingClientRect().top < 120,
          );
          return title
            ? {
                clipped: title.scrollWidth > title.clientWidth + 1,
                w: title.getBoundingClientRect().width,
              }
            : null;
        });
        expect(h, "channel title not found in the header");
        expect(!h.clipped, `channel name is cut off (${Math.round(h.w)} px)`);
        await shot("chat");
        await page.getByRole("button", { name: T("More"), exact: true }).tap();
        const menu = page.getByRole("menu");
        await menu.waitFor();
        await menu
          .getByRole("menuitem", { name: T("Pinned messages") })
          .waitFor();
        await page.waitForTimeout(500); // the sheet slides up
        const box = await menu.boundingBox();
        expect(
          box.y + box.height >= height - 24,
          "More menu is not a bottom sheet",
        );
        await shot("header-more");
        await page.keyboard.press("Escape");
      },
    );

    await step("send a message", async () => {
      const text = `Phone test ${tag} ${Date.now()}`;
      await composer().tap();
      await composer().pressSequentially(text, { delay: 8 });
      await noSideways("composer");
      await shot("composer");
      await page.keyboard.press("Enter");
      await page.getByText(text, { exact: true }).waitFor({ timeout: 20000 });
    });

    await step("emoji picker cells are finger sized", async () => {
      await quiet();
      await page.getByRole("button", { name: T("Open emoji picker") }).tap();
      await page.locator(".z-emoji-cell").first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(500);
      const small = await page
        .locator(".z-emoji-cell")
        .evaluateAll(
          (els) =>
            els.filter(
              (e) =>
                e.getBoundingClientRect().width < 43.5 ||
                e.getBoundingClientRect().height < 43.5,
            ).length,
        );
      expect(small === 0, `${small} emoji cells under 44 px`);
      await noSideways("emoji picker");
      await shot("emoji-picker");
      await page.keyboard.press("Escape");
    });

    await step("no hover stuck after a tap", async () => {
      await quiet();
      const row = lastMsg();
      await row.tap();
      await page.waitForTimeout(300);
      const bg = await row.evaluate(
        (el) => getComputedStyle(el.closest("[id]")).backgroundColor,
      );
      expect(
        bg === "rgba(0, 0, 0, 0)" || bg === "transparent",
        `tapped message keeps a hover background (${bg})`,
      );
    });

    await step("long-press a message opens a bottom sheet", async () => {
      await quiet();
      const row = lastMsg();
      const b = await row.boundingBox();
      // Chrome's touch emulation sends no long-press contextmenu, so send the
      // event a phone sends after the hold
      await row.dispatchEvent("contextmenu", {
        clientX: b.x + 30,
        clientY: b.y + 5,
        bubbles: true,
      });
      const menu = page.getByRole("menu");
      await menu.waitFor();
      await menu.getByRole("menuitem", { name: T("Reply") }).waitFor();
      await page.waitForTimeout(500); // the sheet slides up
      const m = await menu.boundingBox();
      expect(m.width >= width - 24, `sheet is not full width (${m.width})`);
      expect(m.y + m.height >= height - 24, "sheet does not sit at the bottom");
      const small = await menu
        .getByRole("menuitem")
        .evaluateAll(
          (els) =>
            els.filter((e) => e.getBoundingClientRect().height < 44).length,
        );
      expect(small === 0, `${small} sheet rows under 44 px`);
      await shot("message-sheet");
      await page.keyboard.press("Escape");
      await menu.waitFor({ state: "hidden" });
    });

    await step("open and close a dialog", async () => {
      await back().tap();
      await page
        .getByRole("button", { name: T("Create or join a server") })
        .first()
        .tap();
      const dlg = page.getByRole("dialog").first();
      await dlg.waitFor();
      const d = await dlg.boundingBox();
      expect(
        d.width >= width - 2 && d.x >= -1,
        `dialog does not fit the screen (${Math.round(d.x)}, ${Math.round(d.width)})`,
      );
      await noSideways("dialog");
      await shot("dialog");
      await page.keyboard.press("Escape");
      await dlg.waitFor({ state: "hidden", timeout: 5000 });
    });

    await moreFlows({
      step,
      page,
      ctx,
      browser,
      S,
      APP,
      width,
      height,
      locale,
      tag,
      shot,
      shotDir,
      SHOTS,
      noSideways,
      composer,
      chat,
      back,
    });

    await step("sign out and in", async () => {
      await chat();
      await back().tap();
      await page.waitForTimeout(600);
      await page.locator("[data-phone-tabs] button").nth(4).tap(); // You
      await page.getByLabel(T("Settings"), { exact: true }).first().tap();
      await page.waitForTimeout(800);
      const out = page.getByText(T("Log out"), { exact: true }).first();
      await out.scrollIntoViewIfNeeded();
      await out.tap();
      const confirm = page
        .getByRole("dialog")
        .getByRole("button", { name: T("Log out"), exact: true });
      if (await confirm.count()) await confirm.first().tap();
      await page.waitForURL((u) => u.pathname.startsWith("/login"), {
        timeout: 30000,
      });
      await page.locator('input[type="email"]').fill(S.a.email);
      await page.locator('input[type="password"]').fill(S.a.password);
      await page.locator('button[type="submit"]').tap();
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
        timeout: 60000,
      });
      await page.waitForSelector("[data-phone-tabs]");
    });

    if (errors.length)
      console.log(
        `  note ${tag}: ${errors.length} page errors: ${errors.slice(0, 2).map((e) => e.slice(0, 400))}`,
      );
    await ctx.close();
  }
}
} finally {
  await browser.close();
  await closeSessions();
}
process.exitCode = rep.done() ? 1 : 0;
