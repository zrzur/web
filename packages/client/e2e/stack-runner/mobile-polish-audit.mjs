// Phone audit: screenshots + measurements (sideways scroll, small targets,
// small input text) per screen. Usage:
//   E2E_BASE=http://127.0.0.1:31071 E2E_CHROMIUM=... node mobile-polish-audit.mjs <before|after>
// Env: MP_LOCALES=en,ar,de  MP_SIZES=375x812,390x844  MP_ONLY=home,chat
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stack, tr } from "./mobile-polish-env.mjs";
import { measure } from "./mobile-polish-lib.mjs";
import { seed } from "./mobile-polish-seed.mjs";
const { pw, APP } = stack;

const phase = process.argv[2] ?? "before";
const out = `${(process.env.MP_SHOT_DIR ?? join(tmpdir(), "mobile-polish-shots")).replace(/[/]+$/, "")}/${phase}/`;
mkdirSync(out, { recursive: true });
const locales = (process.env.MP_LOCALES ?? "ar,en,de").split(",");
const sizes = (process.env.MP_SIZES ?? "375x812,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));
const only = process.env.MP_ONLY?.split(",");
const S = await seed();
const browser = await pw.chromium.launch({
  executablePath: process.env.E2E_CHROMIUM,
});
const report = [];

for (const locale of locales)
  for (const [width, height] of sizes) {
    const tag = `${locale}-${width}`;
    const ctx = await browser.newContext({
      viewport: { width, height },
      locale,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 150)));
    const shot = async (name, note) => {
      if (only && !only.includes(name)) return;
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}${tag}-${name}.png` });
      const m = await page.evaluate(measure);
      report.push({ tag, name, ...m, note });
      console.log(
        tag,
        name,
        `wide=${m.wide}`,
        `small=${m.small.length}`,
        `smallInput=${m.smallInput.length}`,
      );
    };
    const go = async (path) => {
      await page.goto(APP + path);
      await page.waitForTimeout(2500);
    };
    const step = async (name, fn) => {
      try {
        await fn();
      } catch (e) {
        console.log(tag, name, "FAILED", String(e.message).split("\n")[0]);
      }
    };

    await step("login", async () => {
      await go("/login");
      await shot("login");
    });
    await step("signup", async () => {
      await go("/login/create");
      await shot("signup");
    });
    await step("signup-resend", async () => {
      await go("/login/resend");
      await shot("login-resend");
    });

    await go("/login");
    await page.locator('input[type="email"]').fill(S.a.email);
    await page.locator('input[type="password"]').fill(S.a.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
      timeout: 60000,
    });
    await page.waitForTimeout(3000);

    await step("home", async () => {
      await go("/");
      await shot("home");
    });
    await step("friends", async () => {
      await go("/friends");
      await shot("friends");
    });
    await step("dm", async () => {
      await go(`/channel/${S.dmId}`);
      await shot("dm");
    });
    await step("chat", async () => {
      await go(`/server/${S.serverId}/channel/${S.textId}`);
      await shot("chat");
    });
    await step("composer", async () => {
      await go(`/server/${S.serverId}/channel/${S.textId}`);
      const box = page.locator(".cm-content").first();
      await box.tap();
      await box.pressSequentially("Draft message typed on the phone", {
        delay: 5,
      });
      await shot("composer-focused");
      await box.fill("");
    });
    await step("emoji", async () => {
      await page
        .getByRole("button", { name: tr(locale, "Open emoji picker") })
        .tap();
      await page.waitForTimeout(800);
      await shot("emoji-picker");
      await page.keyboard.press("Escape");
    });
    await step("gif", async () => {
      await go(`/server/${S.serverId}/channel/${S.textId}`);
      await page
        .getByRole("button", { name: tr(locale, "Open GIF picker") })
        .tap();
      await page.waitForTimeout(1000);
      await shot("gif-picker");
    });
    await step("attach", async () => {
      await go(`/server/${S.serverId}/channel/${S.textId}`);
      await page
        .locator("button[aria-label]")
        .filter({ has: page.locator("svg") })
        .first();
    });
    await step("long-press", async () => {
      await go(`/server/${S.serverId}/channel/${S.textId}`);
      const b = await page
        .getByText("Filler message 12", { exact: true })
        .boundingBox();
      await page
        .getByText("Filler message 12", { exact: true })
        .dispatchEvent("contextmenu", {
          clientX: b.x + 30,
          clientY: b.y + 5,
          bubbles: true,
        });
      await page.waitForTimeout(600);
      await shot("message-longpress");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
    });
    await step("members", async () => {
      await go(`/server/${S.serverId}/channel/${S.textId}`);
      await page.getByRole("button", { name: tr(locale, "Member list") }).tap();
      await shot("members");
    });
    await step("menu-servers", async () => {
      await go(`/server/${S.serverId}/channel/${S.textId}`);
      await page
        .getByRole("button", { name: tr(locale, "Toggle main sidebar") })
        .or(page.getByRole("button", { name: tr(locale, "Back"), exact: true }))
        .first()
        .tap();
      await page.waitForTimeout(600);
      await shot("menu-servers");
    });
    await step("menu-messages", async () => {
      await page.locator("[data-phone-tabs] button").nth(1).tap();
      await page.waitForTimeout(800);
      await shot("menu-messages");
    });
    await step("menu-you", async () => {
      await page.locator("[data-phone-tabs] button").nth(4).tap();
      await page.waitForTimeout(800);
      await shot("menu-you");
    });
    await step("menu-discover", async () => {
      await page.locator("[data-phone-tabs] button").nth(2).tap();
      await page.waitForTimeout(1500);
      await shot("menu-discover");
    });
    await step("dialog-create", async () => {
      await go("/");
      await page.locator("[data-phone-tabs] button").nth(0).tap();
      await page.waitForTimeout(600);
      await page
        .getByRole("button", { name: tr(locale, "Create or join a server") })
        .first()
        .tap()
        .catch(() => {});
      await page.waitForTimeout(600);
      await shot("dialog");
    });
    await step("voice", async () => {
      await go(`/server/${S.serverId}/channel/${S.voiceId}`);
      await shot("voice");
    });
    await step("discover", async () => {
      await go("/discover");
      await shot("discover");
    });
    await ctx.close();
    console.log(tag, "pageerrors", errors.length, errors.slice(0, 2));
  }
writeFileSync(`${out}metrics.json`, JSON.stringify(report, null, 1));
await browser.close();
