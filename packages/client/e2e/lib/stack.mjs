// Shared helpers for the e2e scripts in this folder. Nothing here knows a real
// host or a real account: the stack comes from the environment and the accounts
// from the file `e2e/ci-seed.mjs` writes.
//
//   E2E_APP             the web app (default http://localhost:31133)
//   E2E_API             the API (default http://127.0.0.1:14702)
//   E2E_WS              the events socket (default ws://127.0.0.1:14703)
//   MAILDEV_URL         the test mail catcher (default http://127.0.0.1:14080)
//   ZRZUR_DEV_ACCOUNTS  the JSON file with { accounts: [{ email, password }] }
//   E2E_CHROMIUM        a Chromium to use instead of Playwright's own
//   E2E_WEB             a checkout with node_modules and a built SDK, when this
//                       one has neither (default: this checkout)
//   E2E_OUT             where screenshots and results go
//                       (default packages/client/test-results/e2e)
//   LOCALE              ar, en or de (default en); PHONE=1 for 375 px, in the
//                       scripts that run one size per process
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { acknowledgePolicyNotice } from "./policy-notice.mjs";

const checkout = fileURLToPath(new URL("../../../../", import.meta.url));
export const WEB = process.env.E2E_WEB ?? checkout;

const pwMod = await import(
  pathToFileURL(
    createRequire(join(WEB, "packages/client/package.json")).resolve(
      "@playwright/test",
    ),
  ).href
);
export const pw = pwMod.chromium ? pwMod : pwMod.default;

export const APP = process.env.E2E_APP ?? "http://localhost:31133";
export const API = process.env.E2E_API ?? "http://127.0.0.1:14702";
export const WS = process.env.E2E_WS ?? "ws://127.0.0.1:14703";
export const MAIL = process.env.MAILDEV_URL ?? "http://127.0.0.1:14080";
const OUT =
  process.env.E2E_OUT ??
  fileURLToPath(new URL("../../test-results/e2e/", import.meta.url));

export const VIEWPORTS = {
  desktop: { width: 1366, height: 860 },
  phone: { width: 375, height: 812 },
};
export const LOCALES = ["ar", "en", "de"];
export const LOCALE = process.env.LOCALE || "en";
export const PHONE = !!process.env.PHONE;
export const viewport = () => (PHONE ? VIEWPORTS.phone : VIEWPORTS.desktop);

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** The first `count` accounts of the seed file; refuses to guess at others */
export function seededAccounts(count = 1) {
  const file = process.env.ZRZUR_DEV_ACCOUNTS;
  if (!file) throw new Error("ZRZUR_DEV_ACCOUNTS is not set; run e2e/ci-seed.mjs");
  const { accounts } = JSON.parse(readFileSync(file, "utf8"));
  if (accounts.length < count) {
    throw new Error(`need ${count} seeded accounts, the file has ${accounts.length}`);
  }
  return accounts.slice(0, count);
}

/** Folder for this suite's screenshots: name → path */
export function shots(suite) {
  const dir = join(OUT, suite);
  mkdirSync(dir, { recursive: true });
  return (name) => join(dir, `${name}.png`);
}

// Sessions go in this set when they open, and `closeSessions` ends them from a
// suite's `finally`. The exit handler is the net under that: a crash before the
// `try` must not leave a session open. It cannot await, so a short child does
// the work; tokens go by stdin, never by argument.
const openSessions = new Set();
process.on("exit", () => {
  if (!openSessions.size) return;
  const script = `const t=JSON.parse(require("fs").readFileSync(0,"utf8"));
    Promise.all(t.map((k)=>fetch(process.argv[1]+"/auth/session/logout",{method:"POST",headers:{"x-session-token":k}}).catch(()=>{})));`;
  spawnSync(process.execPath, ["-e", script, API], {
    input: JSON.stringify([...openSessions]),
    timeout: 5000,
  });
});

export const rememberSession = (session) => openSessions.add(session);

/** Ends every session this process opened */
export async function closeSessions() {
  const sessions = [...openSessions];
  openSessions.clear();
  await Promise.all(
    sessions.map((session) =>
      fetch(`${API}/auth/session/logout`, {
        method: "POST",
        headers: { "x-session-token": session },
      }).catch(() => {}),
    ),
  );
}

/** Any API call, waiting out rate limits; returns { status, json } */
export async function call(method, path, body, headers = {}) {
  for (let attempt = 0; ; attempt++) {
    await sleep(250);
    const response = await fetch(API + path, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 429 && attempt < 6) {
      const wait = Number(response.headers.get("x-ratelimit-reset-after"));
      await sleep(Math.min((wait || 8000) + 300, 15000));
      continue;
    }
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      // an empty or plain answer: the status says enough
    }
    return { status: response.status, json };
  }
}

/** A session token for an account */
export async function token(account) {
  const { status, json } = await call("POST", "/auth/session/login", {
    email: account.email,
    password: account.password,
    friendly_name: "e2e",
  });
  if (!json?.token) throw new Error(`login failed (${status})`);
  rememberSession(json.token);
  return json.token;
}

/** Headers for an account's calls */
export const session = async (account) => ({
  "x-session-token": await token(account),
});

/** Call the API as an account; throws on an error status */
export async function api(sessionToken, method, path, body) {
  const { status, json } = await call(method, path, body, {
    "x-session-token": sessionToken,
  });
  if (status >= 400) {
    throw new Error(`${method} ${path} ${status} ${JSON.stringify(json)}`);
  }
  return json;
}

/** Deleting a server needs a fresh password ticket */
export async function deleteServer(id, account, headers) {
  const ticket = await call(
    "PUT",
    "/auth/mfa/ticket",
    { password: account.password },
    headers,
  );
  const gone = await call("DELETE", `/servers/${id}`, undefined, {
    ...headers,
    "x-mfa-ticket": ticket.json?.token,
  });
  if (gone.status >= 300) console.log(`cleanup: server ${gone.status}`);
}

/** Keeps the session a page signs in with, so `closeSessions` can end it */
export function trackSessions(page) {
  page.on("response", (response) => {
    if (!response.url().endsWith("/auth/session/login") || !response.ok()) {
      return;
    }
    response
      .json()
      .then((body) => body.token && rememberSession(body.token))
      .catch(() => {});
  });
}

export const launch = (options = {}) =>
  pw.chromium.launch({
    executablePath: process.env.E2E_CHROMIUM || undefined,
    ...options,
  });

/** Fills the login page and waits for the app */
export async function signIn(page, account) {
  trackSessions(page);
  await page.goto(`${APP}/login/auth`);
  await page
    .locator('input[name="email"]')
    .fill(account.email, { timeout: 60000 });
  await page.locator('input[name="password"]').fill(account.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 60000,
  });
  await acknowledgePolicyNotice(page, { waitMs: 2500 });
}

/** Moves inside the app without a reload, as its own links do */
export async function goTo(page, path, settle = 4500) {
  await page.evaluate((target) => {
    history.pushState({}, "", target);
    dispatchEvent(new PopStateEvent("popstate"));
  }, path);
  await page.waitForTimeout(settle);
}

/**
 * A new browser context signed in as an account. The browser's language sets
 * the app's (the app follows the device language).
 */
export async function login(browser, account, { viewport: size, locale }) {
  const phone = size.width < 600;
  const context = await browser.newContext({
    viewport: size,
    locale,
    isMobile: phone,
    hasTouch: phone,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page, account);
  return { page, context, errors };
}

/** Steps with a screenshot of what went wrong; `done` returns the failures */
export function reporter(suite) {
  const results = [];
  const failShot = shots(suite);
  return {
    results,
    /** the page to screenshot when a step fails */
    page: undefined,
    async step(name, fn) {
      try {
        await fn();
        results.push({ name, ok: true });
        console.log(`  ok   ${name}`);
      } catch (error) {
        await this.page
          ?.screenshot({
            path: failShot(
              `FAIL-${name.replace(/[^\w-]+/g, "_").slice(0, 80)}`,
            ),
          })
          .catch(() => {});
        const message = String(error?.message ?? error);
        results.push({ name, ok: false, error: message.slice(0, 400) });
        console.log(`  FAIL ${name}\n       ${message.split("\n")[0]}`);
      }
    },
    done() {
      const failed = results.filter((r) => !r.ok).length;
      console.log(
        `\n${suite}: ${results.length - failed} passed, ${failed} failed`,
      );
      return failed;
    },
  };
}

/** Named checks that all run; `finish` saves them and sets the exit code */
export function checks(suite, tag = "") {
  const results = [];
  const record = (area, name, ok, detail = "") => {
    const text = String(detail);
    results.push({ area, name, ok: !!ok, detail: text.slice(0, 240) });
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${area}  ${name}${text ? `  (${text.slice(0, 160)})` : ""}`,
    );
  };
  return {
    results,
    record,
    async check(name, fn) {
      try {
        record(suite, name, true, (await fn()) ?? "");
      } catch (error) {
        record(suite, name, false, error?.message ?? error);
      }
    },
    finish(extra = {}) {
      const failed = results.filter((r) => !r.ok).length;
      console.log(`\n${results.length - failed}/${results.length} passed`);
      mkdirSync(OUT, { recursive: true });
      writeFileSync(
        join(OUT, `${suite}${tag ? `-${tag}` : ""}.json`),
        JSON.stringify(
          { at: new Date().toISOString(), results, ...extra },
          null,
          2,
        ),
      );
      process.exitCode = failed ? 1 : 0;
    },
  };
}

/** The bot part of the SDK under test (`pnpm --filter @zrzur/sdk build`) */
export const botSdk = () =>
  import(
    process.env.E2E_SDK ??
      pathToFileURL(join(WEB, "packages/stoat.js/lib/bot/index.js")).href
  );
