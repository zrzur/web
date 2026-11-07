// Errors in plain words and 44 px switches, as a person meets them, in ar, en
// and de, on desktop and at 375 px. The verification form: text long enough
// for the app and too short for the server, because ten emoji are twenty
// units in JavaScript and ten characters on the server. The switches on the
// bot page and in the create server dialog: measured, then pressed.
// Uses a bot of seeded account 1, or a throwaway one it deletes.
import { tr } from "./lib/catalog.mjs";
import {
  API,
  LOCALES,
  VIEWPORTS,
  api,
  checks,
  closeSessions,
  goTo,
  launch,
  login,
  seededAccounts,
  shots,
  token,
} from "./lib/stack.mjs";

const RAW = [
  "Validation error",
  "statement:",
  "length [",
  '"code"',
  "crates/",
  "FailedValidation",
];

const suite = checks("plain-errors-and-switches");
const shot = shots("plain-errors-and-switches");
const [account] = seededAccounts(1);
const session = await token(account);
// a bot of the account when it has one: the weekly limit may be used up
const owned = await api(session, "GET", "/bots/@me");
const made = owned.bots?.length
  ? undefined
  : await api(session, "POST", "/bots/create", {
      name: `plainerrors${Date.now().toString(36)}`,
    });
const botId = made ? (made.bot?._id ?? made._id) : owned.bots[0]._id;
const browser = await launch();

async function tall(page, target) {
  const box = await target.boundingBox();
  if (!box) throw new Error("no box");
  return box;
}

try {
  for (const locale of LOCALES)
    for (const [size, viewport] of Object.entries(VIEWPORTS)) {
      const name = `${locale} ${size}`;
      const { page, context, errors } = await login(browser, account, {
        viewport,
        locale,
      });
      // the bot may have an open request, which hides the form: this page
      // sees none. Sending the form still goes to the real server, and the
      // server looks at the form before it looks at the request.
      await page.route(`${API}/bots/${botId}/verification`, (route) =>
        route.request().method() === "GET"
          ? route.fulfill({ json: { verified: false } })
          : route.continue(),
      );
      await goTo(page, `/developers/${botId}`);

      await suite.check(
        `${name}: a refused form shows plain words`,
        async () => {
          const refused = page
            .waitForResponse(
              (response) =>
                response.url().endsWith("/verification") &&
                response.request().method() === "POST",
            )
            .catch(() => undefined);
          const statement = page.getByLabel(
            tr(
              locale,
              "What does your bot do, who uses it, and what data does it keep?",
            ),
          );
          await statement.fill("🙂".repeat(10));
          for (const input of await page.locator('input[dir="ltr"]').all()) {
            if (!(await input.inputValue()))
              await input.fill("https://example.org/policy");
          }
          await page
            .getByRole("button", { name: tr(locale, "Apply for verification") })
            .click();
          const answer = await refused;
          if (answer?.status() !== 400) throw new Error(`${answer?.status()}`);
          await page.waitForTimeout(500);
          const text = await page.locator("body").innerText();
          for (const raw of RAW)
            if (text.includes(raw))
              throw new Error(`raw text on screen: ${raw}`);
          const plain = [
            tr(
              locale,
              "Something you entered isn't valid. Check it and try again.",
            ),
            tr(locale, "Between {min} and {max} characters.")
              .replace("{min}", "20")
              .replace("{max}", "1000"),
          ];
          if (!plain.some((line) => text.includes(line)))
            throw new Error("no plain message");
          await page.screenshot({
            path: shot(`verification-${locale}-${size}`),
          });
        },
      );

      await suite.check(`${name}: bot switches`, async () => {
        const switches = page.getByRole("switch");
        const count = await switches.count();
        if (!count) throw new Error("no switch on the page");
        for (let i = 0; i < count; i++) {
          const box = await tall(page, switches.nth(i));
          const want = size === "phone" ? 44 : 22;
          if (box.height < want - 0.5 || (size === "phone" && box.width < 43.5))
            throw new Error(`switch ${i}: ${box.width}x${box.height}`);
        }
        const first = switches.first();
        const before = await first.getAttribute("aria-checked");
        await first.click();
        await page.waitForTimeout(200);
        if ((await first.getAttribute("aria-checked")) === before)
          throw new Error("the press did nothing");
        await first.click();
      });

      await goTo(page, "/", 2500);
      await suite.check(
        `${name}: rules switch when creating a server`,
        async () => {
          await page
            .getByRole("button", { name: tr(locale, "Add a server") })
            .first()
            .click();
          await page.locator('[data-flow-choice="gaming"]').click();
          await page.locator('[data-flow-choice="community"]').click();
          const toggle = page.locator("[data-flow-rules]").getByRole("switch");
          const target = (await toggle.count())
            ? toggle
            : page.locator('[data-flow-rules][role="switch"]');
          const box = await tall(page, target);
          if (size === "phone" && (box.height < 43.5 || box.width < 43.5))
            throw new Error(`${box.width}x${box.height}`);
          await target.click();
          if ((await target.getAttribute("aria-checked")) !== "true")
            throw new Error("not switched on");
          await page.screenshot({ path: shot(`rules-${locale}-${size}`) });
        },
      );

      if (errors.length) console.log(name, "page errors:", errors);
      await context.close();
    }
} finally {
  if (made)
    await api(session, "DELETE", `/bots/${botId}`).catch((error) =>
      console.log("bot left behind:", error.message),
    );
  await browser.close();
  await closeSessions();
}
suite.finish();
