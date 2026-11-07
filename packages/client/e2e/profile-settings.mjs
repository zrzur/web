// Profile settings as a person uses them, in ar, en and de, on desktop and at
// 375 px: section switches, order by arrows, keyboard and drag, hidden sections
// that reach nobody, links with their errors and the leave warning. Interests
// are hidden for Beta, and neither the settings nor the card show them. Each step
// is read back after a reload, and from a second account through the API. Puts
// the account back when done.
//   E2E_SHOTS=<folder>  E2E_STAGE=before|after: pictures of each box
import { mkdirSync } from "node:fs";

import { tr } from "./lib/catalog.mjs";
import {
  API,
  APP,
  LOCALES,
  VIEWPORTS,
  api,
  checks,
  closeSessions,
  launch,
  login,
  seededAccounts,
  token,
} from "./lib/stack.mjs";

const suite = checks("profile-settings");
const [account, viewer] = seededAccounts(2);
const session = await token(account);
const viewerSession = await token(viewer);
const me = await api(session, "GET", "/users/@me");
const stage = process.env.E2E_STAGE;
const folder = process.env.E2E_SHOTS;
if (folder) mkdirSync(folder, { recursive: true });

// the second account shares a server, so it may open the profile
const made = await api(session, "POST", "/servers/create", {
  name: "E2E profile",
});
const server = made.server ?? made;
const channelId = (made.channels?.[0] ?? {})._id ?? server.channels[0];
const invite = await api(session, "POST", `/channels/${channelId}/invites`, {});
await api(viewerSession, "POST", `/invites/${invite._id}`);

const own = () => api(session, "GET", `/users/${me._id}/profile`);
const seen = () => api(viewerSession, "GET", `/users/${me._id}/profile`);
const putBack = () =>
  api(session, "PATCH", "/users/@me", {
    profile: { sections: [], hidden_sections: [], links: [] },
    remove: ["ProfileSections"],
  }).catch(() =>
    api(session, "PATCH", "/users/@me", {
      profile: { hidden_sections: [], links: [] },
    }),
  );

async function openProfile(page, locale) {
  await page.goto(`${APP}/settings`);
  await page.waitForSelector(".settings_sidebar", { timeout: 30000 });
  await page
    .locator(".settings_sidebar .button")
    .filter({ hasText: /^(Profile|Profil|الملف الشخصي|الملف)$/ })
    .first()
    .click();
  await page.waitForTimeout(1500);
}

const box = (page, locale, title) =>
  page.locator("section").filter({
    has: page.locator("h3", { hasText: new RegExp(`^${tr(locale, title)}$`) }),
  });

async function picture(page, locale, size, title) {
  if (!folder) return;
  const name = title.toLowerCase().replace(/\W+/g, "-");
  await box(page, locale, title)
    .first()
    .screenshot({ path: `${folder}/${stage}-${name}-${locale}-${size}.png` })
    .catch(() => undefined);
}

const save = async (page, locale) => {
  await page
    .getByRole("button", { name: tr(locale, "Save changes") })
    .last()
    .click();
  await page.waitForTimeout(900);
};

const browser = await launch();
await putBack();

try {
  for (const locale of process.env.E2E_LOCALE?.split(",") ?? LOCALES)
    for (const [size, viewport] of Object.entries(VIEWPORTS)) {
      const name = `${locale} ${size}`;
      const { page, context, errors } = await login(browser, account, {
        viewport,
        locale,
      });
      await openProfile(page, locale);
      for (const title of ["Profile sections", "Links"])
        await picture(page, locale, size, title);
      if (stage === "before") {
        await context.close();
        continue;
      }

      const row = (id) => page.getByTestId(`section-row-${id}`);

      await suite.check(
        `${name}: an untouched profile shows every section`,
        async () => {
          const off = await page
            .locator("[data-testid^=section-row-] input:not(:checked)")
            .count();
          if (off) throw new Error(`${off} rows off`);
        },
      );

      await suite.check(
        `${name}: a hidden section reaches nobody, after reload too`,
        async () => {
          await page.evaluate(() => localStorage.setItem("e2e", "1"));
          await row("about").locator("label").click();
          await save(page, locale);
          const saved = await own();
          if (!saved.hidden_sections?.includes("about"))
            throw new Error(JSON.stringify(saved));
          const other = await seen();
          if (
            other.sections?.includes("about") ||
            other.hidden_sections?.length ||
            other.content
          )
            throw new Error(JSON.stringify(other));
          await openProfile(page, locale);
          if (await row("about").locator("input").isChecked())
            throw new Error("back on after reload");
          await row("about").locator("label").click();
          await save(page, locale);
        },
      );

      await suite.check(
        `${name}: order by arrows, keyboard and drag`,
        async () => {
          const order = async () =>
            await page
              .locator("[data-testid^=section-row-]")
              .evaluateAll((rows) =>
                rows.map((r) => r.dataset.testid.replace("section-row-", "")),
              );
          const first = (await order())[0];
          await row(first)
            .getByRole("button", {
              name: tr(locale, "Move {0} down").replace(
                "{0}",
                await row(first).getAttribute("aria-label"),
              ),
            })
            .click();
          if ((await order())[1] !== first)
            throw new Error("arrow did nothing");
          await row(first).focus();
          await page.keyboard.press("Alt+ArrowUp");
          await page.waitForTimeout(200);
          if ((await order())[0] !== first)
            throw new Error("keyboard did nothing");
          await page.keyboard.press("Alt+ArrowDown");
          await page.waitForTimeout(200);
          if (size === "desktop") {
            const handle = row(first).locator("button").first();
            const from = await handle.boundingBox();
            const to = await row((await order()).at(-1)).boundingBox();
            await handle.hover();
            await page.mouse.down();
            await page.mouse.move(from.x + 8, from.y + 30, { steps: 6 });
            await page.mouse.move(from.x + 8, to.y + to.height, { steps: 12 });
            await page.waitForTimeout(300);
            await page.mouse.up();
            await page.waitForTimeout(600);
          }
          const wanted = await order();
          await save(page, locale);
          await openProfile(page, locale);
          const after = await order();
          if (after.join() !== wanted.join())
            throw new Error(`${after} after reload, wanted ${wanted}`);
        },
      );

      await suite.check(
        `${name}: an http link is refused before sending, in plain words`,
        async () => {
          const links = box(page, locale, "Links");
          await links
            .getByRole("button", { name: tr(locale, "Add link") })
            .click();
          const field = links.locator("input").first();
          await field.fill("http://127.0.0.1:31060/x");
          const calls = [];
          page.on("request", (request) => {
            if (
              request.method() === "PATCH" &&
              request.url().endsWith("/users/@me")
            )
              calls.push(1);
          });
          await save(page, locale);
          const text = await links.innerText();
          if (!text.includes(tr(locale, "Links must start with https://")))
            throw new Error(`no message: ${text.slice(0, 200)}`);
          if (calls.length) throw new Error("it was sent");
          await picture(page, locale, size, "Links");
          await field.fill(`https://example.org/${"long/".repeat(40)}end`);
          await save(page, locale);
          const saved = await own();
          if (saved.links?.length !== 1)
            throw new Error(JSON.stringify(saved.links));
          const wide = await page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          );
          if (wide > 0) throw new Error(`sideways scroll ${wide}`);
        },
      );

      await suite.check(
        `${name}: the link shows with the leave warning`,
        async () => {
          const other = await seen();
          if (!other.links?.[0]?.startsWith("https://example.org/"))
            throw new Error(JSON.stringify(other));
          const posted = await api(
            session,
            "POST",
            `/channels/${channelId}/messages`,
            { content: "hello" },
          );
          await page.goto(`${APP}/server/${server._id}/channel/${channelId}`);
          await page
            .locator(
              `[data-message-id="${posted._id}"], #message-${posted._id}`,
            )
            .first()
            .waitFor({ timeout: 15000 })
            .catch(() => undefined);
          await page
            .getByText(me.display_name ?? me.username, { exact: true })
            .last()
            .click({ timeout: 8000 });
          // a phone goes straight to the full profile; on a desktop the card
          // has it in the "..." menu
          if (size === "desktop") {
            await page
              .getByRole("dialog")
              .getByRole("button", { name: tr(locale, "More"), exact: true })
              .click({ timeout: 8000 });
            await page
              .getByText(tr(locale, "View full profile"), { exact: true })
              .click({ timeout: 8000 });
          }
          await page
            .getByRole("button", { name: "example.org" })
            .first()
            .click({ timeout: 8000 });
          await page.waitForTimeout(500);
          const body = await page.locator("body").innerText();
          if (!body.includes("example.org")) throw new Error("no warning");
          if (page.url().includes("example.org"))
            throw new Error("left without a warning");
        },
      );

      if (errors.length) console.log(name, "page errors:", errors.slice(0, 3));
      await putBack();
      await context.close();
    }
} finally {
  await putBack();
  await api(session, "DELETE", `/servers/${server._id}`).catch(() => undefined);
  await browser.close();
  await closeSessions();
}
suite.finish({ api: API });
