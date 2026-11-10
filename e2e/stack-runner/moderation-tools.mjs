// Moderation tools, as a moderator uses them: select messages (message menu
// on desktop, the header's More menu on phones), Shift-click a range, delete
// them after the confirm dialog; delete the most recent messages; Esc stops
// selecting; Suppress @everyone and @here in the server's notification menu.
// ar, en, de at desktop and 375 px. Fixtures (server, channel, messages) go
// through the API; every step under test is a click or key press.
//
// Usage: node moderation-tools.mjs
// Env: E2E_BASE (web preview of this branch), E2E_API, E2E_WEB (this web
//   checkout, for its catalogs), E2E_CHROMIUM, E2E_LANGS=en,ar,de,
//   E2E_SIZES=desktop,phone, E2E_LIB (folder with stack.mjs and catalog.mjs;
//   default internal/test-env/e2e/lib), E2E_MAIL (maildev API). Makes two
//   throwaway accounts through maildev.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = fileURLToPath(import.meta.url).split("\\").join("/");
const INTERNAL = here.includes("/internal/")
  ? `${here.split("/internal/")[0]}/internal/`
  : undefined;
const libDir = process.env.E2E_LIB
  ? pathToFileURL(`${process.env.E2E_LIB.replace(/\/?$/, "/")}`)
  : existsSync(new URL("./lib/stack.mjs", import.meta.url))
    ? new URL("./lib/", import.meta.url)
    : pathToFileURL(`${INTERNAL}test-env/e2e/lib/`);
const { API, VIEWPORTS, LOCALES, api: apiRaw, login, pw, token, shots, reporter } =
  await import(new URL("stack.mjs", libDir));
const { tr } = await import(new URL("catalog.mjs", libDir));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** An API call that waits and tries again when the stack answers 429 */
async function api(...args) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await apiRaw(...args);
    } catch (error) {
      const retry = /\b429\b.*"retry_after":(\d+)/s.exec(String(error?.message))?.[1];
      if (!retry || attempt >= 12) throw error;
      await wait(Number(retry) + 1000);
    }
  }
}

async function until(fn, ms = 10000, what = "condition") {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await wait(300);
  }
  throw new Error(`timed out: ${what}`);
}

const noSideways = async (page) => {
  const ok = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  if (!ok) throw new Error("sideways scroll");
};

const shot = shots("moderation-tools-2026-11-09");
const r = reporter("moderation-tools");
const SIZES = (process.env.E2E_SIZES ?? "desktop,phone").split(",");
const LANGS = process.env.E2E_LANGS ? process.env.E2E_LANGS.split(",") : LOCALES;

// ----------------------------------------------------------------- fixtures
const MAIL = process.env.E2E_MAIL ?? "http://127.0.0.1:14080";

/** A fresh, verified throwaway account on the local stack (maildev) */
async function newAccount(label) {
  const run = Math.random().toString(36).slice(2, 8);
  const email = `modtools-${label}-${run}@zrzur.test`;
  const password = `Zr-${run}-${Date.now().toString(36)}!9x`;
  const post = (path, body, session) =>
    fetch(`${API}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(session ? { "x-session-token": session } : {}) },
      body: JSON.stringify(body),
    }).then(async (res) => {
      const text = await res.text();
      if (!res.ok) throw new Error(`${path} ${res.status} ${text.slice(0, 200)}`);
      return text ? JSON.parse(text) : {};
    });
  await post("/auth/account/create", { email, password, birth_month: "1990-01" });
  let code;
  for (let i = 0; i < 30 && !code; i++) {
    const mails = await fetch(`${MAIL}/email`).then((res) => res.json()).catch(() => []);
    const hit = mails
      .filter((m) => (m.to || []).some((to) => to.address?.toLowerCase() === email))
      .sort((x, y) => new Date(y.date) - new Date(x.date))[0];
    code = hit && `${hit.text ?? ""} ${hit.html ?? ""}`.match(/\/login\/verify\/([A-Za-z0-9_-]+)/)?.[1];
    if (!code) await wait(1000);
  }
  if (!code) throw new Error(`no verification mail for ${email}`);
  await post(`/auth/account/verify/${code}`, {});
  const { token: session } = await post("/auth/session/login", { email, password, friendly_name: "modtools-e2e" });
  await post("/onboard/complete", { username: `modtools${label}${run}` }, session);
  await post("/auth/session/logout", {}, session);
  return { email, password };
}

const ownerAccount = await newAccount("owner");
const memberAccount = await newAccount("member");
const owner = await token(ownerAccount);
const member = await token(memberAccount);
const { server } = await api(owner, "POST", "/servers/create", { name: "e2e-moderation" });
const SERVER = server._id;
const invite = await api(owner, "POST", `/channels/${server.channels[0]}/invites`);
await api(member, "POST", `/invites/${invite._id}`);
console.log("server", SERVER);

/** Messages left in a channel (by id) */
async function remaining(channel, ids) {
  const list = await api(owner, "GET", `/channels/${channel}/messages?limit=100`);
  const present = new Set(list.map((m) => m._id));
  return ids.filter((id) => present.has(id));
}

const browser = await pw.chromium.launch({ executablePath: process.env.E2E_CHROMIUM || undefined });
try {
  for (const locale of LANGS) {
    const t = (english) => tr(locale, english);
    for (const size of SIZES) {
      const viewport = VIEWPORTS[size];
      const tag = `${locale}-${size}`;
      const channel = await api(owner, "POST", `/servers/${SERVER}/channels`, {
        type: "Text",
        name: `purge-${tag}`.toLowerCase(),
      });
      const C = channel._id;
      const ids = [];
      for (let i = 1; i <= 4; i++) {
        const m = await api(member, "POST", `/channels/${C}/messages`, { content: `member ${tag} ${i}` });
        ids.push(m._id);
      }
      const ownMessage = await api(owner, "POST", `/channels/${C}/messages`, { content: `owner ${tag}` });

      const session = await login(browser, ownerAccount, { viewport, locale });
      const page = session.page;
      r.page = page;
      const open = async () => {
        await page.goto(`${process.env.E2E_BASE ?? "http://127.0.0.1:31060"}/server/${SERVER}/channel/${C}`, {
          waitUntil: "domcontentloaded",
          timeout: 120000,
        });
        await page.locator(`[id="${ids[3]}"]`).first().waitFor({ timeout: 30000 });
      };
      await open();
      const bar = page.getByTestId("message-selection-bar");
      const checked = () => page.locator('[data-message-select][aria-checked="true"]').count();

      await r.step(`${tag} moderator starts selecting messages`, async () => {
        if (size === "desktop") {
          await page.locator(`[id="${ids[0]}"]`).first().click({ button: "right" });
          await page.getByText(t("Select messages"), { exact: true }).first().click({ timeout: 8000 });
          await until(async () => (await checked()) === 1, 8000, "the message opened is selected");
        } else {
          await page.getByRole("button", { name: t("More") }).first().click({ timeout: 8000 });
          await page.getByText(t("Select messages"), { exact: true }).first().click({ timeout: 8000 });
          await page.locator(`[data-message-select="${ids[0]}"]`).click();
        }
        await bar.waitFor({ timeout: 8000 });
        await page.screenshot({ path: shot(`${tag}-selecting`) });
        await noSideways(page);
      });

      await r.step(`${tag} Shift-click selects a range`, async () => {
        await page.locator(`[data-message-select="${ids[2]}"]`).click({ modifiers: ["Shift"] });
        await until(async () => (await checked()) === 3, 8000, "three selected");
      });

      await r.step(`${tag} delete the selected messages after the confirm dialog`, async () => {
        await bar.getByRole("button", { name: t("Delete"), exact: true }).click({ timeout: 8000 });
        const dialog = page.getByRole("dialog").filter({ has: page.getByTestId("bulk-delete-dialog") });
        await dialog.waitFor({ timeout: 8000 });
        await page.screenshot({ path: shot(`${tag}-confirm`) });
        await noSideways(page);
        await dialog.getByRole("button").last().click({ timeout: 8000 });
        await until(async () => (await remaining(C, ids.slice(0, 3))).length === 0, 10000, "messages deleted");
        await until(async () => !(await bar.isVisible()), 8000, "selection ends");
        if ((await remaining(C, [ids[3]])).length !== 1) throw new Error("an unselected message was deleted");
      });

      await r.step(`${tag} Select all selects every message still deletable`, async () => {
        if (size === "desktop") {
          await page.locator(`[id="${ids[3]}"]`).first().click({ button: "right" });
          await page.getByText(t("Select messages"), { exact: true }).first().click({ timeout: 8000 });
        } else {
          await page.getByRole("button", { name: t("More") }).first().click({ timeout: 8000 });
          await page.getByText(t("Select messages"), { exact: true }).first().click({ timeout: 8000 });
        }
        await bar.waitFor({ timeout: 8000 });
        await bar.getByTestId("select-all-messages").click({ timeout: 8000 });
        // the member's last message and the owner's own are left
        await until(async () => (await checked()) === 2, 8000, "both left messages selected");
        await page.screenshot({ path: shot(`${tag}-select-all`) });
        await bar.getByRole("button", { name: t("Cancel"), exact: true }).click({ timeout: 8000 });
        await until(async () => !(await bar.isVisible()), 8000, "selection ends");
      });

      await r.step(`${tag} Esc stops selecting`, async () => {
        if (size === "desktop") {
          // desktop: selecting starts from a message's own menu (2026-11-10)
          await page.locator(`[id="${ids[3]}"]`).first().click({ button: "right" });
          await page.getByText(t("Select messages"), { exact: true }).first().click({ timeout: 8000 });
        } else {
          await page.getByRole("button", { name: t("More") }).first().click({ timeout: 8000 });
          await page.getByText(t("Select messages"), { exact: true }).first().click({ timeout: 8000 });
        }
        await bar.waitFor({ timeout: 8000 });
        // away from the header button, so its tooltip is not what Esc closes
        await page.mouse.move(viewport.width / 2, viewport.height / 2);
        await page.waitForTimeout(400);
        await page.keyboard.press("Escape");
        await until(async () => !(await bar.isVisible()), 8000, "selection bar gone");
      });

      await r.step(`${tag} delete recent messages`, async () => {
        if (await bar.isVisible()) {
          // already selecting
        } else if (size === "desktop") {
          // desktop: selecting starts from a message's own menu (2026-11-10)
          await page.locator(`[id="${ids[3]}"]`).first().click({ button: "right" });
          await page.getByText(t("Select messages"), { exact: true }).first().click({ timeout: 8000 });
        } else {
          await page.getByRole("button", { name: t("More") }).first().click({ timeout: 8000 });
          await page.getByText(t("Select messages"), { exact: true }).first().click({ timeout: 8000 });
        }
        await bar.getByRole("button", { name: t("Delete recent…") }).click({ timeout: 8000 });
        const dialog = page.getByRole("dialog").filter({ has: page.getByTestId("bulk-delete-dialog") });
        await dialog.waitFor({ timeout: 8000 });
        const confirm = dialog.getByRole("button").last();
        await until(async () => !(await confirm.isDisabled()), 15000, "recent messages found");
        await page.screenshot({ path: shot(`${tag}-recent`) });
        await noSideways(page);
        await confirm.click();
        await until(
          async () => (await remaining(C, [ids[3], ownMessage._id])).length === 0,
          10000,
          "recent messages deleted",
        );
      });

      /** Server menu > Notifications, moving into the submenu the way a hand does */
      let onChannelList = false;
      async function openNotifications() {
        await page.mouse.move(viewport.width / 2, viewport.height / 2);
        const menuButton = page.getByRole("button", { name: t("Server menu") }).filter({ visible: true }).first();
        if (size === "phone") {
          // phones show the channel list (with the server menu) one step
          // back; the menu button is in the page but off screen until then
          // the first time the channel is open; after Back the list stays
          if (!onChannelList) {
            onChannelList = true;
            await page
              .getByRole("button", { name: new RegExp(`^(${t("Back")}|${t("Toggle main sidebar")})$`) })
              .filter({ visible: true })
              .first()
              .click({ timeout: 8000 });
            await page.waitForTimeout(600);
          }
        }
        await page.waitForTimeout(800);
        await menuButton.click({ timeout: 15000 });
        await page.waitForTimeout(500);
        const row = page
          .getByText(t("Notifications"), { exact: true })
          .filter({ visible: true })
          .first();
        // a person points at the row; the submenu opens beside it
        await row.waitFor({ timeout: 8000 });
        const at = await row.boundingBox();
        if (!at) throw new Error("no Notifications row");
        if (size === "phone") {
          await row.tap({ timeout: 8000 });
          await page.waitForTimeout(500);
        }
        else await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2, { steps: 6 });
        const item = page.locator('[data-suppress="everyone"]:visible').first();
        await item.waitFor({ timeout: 8000 });
        const from = await row.boundingBox();
        const to = await item.boundingBox();
        if (from && to && size !== "phone") {
          // sideways along the row first, then down inside the submenu
          await page.mouse.move(to.x + 8, from.y + from.height / 2, { steps: 8 });
          await page.mouse.move(to.x + 8, to.y + to.height / 2, { steps: 8 });
        }
        return item;
      }

      await r.step(`${tag} Suppress @everyone and @here in the server menu`, async () => {
        const item = await openNotifications();
        const before = await item.getAttribute("aria-checked");
        await page.screenshot({ path: shot(`${tag}-suppress-menu`) });
        await noSideways(page);
        await item.click({ timeout: 8000 }).catch(async (error) => {
          const all = await page.locator('[data-suppress="everyone"]').count();
          throw new Error(`${all} items; ${String(error.message).replace(/\s+/g, " ").slice(0, 380)}`);
        });
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(400);
        const again = await openNotifications();
        const after = await again.getAttribute("aria-checked");
        if (after === before) throw new Error(`still ${after}`);
        // back as it was, for the next run
        await again.click({ timeout: 8000 });
        await page.keyboard.press("Escape").catch(() => {});
      });

      if (size === "phone") {
        await r.step(`${tag} Mute server opens its choices in the sheet`, async () => {
          await page.getByRole("button", { name: t("Server menu") }).filter({ visible: true }).first().click({ timeout: 15000 });
          await page.waitForTimeout(500);
          const mute = page.getByText(t("Mute server"), { exact: true }).filter({ visible: true }).first();
          await mute.tap({ timeout: 8000 });
          await page.getByText(t("For 15 minutes"), { exact: true }).filter({ visible: true }).first().waitFor({ timeout: 8000 });
          if (!(await page.getByText(t("Server info"), { exact: true }).filter({ visible: true }).count()))
            throw new Error("the sheet closed");
          await page.screenshot({ path: shot(`${tag}-mute-choices`) });
          await noSideways(page);
          await page.keyboard.press("Escape").catch(() => {});
        });
      }

      await r.step(`${tag} no page errors`, async () => {
        if (session.errors.length) throw new Error(session.errors.join(" | "));
      });
      await session.context.close();
    }
  }
} finally {
  await browser.close();
  await api(owner, "DELETE", `/servers/${SERVER}`).catch(() => {});
}
process.exit(r.done() ? 1 : 0);
