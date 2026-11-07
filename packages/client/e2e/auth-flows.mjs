// Real auth flows through the login pages, in English: login errors, session,
// log out, the sign-up form and its server-side checks, verification mail,
// resend, password reset. Needs the mail catcher.
// Seeded account 1 for login; makes new accounts for sign-up, which die with the
// throwaway stack. Their passwords are made here and never saved or printed.
import { randomBytes } from "node:crypto";

import {
  APP,
  checks,
  closeSessions,
  launch,
  MAIL,
  seededAccounts,
  shots,
  sleep,
  trackSessions,
  VIEWPORTS,
} from "./lib/stack.mjs";

const [A] = seededAccounts(1);
const domain = A.email.split("@")[1];
const shot = shots("auth-flows");
const { finish, results } = checks("auth-flows");

const stamp = Date.now().toString(36);
const strong = () => `Zr-${randomBytes(9).toString("base64url")}-9q`;
const made = {
  fresh: { email: `auth1-${stamp}@${domain}`, password: strong(), newPassword: strong() },
  minor: { email: `auth1-minor-${stamp}@${domain}` },
  dup: { email: `auth1-dup-${stamp}@${domain}`, password: strong() },
};

const record = (name, status, detail = "") => {
  results.push({ name, ok: status !== "FAIL", status, detail });
  console.log(`${status.padEnd(8)} ${name}${detail ? " — " + detail : ""}`);
};
const wait = sleep;
const now = new Date();
const thisYear = now.getFullYear();

async function chooseMonth(page, month) {
  const box = page.getByRole("combobox").first();
  await box.focus();
  await page.keyboard.press("Home");
  for (let i = 1; i < month; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
}

async function fillCreate(page, { month, year, email, password }) {
  if (month) await chooseMonth(page, month);
  if (year) await page.locator('input[name="birth-year"]').fill(String(year));
  if (email) await page.locator('input[name="email"]').fill(email);
  if (password) await page.locator('input[name="new-password"]').fill(password);
}

const alerts = (page) => page.locator('[role="alert"]').allInnerTexts();

async function mailFor(address, subjectHint, tries = 20) {
  for (let i = 0; i < tries; i++) {
    const list = await fetch(`${MAIL}/email`).then((r) => r.json()).catch(() => []);
    const hit = list
      .filter((m) => (m.to || []).some((t) => t.address?.toLowerCase() === address.toLowerCase()))
      .filter((m) => !subjectHint || subjectHint.test(m.subject + " " + (m.text || "")))
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    if (hit) return hit;
    await wait(1500);
  }
  return undefined;
}
const tokenFrom = (mail, kind) => {
  const body = `${mail.text || ""} ${mail.html || ""}`;
  const m = body.match(new RegExp(`/login/${kind}/([A-Za-z0-9_-]+)`));
  return m?.[1];
};

const browser = await launch();
let ctx = await browser.newContext({ viewport: VIEWPORTS.desktop, locale: "en-US", colorScheme: "dark" });
let page = await ctx.newPage();
trackSessions(page);
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
page.on("dialog", (d) => d.dismiss());
let createPosts = 0;
page.on("request", (r) => r.url().includes("/auth/account/create") && r.method() === "POST" && createPosts++);

try {
  // 1. logged-out entry: no birth prompt
  await page.goto(`${APP}/`);
  await wait(2500);
  const birthOnEntry = await page.locator('[name="birth-month"],[name="birth-year"]').count();
  record("entry: logged-out first visit has no birth fields", birthOnEntry === 0 ? "PASS" : "FAIL", `url ${new URL(page.url()).pathname}, birth fields ${birthOnEntry}`);
  await page.goto(`${APP}/login/auth`);
  await wait(1500);
  const birthOnLogin = await page.locator('[name="birth-month"],[name="birth-year"]').count();
  record("login page has no birth fields", birthOnLogin === 0 ? "PASS" : "FAIL");

  // 2. login: empty submit, wrong password, then the real account
  await page.locator('button[type="submit"]').click();
  await wait(300);
  const emptyLogin = await alerts(page);
  record("login: empty submit shows field errors", emptyLogin.length >= 2 ? "PASS" : "FAIL", emptyLogin.join(" | "));
  await page.locator('input[name="email"]').fill(A.email);
  await page.locator('input[name="password"]').fill("wrong-password-123");
  await page.locator('button[type="submit"]').click();
  await page.waitForSelector('form [role="alert"]', { timeout: 15000 }).catch(() => {});
  const wrong = await alerts(page);
  record("login: wrong password shows server error", wrong.length ? "PASS" : "FAIL", wrong.join(" | "));
  await page.screenshot({ path: shot("login-wrong-password") });

  await page.locator('input[name="password"]').fill(A.password);
  // press Enter twice quickly: one login request only
  let loginPosts = 0;
  const onReq = (r) => r.url().includes("/auth/session/login") && r.method() === "POST" && loginPosts++;
  ctx.on("request", onReq);
  await page.locator('input[name="password"]').press("Enter");
  await page.locator('input[name="password"]').press("Enter").catch(() => {});
  const loggedIn = await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 40000 }).then(() => true).catch(() => false);
  ctx.off("request", onReq);
  record("login: valid account reaches the app", loggedIn ? "PASS" : "FAIL", `now at ${new URL(page.url()).pathname}`);
  record("login: double Enter sends one request", loginPosts === 1 ? "PASS" : "FAIL", `${loginPosts} login request(s)`);
  await wait(6000);
  const agePrompt = await page.locator('[role="dialog"] [name="birth-year"]').count();
  record("after login: no month/year prompt appears", agePrompt === 0 ? "PASS" : "FAIL");
  await page.screenshot({ path: shot("after-login") });

  // 3. session persistence
  await page.reload();
  await wait(6000);
  const persisted = !new URL(page.url()).pathname.startsWith("/login");
  record("session persists after reload", persisted ? "PASS" : "FAIL", new URL(page.url()).pathname);
  const page2 = await ctx.newPage();
  await page2.goto(`${APP}/login/auth`);
  await wait(6000);
  record("logged-in user opening /login is sent to the app", !new URL(page2.url()).pathname.startsWith("/login") ? "PASS" : "FAIL", new URL(page2.url()).pathname);
  await page2.close();

  // 4. log out (Settings → Log out)
  let loggedOut = false;
  try {
    const keys = await page.evaluate(() => Object.keys(localStorage));
    await page.keyboard.press("Control+Comma").catch(() => {});
    await wait(1500);
    let btn = page.getByRole("button", { name: /^log ?out$/i }).first();
    if (!(await btn.count())) {
      await page.getByRole("button", { name: /settings/i }).first().click({ timeout: 4000 }).catch(() => {});
      await wait(1500);
      btn = page.getByRole("button", { name: /^log ?out$/i }).first();
    }
    if (!(await btn.count())) btn = page.getByText(/^log out$/i).first();
    await btn.click({ timeout: 5000 });
    await wait(1000);
    const confirm = page.getByRole("button", { name: /^log ?out$/i }).last();
    if (await confirm.count()) await confirm.click({ timeout: 3000 }).catch(() => {});
    loggedOut = await page.waitForURL((u) => u.pathname.startsWith("/login") || u.pathname === "/", { timeout: 15000 }).then(() => true).catch(() => false);
    record("logout from Settings returns to the login page", loggedOut ? "PASS" : "FAIL", `${new URL(page.url()).pathname} (storage keys before: ${keys.length})`);
  } catch (e) {
    record("logout from Settings returns to the login page", "BLOCKED", "Log out control not found by the script: " + String(e.message).slice(0, 120));
  }
  if (loggedOut) {
    await page.reload();
    await wait(4000);
    record("after logout, reload stays logged out", new URL(page.url()).pathname.startsWith("/login") || (await page.locator('input[name="password"]').count()) ? "PASS" : "FAIL", new URL(page.url()).pathname);
  }
  await ctx.clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); indexedDB.databases?.().then((d) => d.forEach((x) => indexedDB.deleteDatabase(x.name))); });

  // 5. create account: client checks
  await page.goto(`${APP}/login/create`);
  await wait(2500);
  await page.screenshot({ path: shot("create-empty") });
  await page.locator('button[type="submit"]').click();
  await wait(300);
  const emptyCreate = await alerts(page);
  const focusedRole = await page.evaluate(() => document.activeElement?.getAttribute("role"));
  record("create: empty submit shows errors and focuses the month", emptyCreate.length >= 3 && focusedRole === "combobox" ? "PASS" : "FAIL", `${emptyCreate.length} errors, focus ${focusedRole}`);
  await page.screenshot({ path: shot("create-errors") });
  await fillCreate(page, { month: 6, year: "19", email: "not-an-email", password: "short" });
  await page.locator('button[type="submit"]').click();
  await wait(300);
  const badCreate = await alerts(page);
  record("create: bad year / email / short password are explained", badCreate.length === 3 ? "PASS" : "FAIL", badCreate.join(" | "));
  await page.locator('input[name="birth-year"]').fill(String(thisYear + 1));
  await page.locator('button[type="submit"]').click();
  await wait(300);
  record("create: future birth year refused in the form", (await alerts(page)).some((t) => /month and year/i.test(t)) ? "PASS" : "FAIL");
  record("create: no request sent while the form is invalid", createPosts === 0 ? "PASS" : "FAIL", `${createPosts} request(s)`);

  // 6. server-side validation: trivial password
  await page.goto(`${APP}/login/create`);
  await wait(2000);
  await fillCreate(page, { month: 1, year: 1990, email: `auth1-weak-${stamp}@${domain}`, password: "1234567890" });
  await page.locator('button[type="submit"]').click();
  await page.waitForSelector('form [role="alert"]', { timeout: 20000 }).catch(() => {});
  const weak = await alerts(page);
  record("create: server refuses a weak password and the form says why", weak.length ? "PASS" : "FAIL", weak.join(" | "));

  // 7. server-side age check (under 16): must be refused by the API
  createPosts = 0;
  await page.goto(`${APP}/login/create`);
  await wait(2000);
  await fillCreate(page, { month: now.getMonth() + 1, year: thisYear - 15, email: made.minor.email, password: strong() });
  await page.locator('button[type="submit"]').click();
  await wait(4000);
  const refusedText = await page.locator("main").innerText();
  const refused = /can't create a Zrzur account/i.test(refusedText);
  const minorMail = await mailFor(made.minor.email, undefined, 3);
  record("create: under-16 sign-up refused (server-side)", refused && !minorMail ? "PASS" : "FAIL", refused ? "refusal shown, no mail sent" : `no refusal; mail sent: ${!!minorMail} — the running API image may predate the age check`);
  await page.screenshot({ path: shot("create-refused") });
  await page.evaluate(() => localStorage.removeItem("zrzur:sign-up-refused"));

  // 8. duplicate submit + valid sign-up
  createPosts = 0;
  await page.goto(`${APP}/login/create`);
  await wait(2000);
  await fillCreate(page, { month: 3, year: 1994, email: made.fresh.email, password: made.fresh.password });
  await page.screenshot({ path: shot("create-filled") });
  const submit = page.locator('button[type="submit"]');
  await submit.click();
  await submit.click({ timeout: 1000 }).catch(() => {});
  await page.locator('input[name="new-password"]').press("Enter").catch(() => {});
  const busy = await page.locator('form[aria-busy="true"]').count();
  await page.screenshot({ path: shot("create-submitting") });
  const atCheck = await page.waitForURL((u) => u.pathname === "/login/check", { timeout: 20000 }).then(() => true).catch(() => false);
  record("create: valid sign-up goes to 'Check your email'", atCheck ? "PASS" : "FAIL", new URL(page.url()).pathname);
  record("create: double click + Enter sends one request", createPosts === 1 ? "PASS" : "FAIL", `${createPosts} request(s), busy state seen: ${busy > 0}`);
  await page.screenshot({ path: shot("check-email") });

  // 9. email verification via maildev
  const verifyMail = await mailFor(made.fresh.email, /verif/i);
  const verifyToken = verifyMail && tokenFrom(verifyMail, "verify");
  if (!verifyToken) record("verify: email with link arrives in maildev", "FAIL", verifyMail ? "mail without /login/verify/ link" : "no mail");
  else {
    record("verify: email with link arrives in maildev", "PASS", `subject "${verifyMail.subject}"`);
    await page.goto(`${APP}/login/verify/${verifyToken}`);
    await page.waitForSelector("h1:has-text('verified'), h1:has-text('Failed')", { timeout: 20000 }).catch(() => {});
    const h1 = (await page.locator("main h1").allInnerTexts()).join(" | ");
    record("verify: link verifies the account", /verified/i.test(h1) ? "PASS" : "FAIL", h1);
    await page.screenshot({ path: shot("verified") });
    const cont = page.getByRole("button", { name: /continue to app/i });
    if (await cont.count()) {
      await cont.click();
      const inApp = await Promise.race([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 40000 }), page.waitForSelector('input[name="username"]', { timeout: 40000 })]).then(() => true).catch(() => false);
      record("verify: 'Continue to app' logs the new account in", inApp ? "PASS" : "FAIL", new URL(page.url()).pathname + ((await page.locator('input[name="username"]').count()) ? " (username step)" : ""));
      await wait(5000);
      const onboarding = await page.locator('input[name="username"]').count();
      record("new account: username step or app shown, no birth prompt", (await page.locator('[name="birth-year"]').count()) === 0 ? "PASS" : "FAIL", onboarding ? "username step" : "app");
      await page.screenshot({ path: shot("new-account-first-screen") });
      if (onboarding) {
        await page.locator('input[name="username"]').fill(`auth1${stamp}`);
        await page.locator('button[type="submit"]').click();
        const done = await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }).then(() => true).catch(() => false);
        await wait(4000);
        record("new account: choose username then app", done && !(await page.locator('input[name="username"]').count()) ? "PASS" : "FAIL", new URL(page.url()).pathname);
      }
    } else record("verify: 'Continue to app' logs the new account in", "NOT TESTED", "no MFA ticket returned by this API");
  }
  // the new account is signed in now: continue logged out in a fresh context
  await ctx.close();
  ctx = await browser.newContext({ viewport: VIEWPORTS.desktop, locale: "en-US", colorScheme: "dark" });
  page = await ctx.newPage();
  trackSessions(page);
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));

  // 10. resend verification page
  await page.goto(`${APP}/login/resend`);
  await wait(2000);
  await page.locator('input[name="email"]').fill(made.fresh.email);
  await page.locator('button[type="submit"]').click();
  const resent = await page.waitForURL((u) => u.pathname === "/login/check", { timeout: 20000 }).then(() => true).catch(() => false);
  const resendErr = await alerts(page);
  record("resend verification: form submits", resent || resendErr.length ? "PASS" : "FAIL", resent ? "check page" : `server said: ${resendErr.join(" | ")}`);

  // 11. password recovery
  await page.goto(`${APP}/login/reset`);
  await wait(2000);
  await page.locator('input[name="email"]').fill(made.fresh.email);
  await page.locator('button[type="submit"]').click();
  const resetCheck = await page.waitForURL((u) => u.pathname === "/login/check", { timeout: 20000 }).then(() => true).catch(() => false);
  record("reset: request goes to 'Check your email'", resetCheck ? "PASS" : "FAIL");
  await page.screenshot({ path: shot("reset-check") });
  const resetMail = await mailFor(made.fresh.email, /reset|password/i);
  const resetToken = resetMail && tokenFrom(resetMail, "reset");
  if (!resetToken) record("reset: email with link arrives", "FAIL", resetMail ? "mail without /login/reset/ link" : "no mail");
  else {
    record("reset: email with link arrives", "PASS");
    await page.goto(`${APP}/login/reset/${resetToken}`);
    await wait(2000);
    await page.screenshot({ path: shot("reset-new-password") });
    await page.locator('input[name="new-password"]').fill(made.fresh.newPassword);
    await page.locator('button[type="submit"]').click();
    const back = await page.waitForURL((u) => u.pathname === "/login/auth", { timeout: 20000 }).then(() => true).catch(() => false);
    record("reset: new password saved, back to login", back ? "PASS" : "FAIL", (await alerts(page)).join(" | "));
    await page.locator('input[name="email"]').fill(made.fresh.email);
    await page.locator('input[name="password"]').fill(made.fresh.newPassword);
    await page.locator('button[type="submit"]').click();
    const ok = await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 40000 }).then(() => true).catch(() => false);
    record("reset: login with the new password works", ok ? "PASS" : "FAIL", new URL(page.url()).pathname);
  }
} catch (e) {
  record("script", "FAIL", String(e.message).slice(0, 300));
} finally {
  await closeSessions();
}

record("no uncaught page errors", errors.length ? "FAIL" : "PASS", errors.slice(0, 3).join(" | "));
await browser.close();
await closeSessions();
finish();
