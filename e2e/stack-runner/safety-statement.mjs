// Report to decision, as people do it, on a stack that runs this branch.
// A visitor sends the form on the website to the real API and gets a receipt
// by mail. A reviewer opens the case in the dashboard, fills in the statement
// and applies a warning. The reporter gets the outcome by mail, and the person
// reads the whole statement under Settings > Feedback & reports. Also: what is
// typed for one case stays with that case, a refused action can be retried,
// the checks come before the confirmation, and every field is empty afterwards.
// Runs in en/ar/de on desktop and at 375 px.
//
//   node e2e/stack-runner/safety-statement.mjs
//
// Needs THIS branch's backend (the dev stack on 14702 runs beta), web build and
// website build, and maildev. Only the setup goes through the API (the author's
// server and message); the steps under test are clicks and typing.
//
// Env: E2E_LIB (folder with stack.mjs and catalog.mjs), E2E_WEB (this web
//   checkout, for the catalogs), E2E_CHROMIUM (headless shell), E2E_API,
//   E2E_BASE, E2E_SITE (website preview, default http://127.0.0.1:14826),
//   E2E_MAIL (maildev, default http://127.0.0.1:14080).
//   E2E_REVIEWER: index in the test accounts of an account that already has
//   the platform roles safety.review and safety.action. E2E_AUTHOR: index of
//   the account that gets the warning (default 1; must not be the reviewer).
//   Start the backend with ZRZUR_PUBLIC_REPORTS_PER_IP_HOUR=1000.
import { pathToFileURL } from "node:url";

const lib = process.env.E2E_LIB;
if (!lib) {
  console.error("Set E2E_LIB to the folder with stack.mjs and catalog.mjs");
  process.exit(2);
}
const dir = pathToFileURL(`${lib.replace(/\/?$/, "/")}`);
const { APP, LOCALES, VIEWPORTS, accounts, api, login, pw, reporter, token } =
  await import(new URL("stack.mjs", dir));
const { tr } = await import(new URL("catalog.mjs", dir));

const API = process.env.E2E_API ?? "http://127.0.0.1:14702";
const SITE = process.env.E2E_SITE ?? "http://127.0.0.1:14826";
const MAIL = process.env.E2E_MAIL ?? "http://127.0.0.1:14080";
const SITE_PREFIX = { en: "", de: "/de", ar: "/ar" };
const SEND_REPORT = { en: "Send report", de: "Meldung senden", ar: "إرسال البلاغ" };
const REVIEWER = accounts[Number(process.env.E2E_REVIEWER ?? 0)];
const AUTHOR = accounts[Number(process.env.E2E_AUTHOR ?? 1)];
if (!REVIEWER || !AUTHOR || REVIEWER === AUTHOR) {
  console.error("Need two different test accounts (E2E_REVIEWER, E2E_AUTHOR)");
  process.exit(2);
}

const run = reporter("safety-statement");
const browser = await pw.chromium.launch({
  executablePath: process.env.E2E_CHROMIUM || undefined,
});

/** A message to report; only this setup goes through the API */
async function postMessage(tag, account = AUTHOR) {
  const session = await token(account);
  const server = await api(session, "POST", "/servers/create", { name: `Stmt ${tag}` });
  const channel = server.channels[0]._id ?? server.channels[0];
  const message = await api(session, "POST", `/channels/${channel}/messages`, {
    content: `Stolen goods for sale ${tag}`,
  });
  return `${APP}/server/${server._id}/channel/${channel}/${message._id}`;
}

/** A visitor without an account fills in the website form */
async function reportOnWebsite({ locale, viewport, link, email }) {
  const context = await browser.newContext({ viewport, locale });
  const page = await context.newPage();
  run.page = page;
  // the local website always calls 127.0.0.1:14702; a branch API may listen elsewhere
  if (!API.endsWith(":14702")) {
    await page.route("http://127.0.0.1:14702/**", (route) =>
      route.continue({ url: route.request().url().replace("http://127.0.0.1:14702", API) }),
    );
  }
  await page.goto(`${SITE}${SITE_PREFIX[locale]}/report`);
  await page.locator("#report-location").fill(link);
  await page.locator("#report-description").fill("This message offers stolen goods for sale.");
  await page.locator("#report-law").fill("StGB 259");
  await page.locator("#report-name").fill("Visitor");
  await page.locator("#report-email").fill(email);
  await page.locator("#report-goodFaith").check();
  await page.getByRole("button", { name: SEND_REPORT[locale] }).click();
  const done = page.locator("[data-testid=report-done] strong");
  await done.waitFor({ timeout: 15000 });
  const reference = await done.innerText();
  await context.close();
  return reference;
}

/** The first `count` mails maildev holds for an address, within 15 s */
async function waitForMails(address, count) {
  for (let i = 0; i < 30; i++) {
    const inbox = await (await fetch(`${MAIL}/email`)).json();
    const mails = inbox.filter((m) => m.envelope?.to?.[0]?.address === address);
    if (mails.length >= count) return mails;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`fewer than ${count} mails to ${address}`);
}

async function openSettings(page, locale, entry) {
  await page
    .locator('[aria-label="User settings"], [aria-label="إعدادات المستخدم"], [aria-label="Benutzereinstellungen"]')
    .first()
    .click();
  await page.getByText(tr(locale, entry), { exact: true }).first().click();
}

async function openDashboard(account, locale, viewport) {
  const session = await login(browser, account, { viewport, locale });
  run.page = session.page;
  await openSettings(session.page, locale, "Feedback & reports");
  await session.page.getByText(tr(locale, "Open the review dashboard")).first().click();
  return session;
}

const fillStatement = async (page, locale, facts) => {
  await page.getByLabel(tr(locale, "Facts shown to the user")).fill(facts);
  await page.getByLabel(tr(locale, "Reason shown to the user")).fill("Stolen goods");
};
const apply = (page, locale) =>
  page.getByRole("button", { name: tr(locale, "Apply action") }).click();

// The review dashboard is one of the staff tools the app hides for now
// (STAFF_TOOLS_ENABLED in web components/common/lib/staffTools.ts, owner
// decision 2026-11-01): a reviewer finds no way to it in the app. While it is
// hidden, the steps that need it wait, and say so; they run again by
// themselves once the tools are back.
const waiting = [];
const wait = (step, why) => {
  waiting.push(step);
  console.log(`  WAIT ${step}
       ${why}`);
};
const HIDDEN = "the review dashboard is hidden in the app (staff tools off, owner decision 2026-11-01)";
let dashboard = false;
await run.step("a reviewer finds no review dashboard while staff tools are hidden", async () => {
  const { page, context } = await login(browser, REVIEWER, { viewport: VIEWPORTS.desktop, locale: "en" });
  run.page = page;
  await openSettings(page, "en", "Feedback & reports");
  await page.getByRole("tab", { name: "Reports & standing" }).first().waitFor({ timeout: 15000 });
  const entry = await page.getByText("Trust & Safety", { exact: true }).count();
  const button = await page.getByText("Open the review dashboard").count();
  dashboard = entry > 0 || button > 0;
  await context.close();
  if (dashboard) console.log("       the dashboard is offered: running the reviewer steps");
});

for (const locale of LOCALES) {
  for (const [size, viewport] of Object.entries(VIEWPORTS)) {
    const tag = `${locale}${size}${Date.now().toString(36)}`;
    const name = `${locale}/${size}`;
    const email = `visitor-${tag}@example.org`.toLowerCase();
    let reference;

    await run.step(`${name}: a visitor sends the form and gets a receipt`, async () => {
      reference = await reportOnWebsite({ locale, viewport, link: await postMessage(tag), email });
      if (!/^ZR-[A-Z0-9]{8}$/.test(reference)) throw new Error(reference);
      const [receipt] = await waitForMails(email, 1);
      if (!`${receipt.subject} ${receipt.text}`.includes(reference)) throw new Error("no reference in the receipt");
    });
    if (!reference) continue;

    if (!dashboard) wait(`${name}: the reviewer applies a statement; every field is empty after`, HIDDEN);
    else await run.step(`${name}: the reviewer applies a statement; every field is empty after`, async () => {
      const { page, context } = await openDashboard(REVIEWER, locale, viewport);
      const dialogs = [];
      page.on("dialog", (dialog) => {
        dialogs.push(dialog.message());
        void dialog.accept();
      });
      await page.getByText(reference).first().click();
      // the check comes first: no confirmation for a form that will be refused
      await page.getByLabel(tr(locale, "Reason shown to the user")).fill("Stolen goods");
      await apply(page, locale);
      await page.getByText(tr(locale, "Write the facts the user will see.")).waitFor();
      if (dialogs.length) throw new Error("confirmation before the facts check");

      await fillStatement(page, locale, "Offered stolen goods in a public channel");
      await page.getByRole("button", { name: tr(locale, "Illegal under a law") }).click();
      await page.getByLabel(tr(locale, "Law"), { exact: true }).fill("StGB");
      await page.getByLabel(tr(locale, "Provision")).fill("section 259");
      await page.getByLabel(tr(locale, "Automated tools found this content")).check();
      await apply(page, locale);
      await page.getByText(tr(locale, "Actions"), { exact: true }).first().waitFor({ timeout: 15000 });
      if (dialogs.length !== 1) throw new Error(`${dialogs.length} confirmations`);

      const facts = page.getByLabel(tr(locale, "Facts shown to the user"));
      if (await facts.inputValue()) throw new Error("facts kept");
      if (await page.getByLabel(tr(locale, "Automated tools found this content")).isChecked())
        throw new Error("automation box kept");
      if (await page.getByLabel(tr(locale, "Provision")).count()) throw new Error("law form kept");
      await context.close();
    });

    if (!dashboard) wait(`${name}: the reporter gets the outcome by mail`, HIDDEN);
    else await run.step(`${name}: the reporter gets the outcome by mail`, async () => {
      const mails = await waitForMails(email, 2);
      if (!mails.some((mail, i) => i > 0 && mail.subject.includes(reference)))
        throw new Error(mails.map((mail) => mail.subject).join(" | "));
    });

    if (!dashboard) wait(`${name}: the person sees the statement of reasons`, HIDDEN);
    else await run.step(`${name}: the person sees the statement of reasons`, async () => {
      const { page, context } = await login(browser, AUTHOR, { viewport, locale });
      run.page = page;
      await openSettings(page, locale, "Feedback & reports");
      await page.getByRole("tab", { name: tr(locale, "Reports & standing") }).first().click();
      const block = page.locator('[data-testid="decision-statement"]').first();
      await block.waitFor({ timeout: 15000 });
      const text = await block.innerText();
      for (const part of [
        "Offered stolen goods in a public channel",
        "StGB",
        "section 259",
        tr(locale, "Worldwide"),
        tr(locale, "Out-of-court settlement"),
        "Zrzur@proton.me",
      ]) {
        if (!text.includes(part)) throw new Error(`missing "${part}" in the statement`);
      }
      // found by a tool: yes; decided by a tool: no, in this order
      const flags = (await block.locator("dd", { hasText: tr(locale, "Used to find it:") }).innerText())
        .replace(/\s+/g, " ")
        .trim();
      const expected = `${tr(locale, "Used to find it:")} ${tr(locale, "yes")} · ${tr(locale, "Used to decide:")} ${tr(locale, "no")}`;
      if (flags !== expected) throw new Error(`flags: "${flags}", expected "${expected}"`);
      // the page does not run sideways on a phone
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (wide) throw new Error("sideways scroll");
      await context.close();
    });

    if (!dashboard) wait(`${name}: typed text stays with its case; a refused action can be retried`, HIDDEN);
    else await run.step(`${name}: typed text stays with its case; a refused action can be retried`, async () => {
      // two reports about the reviewer's own message: the server refuses to act
      // on it after it saved the copy, which moves the case version on
      const link = await postMessage(`${tag}r`, REVIEWER);
      const first = await reportOnWebsite({ locale, viewport, link, email: `a-${email}` });
      const second = await reportOnWebsite({ locale, viewport, link, email: `b-${email}` });
      const { page, context } = await openDashboard(REVIEWER, locale, viewport);
      page.on("dialog", (dialog) => void dialog.accept());
      await page.getByText(first).first().click();
      await fillStatement(page, locale, "Typed for the first case");
      await page.getByText(second).first().click();
      await page.getByText(second).nth(1).waitFor({ timeout: 15000 });
      if (await page.getByLabel(tr(locale, "Facts shown to the user")).inputValue())
        throw new Error("text from another case");

      await fillStatement(page, locale, "Typed for the second case");
      await apply(page, locale);
      await page.locator("[role=alert]").first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(1000);
      await apply(page, locale);
      await page.waitForTimeout(1500);
      const conflict = tr(locale, "Someone else changed this case. It has been reloaded.");
      if (await page.getByText(conflict).count()) throw new Error("the retry was refused as a conflict");
      await context.close();
    });
  }
}
await browser.close();
if (waiting.length) console.log(`
${waiting.length} waiting: ${HIDDEN}`);
process.exit(run.done() ? 1 : 0);
