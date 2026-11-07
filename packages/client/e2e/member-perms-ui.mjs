// Member overrides in the app: Channel settings → Permissions lists a member
// with their own entry (as a ticket bot leaves them), the entry opens in the
// editor, and Server settings → Audit log names the change.
// Seeded accounts 1 (owner) and 2; own server, deleted at the end.
// LOCALE=ar|en|de, PHONE=1 for 375 px.
import { tr } from "./lib/catalog.mjs";
import {
  call,
  checks,
  closeSessions,
  deleteServer,
  goTo,
  launch,
  LOCALE,
  PHONE,
  seededAccounts,
  session,
  shots,
  signIn,
  viewport,
} from "./lib/stack.mjs";

const tag = `${LOCALE}${PHONE ? "-phone" : ""}`;
const t = (english) => tr(LOCALE, english);
const shot = shots("member-perms-ui");
const { record, finish } = checks("member-perms-ui", tag);
const [ownerAccount, memberAccount] = seededAccounts(2);
const acc = { a: ownerAccount, b: memberAccount };
let browser;

const A = await session(acc.a);
const B = await session(acc.b);
const B_ID = (await call("GET", "/users/@me", undefined, B)).json._id;
const { server } = (await call("POST", "/servers/create", { name: "Member overrides" }, A)).json;
const S = server._id, CH = server.channels[0];
const code = (await call("POST", `/channels/${CH}/invites`, undefined, A)).json._id;
await call("POST", `/invites/${code}`, undefined, B);
const set = await call("PUT", `/channels/${CH}/permissions/members/${B_ID}`, { permissions: { allow: 2 ** 23, deny: 2 ** 22 } }, A);
record(tag, "the owner sets b's own entry", set.status === 200, set.status);

try {
  browser = await launch();
  const ctx = await browser.newContext({ viewport: viewport(), locale: LOCALE, colorScheme: "dark" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  await signIn(page, acc.a);
  await goTo(page, `/server/${S}/channel/${CH}`, 3500);
  const bName = (await call("GET", `/users/${B_ID}`, undefined, A)).json;
  const name = bName?.display_name ?? bName?.username;

  // Channel settings → Permissions
  await page.locator(`[aria-label="${t("Open channel settings")}"], [aria-label="${t("Channel settings")}"]`).first().click();
  await page.waitForTimeout(1000);
  await page.getByText(t("Permissions"), { exact: true }).first().click();
  await page.waitForTimeout(1200);
  const section = await page.getByText(t("Member overrides"), { exact: true }).count();
  record(tag, "Permissions lists 'Member overrides'", section > 0);
  const row = page.getByText(name, { exact: true }).last();
  record(tag, "with b's name", (await row.count()) > 0, name);
  record(tag, "and the counts", (await page.getByText(t("Grants {0} permissions and denies {1} permissions").replace("{0}", "1").replace("{1}", "1")).count()) > 0);
  await page.screenshot({ path: shot(`${tag}-settings-1-member-overrides`) });
  await row.click();
  await page.waitForTimeout(1200);
  const body = await page.locator("body").innerText();
  record(tag, "the row opens b's entry in the editor", body.includes(t("Manage messages")) && body.includes(t("Send messages")) && body.includes(name));
  await page.screenshot({ path: shot(`${tag}-settings-2-member-editor`) });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);

  // Server settings → Audit log
  await page.locator(`[aria-label="${t("Server menu")}"]`).first().click();
  await page.waitForTimeout(600);
  await page.getByText(new RegExp(`^(${t("Open server settings")}|${t("Server settings")})$`)).first().click();
  await page.waitForTimeout(1200);
  await page.getByText(t("Audit log"), { exact: true }).first().click();
  await page.waitForTimeout(3000);
  const line = `${t("changed permissions of {0} in {1}").split("{0}")[0]}${name}`;
  record(tag, "the audit log names the member change", (await page.getByText(line).count()) > 0, line);
  await page.screenshot({ path: shot(`${tag}-settings-3-audit`) });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  record(tag, "no sideways scroll", overflow <= 0, overflow);
  record(tag, "no page errors", errors.length === 0, errors.join(" | "));
} finally {
  await browser?.close();
  await deleteServer(S, acc.a, A);
  await closeSessions();
  finish();
}
