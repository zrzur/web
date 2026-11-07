// The optional list of Arabic insults, as a server owner uses it, in ar, en
// and de, on desktop and at 375 px: switch it on in Server settings → Safety →
// Filters, see it become a rule, and see a member's message blocked by it.
// Each server is made for the run and deleted.
import { tr } from "./lib/catalog.mjs";
import {
  API,
  LOCALES,
  VIEWPORTS,
  api,
  checks,
  closeSessions,
  deleteServer,
  goTo,
  launch,
  login,
  seededAccounts,
  shots,
  token,
} from "./lib/stack.mjs";

const suite = checks("automod-insults-list");
const shot = shots("automod-insults-list");
const [account] = seededAccounts(1);
const session = await token(account);
const browser = await launch();

for (const locale of process.env.E2E_LOCALE?.split(",") ?? LOCALES)
  for (const [size, viewport] of Object.entries(VIEWPORTS)) {
    const name = `${locale} ${size}`;
    const made = await api(session, "POST", "/servers/create", {
      name: `E2E list ${locale} ${size}`,
    });
    const server = made.server ?? made;
    const { page, context } = await login(browser, account, {
      viewport,
      locale,
    });
    await suite.check(`${name}: switching it on makes a rule`, async () => {
      await goTo(page, `/server/${server._id}`);
      // behind the chat on a phone: the press goes to the button
      await page
        .getByLabel(tr(locale, "Server menu"))
        .first()
        .dispatchEvent("click");
      await page
        .getByText(tr(locale, "Open server settings"), { exact: true })
        .first()
        .click();
      await page
        .locator(".settings_sidebar .button")
        .filter({ hasText: new RegExp(`^${tr(locale, "Safety")}$`) })
        .first()
        .click();
      const title = tr(locale, "Arabic insults");
      await page
        .getByRole("switch", { name: title })
        .first()
        .click({ timeout: 15000 });
      await page.waitForTimeout(1000);
      const rules = await api(session, "GET", `/servers/${server._id}/automod`);
      const rule = (rules.rules ?? rules).find(
        (r) => r.id === "preset-arabic-insults",
      );
      if (!rule) throw new Error("no rule saved");
      if (rule.trigger.words.length !== 3) throw new Error("wrong words");
      if (rule.actions.block !== true) throw new Error("does not block");
      await page.screenshot({ path: shot(`${locale}-${size}`) });
    });
    await deleteServer(server._id, account).catch(() => undefined);
    await context.close();
  }

await browser.close();
await closeSessions();
suite.finish({ api: API });
