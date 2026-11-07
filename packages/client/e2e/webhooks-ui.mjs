// Webhooks in server settings, as a person uses them, in ar/en/de on desktop and
// at 375 px: create, copy the address once, rename, send a test message, new
// address, delete, a refused name, the "switched off" state.
//
// MOCK=1 (default): the app and sign-in are real, the webhook routes are answered
// here, which is also the only way to see the "switched off" state. MOCK=0 uses
// the real API and needs a stack with webhooks on.
//
// Seeded account 1; own server, deleted at the end.
// Env: E2E_LOCALES (ar,en,de), E2E_SIZES (desktop,phone).
import { tr } from "./lib/catalog.mjs";
import {
  api,
  API,
  APP,
  closeSessions,
  deleteServer,
  launch,
  LOCALES,
  login,
  seededAccounts,
  shots,
  sleep,
  token,
  VIEWPORTS,
} from "./lib/stack.mjs";

const accounts = seededAccounts(1);
const MOCK = process.env.MOCK !== "0";
const SIZES = (process.env.E2E_SIZES ?? "desktop,phone").split(",");
const LANGS = process.env.E2E_LOCALES?.split(",") ?? LOCALES;
const shot = shots("webhooks-ui");
const results = [];

const owner = await token(accounts[0]);
const created = await api(owner, "POST", "/servers/create", {
  name: "e2e-webhooks",
  nonce: `wh-${Date.now()}`,
});
const SERVER = created.server._id;
const CHANNEL = created.channels?.[0]?._id ?? created.server.channels[0];
const NAME = "e2e-webhooks";
const me = await api(owner, "GET", "/users/@me");

/** The webhook routes, as the backend of this branch answers them */
function mockRoutes(context, { enabled }) {
  const hooks = new Map();
  const json = (route, status, body) =>
    route.fulfill({
      status,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: body === undefined ? "" : JSON.stringify(body),
    });
  const ulid = () =>
    `01KA${Math.random().toString(36).toUpperCase().replace(/[^0-9A-HJKMNP-TV-Z]/g, "").padEnd(22, "0").slice(0, 22)}`;
  const withToken = (hook) => {
    const secret = `zrzur_wh_${"a".repeat(43)}`.replace(/a{6}/, ulid().slice(4, 10));
    return { ...hook, token: secret, url: `${API}/webhooks/${hook.id}/${secret}` };
  };

  return context.route(
    (url) =>
      url.href.startsWith(API) &&
      (url.pathname === "/" ||
        url.pathname.includes("/webhooks")),
    async (route, request) => {
      const url = new URL(request.url());
      const method = request.method();
      const path = url.pathname;
      if (method === "OPTIONS") {
        return route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "*",
            "access-control-allow-methods": "*",
          },
        });
      }
      if (path === "/") {
        // the page may be gone by the time the answer arrives
        return route
          .fetch()
          .then(async (response) => {
            const body = await response.json();
            body.features.webhooks = enabled;
            return route.fulfill({ response, json: body });
          })
          .catch(() => {});
      }
      let match;
      if (path === `/servers/${SERVER}/webhooks`) {
        return json(route, 200, [...hooks.values()].reverse());
      }
      if ((match = path.match(/^\/channels\/([^/]+)\/webhooks$/))) {
        if (method === "GET") {
          return json(route, 200, [...hooks.values()].filter((h) => h.channel_id === match[1]));
        }
        const { name } = request.postDataJSON();
        if (/zrzur/i.test(name)) {
          return json(route, 400, { type: "InvalidUsername" });
        }
        const hook = { id: ulid(), name, creator_id: me._id, channel_id: match[1], permissions: 0 };
        hooks.set(hook.id, hook);
        return json(route, 200, withToken(hook));
      }
      if ((match = path.match(/^\/webhooks\/([^/]+)\/token$/))) {
        return json(route, 200, withToken(hooks.get(match[1])));
      }
      if ((match = path.match(/^\/webhooks\/([^/]+)\/test$/))) {
        const hook = hooks.get(match[1]);
        hook.last_used = new Date().toISOString();
        return json(route, 200, { _id: ulid(), channel: hook.channel_id, author: hook.id, content: "x" });
      }
      if ((match = path.match(/^\/webhooks\/([^/]+)$/))) {
        if (method === "DELETE") {
          hooks.delete(match[1]);
          return json(route, 204);
        }
        const hook = { ...hooks.get(match[1]), ...request.postDataJSON() };
        delete hook.remove;
        hooks.set(hook.id, hook);
        return json(route, 200, hook);
      }
      return route.fallback();
    },
  );
}

async function openApps(page, t, phone) {
  await page.goto(`${APP}/server/${SERVER}`);
  await page.getByText(NAME, { exact: true }).first().waitFor({ state: "attached", timeout: 30000 });
  await sleep(1500);
  if (phone) {
    const rtl = await page.evaluate(() => document.dir === "rtl" || getComputedStyle(document.body).direction === "rtl");
    await page.mouse.click(rtl ? page.viewportSize().width - 18 : 18, 29);
    await sleep(700);
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const boxes = await page.getByText(NAME, { exact: true }).evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2, w: box.width };
      }),
    );
    const hit = boxes.find((b) => b.y > (phone ? 8 : 40) && b.y < 90 && b.w > 20);
    if (hit) {
      await page.mouse.click(hit.x, hit.y);
      break;
    }
    await sleep(800);
  }
  await page.getByRole("menuitem", { name: t("Open server settings") }).click({ timeout: 10000 });
  await page.locator(".settings_sidebar").waitFor({ timeout: 10000 });
  await sleep(600);
  await page.locator(".settings_sidebar").getByRole("link", { name: t("Apps"), exact: true }).first().click({ timeout: 10000 });
  await sleep(900);
}

async function noSideways(page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (over > 1) throw new Error(`sideways scroll: ${over}px`);
}

const browser = await launch();

try {
for (const lang of LANGS) {
  for (const size of SIZES) {
    const phone = size === "phone";
    const t = (english) => tr(lang, english);
    const label = `${lang} ${size}`;
    const step = async (name, fn, page) => {
      try {
        await fn();
        results.push({ name: `${name} [${label}]`, ok: true });
        console.log(`  ok   ${name} [${label}]`);
      } catch (error) {
        const message = String(error?.message ?? error).split("\n")[0].slice(0, 240);
        results.push({ name: `${name} [${label}]`, ok: false, error: message });
        console.log(`  FAIL ${name} [${label}]\n       ${message}`);
        await page.screenshot({ path: shot(`FAIL-${name.replace(/\W+/g, "_")}-${lang}-${size}`) }).catch(() => {});
      }
    };

    const { page, context, errors } = await login(browser, accounts[0], {
      viewport: VIEWPORTS[size],
      locale: lang,
    });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
    await page.evaluate((l) => localStorage.setItem("lang", l), lang);
    if (MOCK) await mockRoutes(context, { enabled: true });

    const name = `hook ${lang} ${size}`;
    const renamed = `${name} two`;
    const row = (text) => page.getByText(text, { exact: true }).first();

    await step("create shows the address once", async () => {
      await openApps(page, t, phone);
      await page.getByLabel(t("Webhook name"), { exact: true }).first().fill(name);
      await page.getByRole("button", { name: t("Create webhook") }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel(t("Webhook address")).waitFor({ timeout: 8000 });
      const address = await dialog.getByLabel(t("Webhook address")).inputValue();
      if (!/\/webhooks\/[^/]+\/zrzur_wh_/.test(address)) throw new Error(`address ${address}`);
      await dialog.getByRole("button", { name: t("Copy"), exact: true }).click();
      await sleep(300);
      if (!phone) {
        const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => address);
        if (copied !== address) throw new Error("not copied");
      }
      await page.screenshot({ path: shot(`address-${lang}-${size}`) });
      await dialog.getByRole("button", { name: t("Done"), exact: true }).click();
      await dialog.waitFor({ state: "detached", timeout: 5000 });
      await row(name).waitFor({ timeout: 8000 });
    }, page);

    await step("the row says who, when, and has room", async () => {
      await page.getByText(t("Created by {creator} on {made}. Not used yet.").split("{creator}")[0], { exact: false }).first().waitFor({ timeout: 8000 });
      await noSideways(page);
      await page.screenshot({ path: shot(`list-${lang}-${size}`), fullPage: true });
    }, page);

    await step("a refused name shows in plain words", async () => {
      await page.getByLabel(t("Webhook name"), { exact: true }).first().fill("Zrzur");
      await page.getByRole("button", { name: t("Create webhook") }).click();
      await page.getByText(t("This username is not allowed."), { exact: true }).first().waitFor({ timeout: 8000 });
      await page.getByLabel(t("Webhook name"), { exact: true }).first().fill("");
    }, page);

    await step("rename", async () => {
      await page.getByRole("button", { name: t("Edit"), exact: true }).first().click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel(t("Webhook name")).fill(renamed);
      await page.screenshot({ path: shot(`edit-${lang}-${size}`) });
      await dialog.getByRole("button", { name: t("Save"), exact: true }).click();
      await dialog.waitFor({ state: "detached", timeout: 8000 });
      await row(renamed).waitFor({ timeout: 8000 });
    }, page);

    await step("send test", async () => {
      await page.getByRole("button", { name: t("Send test"), exact: true }).first().click();
      await page.getByRole("status").filter({ hasText: "#" }).first().waitFor({ timeout: 8000 });
    }, page);

    await step("new address", async () => {
      await page.getByRole("button", { name: t("New address"), exact: true }).first().click();
      const dialog = page.getByRole("dialog");
      await dialog.getByText(t("Make a new address?")).first().waitFor({ timeout: 5000 });
      await dialog.getByRole("button", { name: t("Make new address") }).click();
      await page.getByRole("dialog").getByLabel(t("Webhook address")).waitFor({ timeout: 8000 });
      await page.getByRole("dialog").getByRole("button", { name: t("Done"), exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "detached", timeout: 5000 });
    }, page);

    await step("delete asks first", async () => {
      await page.getByRole("button", { name: t("Delete"), exact: true }).first().click();
      const dialog = page.getByRole("dialog");
      await dialog.getByText(t("Delete this webhook?")).first().waitFor({ timeout: 5000 });
      await dialog.getByRole("button", { name: t("Delete"), exact: true }).click();
      await dialog.waitFor({ state: "detached", timeout: 8000 });
      await page.getByText(t("No webhooks yet."), { exact: true }).first().waitFor({ timeout: 8000 });
    }, page);

    if (!phone) {
      await step("channel settings have the same screen", async () => {
        await page.keyboard.press("Escape");
        await page.goto(`${APP}/server/${SERVER}/channel/${CHANNEL}`);
        await sleep(2500);
        const entry = page.getByRole("link", { name: "General" }).first();
        await entry.click({ button: "right", timeout: 10000 });
        await page.getByRole("menuitem", { name: t("Open channel settings") }).click({ timeout: 10000 });
        await page.locator(".settings_sidebar").getByRole("link", { name: t("Webhooks"), exact: true }).first().click({ timeout: 10000 });
        await page.getByLabel(t("Webhook name"), { exact: true }).first().fill(`${name} channel`);
        await page.getByRole("button", { name: t("Create webhook") }).click();
        await page.getByRole("dialog").getByRole("button", { name: t("Done"), exact: true }).click({ timeout: 8000 });
        await row(`${name} channel`).waitFor({ timeout: 8000 });
        await page.screenshot({ path: shot(`channel-${lang}-${size}`) });
      }, page);
    }

    if (lang === "ar") {
      await step("right to left", async () => {
        const direction = await page.evaluate(() => getComputedStyle(document.querySelector(".settings_cont") ?? document.body).direction);
        if (direction !== "rtl") throw new Error(direction);
      }, page);
    }

    if (errors.length) console.log(`  page errors [${label}]: ${errors.length}`);
    await context.close();

    if (MOCK) {
      const off = await login(browser, accounts[0], { viewport: VIEWPORTS[size], locale: lang });
      await off.page.evaluate((l) => localStorage.setItem("lang", l), lang);
      await mockRoutes(off.context, { enabled: false });
      await step("switched off says so, with no way to create", async () => {
        await openApps(off.page, t, phone);
        await off.page.getByText(t("Webhooks are switched off here."), { exact: true }).first().waitFor({ timeout: 8000 });
        if (await off.page.getByRole("button", { name: t("Create webhook") }).count()) {
          throw new Error("create button shown");
        }
        await off.page.screenshot({ path: shot(`off-${lang}-${size}`) });
      }, off.page);
      await off.context.close();
    }
  }
}

} finally {
  await browser.close();
  await deleteServer(SERVER, accounts[0], { "x-session-token": owner });
  await closeSessions();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nwebhooks-ui (${MOCK ? "webhook routes mocked" : "real API"}): ${results.length - failed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
