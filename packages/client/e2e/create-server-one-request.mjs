// Making a server from a template, as a person does, in en, ar and de, on
// desktop and at 375 px: one create request, no rate limit, and the server
// opens with its rooms in the app's language. Needs an API built with the
// blueprint on POST /servers/create. Seeded account 1; each server is deleted.
import { tr } from "./lib/catalog.mjs";
import {
  API,
  LOCALES,
  VIEWPORTS,
  api,
  checks,
  closeSessions,
  deleteServer,
  launch,
  login,
  seededAccounts,
  shots,
  token,
} from "./lib/stack.mjs";

const suite = checks("create-server-one-request");
const shot = shots("create-server-one-request");
const [account] = seededAccounts(1);
const session = await token(account);
const browser = await launch();

for (const locale of LOCALES)
  for (const [size, viewport] of Object.entries(VIEWPORTS)) {
    const name = `${locale} ${size}`;
    const { page, context, errors } = await login(browser, account, {
      viewport,
      locale,
    });
    const calls = [];
    page.on("response", (response) => {
      if (response.url().startsWith(`${API}/servers`)) {
        const method = response.request().method();
        if (method !== "GET" && method !== "OPTIONS")
          calls.push({ method, status: response.status() });
      }
    });
    let serverId;
    await suite.check(
      `${name}: one request, rooms in the language`,
      async () => {
        // on a phone the rail with this button sits in the drawer
        if (size === "phone")
          await page
            .getByRole("button", { name: tr(locale, "Toggle main sidebar") })
            .first()
            .click();
        await page
          .getByRole("button", { name: tr(locale, "Create or join a server") })
          .first()
          .click();
        await page.locator('[data-flow-choice="gaming"]').click();
        await page.locator('[data-flow-choice="community"]').click();
        await page.locator("input[name=name]").fill("E2E one request");
        await page.locator("[data-flow-rules] [role=switch]").click();
        const started = Date.now();
        await page
          .getByRole("button", { name: tr(locale, "Create"), exact: true })
          .click();
        await page.waitForURL(/\/server\/[0-9A-Z]{26}\/channel\//, {
          timeout: 15000,
        });
        const elapsed = Date.now() - started;
        serverId = page.url().match(/\/server\/([0-9A-Z]{26})/)[1];
        await page.screenshot({ path: shot(`${locale}-${size}`) });

        if (calls.length !== 1) throw new Error(JSON.stringify(calls));
        if (calls[0].status !== 200)
          throw new Error(`status ${calls[0].status}`);
        const server = await api(session, "GET", `/servers/${serverId}`);
        if (server.channels.length !== 6)
          throw new Error(`${server.channels.length} channels`);
        const titles = server.categories.map((category) => category.title);
        const expected = tr(locale, "Community");
        if (!titles.includes(expected)) throw new Error(titles.join(", "));
        if (errors.length) throw new Error(errors[0]);
        return `${elapsed} ms`;
      },
    );
    if (serverId) await deleteServer(serverId, account).catch(() => undefined);
    await context.close();
  }

await browser.close();
await closeSessions();
suite.finish();
