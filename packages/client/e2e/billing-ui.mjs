// Wings and Feather in the app. Needs a stack with `features.billing` on and the
// test payment provider: nothing is charged. Seeded account 1; own server,
// deleted at the end. LOCALE=ar|en|de, PHONE=1 for 375 px.
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
  shots,
  signIn,
  sleep,
  token,
  viewport,
} from "./lib/stack.mjs";

const tag = `${LOCALE}${PHONE ? "-phone" : ""}`;
const t = (english) => tr(LOCALE, english);
const shot = shots("billing-ui");
const { check, finish } = checks("billing-ui", tag);
const [ownerAccount] = seededAccounts(1);
const acc = { a: ownerAccount };
let browser;

const T = await token(acc.a);
const A = { "x-session-token": T };
const S = (await call("POST", "/servers/create", { name: `Wings UI (${tag})` }, A)).json.server._id;
const count = async () => (await call("GET", `/billing/servers/${S}`, undefined, A)).json?.count ?? -1;

browser = await launch();
const page = await (await browser.newContext({ viewport: viewport(), locale: LOCALE, colorScheme: "dark" })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
try {
  await signIn(page, acc.a);
  await page.waitForTimeout(3000);

  await check("Server menu opens the Wings dialog", async () => {
    await goTo(page, `/server/${S}`, 2500);
    await page.locator(`a[href*="${S}"]`).first().click({ button: "right" });
    await page.getByRole("menuitem").filter({ hasText: t("Give Wings") }).first().click({ timeout: 8000 });
    await page.getByRole("dialog").filter({ hasText: t("Wings for {0}").split("{0}")[0].trim() }).first().waitFor({ timeout: 8000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: shot(`${tag}-wings-dialog`) });
    return "open";
  });

  await check("Giving a Wing raises the server's count", async () => {
    const before = await count();
    await page.getByRole("dialog").getByRole("button").filter({ hasText: new RegExp(`${t("Give a Wing")}|${t("Give your free Wing")}`) }).first().click();
    for (let i = 0; i < 30 && (await count()) === before; i++) await sleep(500);
    const after = await count();
    await page.waitForTimeout(800);
    await page.screenshot({ path: shot(`${tag}-wings-given`) });
    if (after !== before + 1) throw new Error(`${before} → ${after}`);
    const shown = await page.getByRole("dialog").innerText();
    if (!shown.includes(String(after))) throw new Error(`dialog does not show ${after}`);
    return `${before} → ${after}, shown in the dialog`;
  });

  await check("Taking it back lowers the count", async () => {
    const before = await count();
    await page.getByRole("dialog").getByRole("button").filter({ hasText: t("Take one back") }).first().click({ timeout: 8000 });
    for (let i = 0; i < 30 && (await count()) === before; i++) await sleep(500);
    const after = await count();
    if (after !== before - 1) throw new Error(`${before} → ${after}`);
    return `${before} → ${after}`;
  });

  await check("Feather page shows the subscription", async () => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press("Control+Slash"); // opens settings; then go to Feather
    await page.getByText(t("Zrzur Feather"), { exact: true }).filter({ visible: true }).first().click({ timeout: 8000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: shot(`${tag}-feather`) });
    const text = await page.locator("body").innerText();
    const me = (await call("GET", "/billing/@me", undefined, A)).json;
    if (!me?.plus) return "no Feather on this account (nothing to show)";
    if (![t("Renews on {date}").split("{date}")[0].trim(), t("Ends")].some((word) => text.includes(word))) throw new Error(`no renewal date text: ${text.slice(0, 200)}`);
    return "renewal date shown";
  });

  await check("No page errors", async () => {
    if (errors.length) throw new Error(errors.join(" || "));
    return "none";
  });
} finally {
  await browser?.close();
  await deleteServer(S, acc.a, A);
  await closeSessions();
  finish();
}
