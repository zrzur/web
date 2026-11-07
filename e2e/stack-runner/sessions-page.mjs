// The devices page in user settings, as a person uses it: the list, "This
// device", last used, closing one session, closing all others, and the
// failures, in en/ar/de on desktop and at 375 px.
//
//   node e2e/stack-runner/sessions-page.mjs
//
// Env: E2E_LIB (folder with stack.mjs and catalog.mjs), E2E_WEB (this web
//   checkout, for the catalogs), E2E_CHROMIUM (headless shell), E2E_BASE,
//   E2E_API, E2E_LOCALES, E2E_MAIL (test inbox, default port 14080).
//
// The account is this test's own, at a fixed address, so every action is real,
// "Log out all others" included, and no shared account is touched. The first
// run signs it up. Later runs get a new password through the reset mail in the
// test inbox, so no password is kept anywhere and one account does for all runs.
//
// An API without `last_seen` (before the rebuild) gets it added to its answer
// here, so the page can be checked; the output says when that happens.
//
// Every session this test opens is closed in `finally`, also when a step fails.
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

const lib = process.env.E2E_LIB;
if (!lib) {
  console.error("Set E2E_LIB to the folder with stack.mjs and catalog.mjs");
  process.exit(2);
}
const dir = pathToFileURL(`${lib.replace(/\/?$/, "/")}`);
const { API, APP, LOCALES, VIEWPORTS, pw, reporter, shots } = await import(
  new URL("stack.mjs", dir)
);
const { tr } = await import(new URL("catalog.mjs", dir));

const MAIL = process.env.E2E_MAIL ?? "http://127.0.0.1:14080";

async function post(path, body, sessionToken) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(sessionToken ? { "x-session-token": sessionToken } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  // never the body of a login: it holds a token
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return text ? JSON.parse(text) : undefined;
}

/** The first mail to this address since `since`, as text */
async function mailSince(email, since) {
  for (let i = 0; i < 20; i++) {
    const list = await fetch(`${MAIL}/email`)
      .then((r) => r.json())
      .catch(() => []);
    const mail = list
      .filter((m) => (m.to ?? []).some((t) => t.address === email))
      .find((m) => new Date(m.date).getTime() >= since);
    if (mail) return `${mail.text ?? ""} ${mail.html ?? ""}`;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`no mail for ${email}`);
}

/**
 * The test's account, ready to sign in. Signing up with an address that has an
 * account answers the same and sends a reset mail, so the mail says which case
 * this is. The password is new each run and stays in memory.
 */
async function testAccount() {
  const email = "sessions-e2e@zrzur.test";
  const password = `Zr-${randomBytes(12).toString("base64url")}!9`;
  const since = Date.now() - 2000;
  await post("/auth/account/create", {
    email,
    password,
    birth_month: "1990-01",
  });

  const mail = await mailSince(email, since);
  const reset = mail.match(/\/login\/reset\/([A-Za-z0-9_-]+)/);
  if (reset) {
    const res = await fetch(`${API}/auth/account/reset_password`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: reset[1],
        password,
        remove_sessions: true,
      }),
    });
    if (!res.ok) throw new Error(`reset_password: ${res.status}`);
    return { email, password };
  }

  const verify = mail.match(/\/login\/verify\/([A-Za-z0-9_-]+)/);
  if (!verify) throw new Error("the mail has no link");
  await post(`/auth/account/verify/${verify[1]}`);
  const login = await post("/auth/session/login", {
    email,
    password,
    friendly_name: "e2e setup",
  });
  await post("/onboard/complete", { username: "sessionse2e" }, login.token);
  await logoutToken(login.token);
  return { email, password };
}

const account = await testAccount();
const browser = await pw.chromium.launch({
  executablePath: process.env.E2E_CHROMIUM || undefined,
  headless: true,
});
const report = reporter("sessions-page");
const shot = shots("sessions-page");
const locales = process.env.E2E_LOCALES?.split(",") ?? LOCALES;

/** A second session of our own: "another device". Returns its name and token */
async function openOtherDevice(tag) {
  const name = `e2e other device ${tag} ${Date.now()}`;
  const res = await fetch(`${API}/auth/session/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: account.email,
      password: account.password,
      friendly_name: name,
    }),
  });
  const body = await res.json();
  if (!body.token) throw new Error(`login failed: ${body.type ?? res.status}`);
  return { name, token: body.token };
}

async function tokenWorks(sessionToken) {
  const res = await fetch(`${API}/auth/session/all`, {
    headers: { "x-session-token": sessionToken },
  });
  return res.ok;
}

/** Close a session we opened; one that is already gone is fine */
async function logoutToken(sessionToken) {
  if (!sessionToken) return;
  await fetch(`${API}/auth/session/logout`, {
    method: "POST",
    headers: { "x-session-token": sessionToken },
  }).catch(() => {});
}

/** Sign in through the login page, keeping the token so `finally` can close it */
async function signIn(viewport, locale) {
  const phone = viewport.width < 600;
  const context = await browser.newContext({
    viewport,
    locale,
    isMobile: phone,
    hasTouch: phone,
    // a service worker's requests would pass page.route
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const held = { token: undefined, muteLogout: false };

  // Between the server and the page, so one step can close this session
  // without the socket telling the app, and see the app find out from a 401
  await page.routeWebSocket(/.*/, (socket) => {
    const server = socket.connectToServer();
    socket.onMessage((message) => server.send(message));
    server.onMessage((message) => {
      if (held.muteLogout && String(message).includes('"Logout"')) return;
      socket.send(message);
    });
    server.onClose(() => {
      if (!held.muteLogout) socket.close();
    });
  });

  page.on("response", async (response) => {
    if (!response.url().endsWith("/auth/session/login")) return;
    const body = await response.json().catch(() => undefined);
    if (body?.token) held.token = body.token;
  });

  await page.goto(`${APP}/login`);
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
    timeout: 30000,
  });
  return { page, context, errors, held };
}

async function openSessions(page, t) {
  await page.goto(`${APP}/settings`, { waitUntil: "domcontentloaded" });
  await page
    .getByText(t("Sessions"), { exact: true })
    .locator("visible=true")
    .first()
    .click({ timeout: 30000 });
}

/** The row of a session */
const rowOf = (page, name) =>
  page.locator(":has(> summary)").filter({ hasText: name }).first();

/** Open a row and press its Log out */
async function pressLogOut(page, name, label) {
  const row = rowOf(page, name);
  await row.waitFor({ timeout: 20000 });
  await row.scrollIntoViewIfNeeded();
  const button = row.getByRole("button", { name: label, exact: true });
  if (!(await button.isVisible())) {
    await row.locator("summary [role=button]").first().click();
  }
  await button.click();
}

/** The open dialog with the given title */
const dialog = (page, title) =>
  page.getByRole("dialog").filter({ hasText: title });

async function confirmPassword(page, t) {
  const box = dialog(page, t("Confirm action"));
  await box.locator('input[type="password"]').fill(account.password);
  await box.getByRole("button", { name: t("Confirm"), exact: true }).click();
}

async function expectGone(locator) {
  await locator.waitFor({ state: "hidden", timeout: 15000 });
}

for (const locale of locales) {
  for (const [size, viewport] of Object.entries(VIEWPORTS)) {
    const at = `${locale} ${size}`;
    const phone = viewport.width < 600;
    const t = (text) => tr(locale, text);
    const logOut = () => t("Log out");

    let other;
    let signedIn;
    let second;
    const extra = [];
    let simulatedLastSeen = false;

    try {
      other = await openOtherDevice(`${locale}-${size}`);
      signedIn = await signIn(viewport, locale);
      const { page, errors } = signedIn;
      report.page = page;

      // a server that does not send last_seen yet: add it, and say so
      await page.route("**/auth/session/all", async (route) => {
        if (route.request().method() !== "GET") return route.fallback();
        const response = await route.fetch();
        const list = await response.json().catch(() => undefined);
        if (!Array.isArray(list) || list.every((entry) => entry.last_seen)) {
          return route.fulfill({ response });
        }
        simulatedLastSeen = true;
        await route.fulfill({
          response,
          json: list.map((entry) => ({
            ...entry,
            last_seen: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
          })),
        });
      });

      await report.step(
        `${at}: the list opens, this device is marked`,
        async () => {
          await openSessions(page, t);
          await page
            .getByText(t("This device"), { exact: true })
            .locator("visible=true")
            .first()
            .waitFor({ timeout: 20000 });
          await page.waitForTimeout(600); // the page slides in
          const dir = await page.evaluate(() => document.documentElement.dir);
          if (locale === "ar" && dir !== "rtl")
            throw new Error(`dir is ${dir}`);
          await page.screenshot({ path: shot(`list-${locale}-${size}`) });
        },
      );

      await report.step(
        `${at}: another device shows when it was last used`,
        async () => {
          const row = page
            .getByText(other.name)
            .locator("visible=true")
            .first();
          await row.waitFor({ timeout: 20000 });
          await row.scrollIntoViewIfNeeded();
          const text = t("Last used <0/>").replace("<0/>", "").trim();
          await page.getByText(text).locator("visible=true").first().waitFor();
        },
      );

      if (phone) {
        await report.step(
          `${at}: no sideways scroll, rows are 44 px`,
          async () => {
            const wide = await page.evaluate(
              () => document.documentElement.scrollWidth - window.innerWidth,
            );
            if (wide > 0) throw new Error(`${wide} px sideways`);
            const box = await rowOf(page, other.name)
              .locator("summary [role=button]")
              .first()
              .boundingBox();
            if (!box || box.height < 44)
              throw new Error(`row ${box?.height} px`);
          },
        );
      }

      await report.step(`${at}: Cancel keeps the session`, async () => {
        await pressLogOut(page, other.name, logOut());
        const box = dialog(page, other.name);
        await box.waitFor({ timeout: 10000 });
        await page.screenshot({ path: shot(`confirm-${locale}-${size}`) });
        if (phone) {
          const button = await box
            .getByRole("button", { name: logOut(), exact: true })
            .boundingBox();
          if (!button || button.height < 44) {
            throw new Error(`dialog button ${button?.height} px`);
          }
        }
        await box
          .getByRole("button", { name: t("Cancel"), exact: true })
          .click();
        await expectGone(box);
        if (!(await tokenWorks(other.token))) throw new Error("session closed");
      });

      await report.step(
        `${at}: a failure shows in plain words in the same dialog`,
        async () => {
          const failing = `**/auth/session/${"*"}`;
          const refuse = (route) =>
            route.request().method() === "DELETE"
              ? route.fulfill({
                  status: 500,
                  json: { type: "InternalError", location: "e2e" },
                })
              : route.fallback();
          await page.route(failing, refuse);
          await pressLogOut(page, other.name, logOut());
          const box = dialog(page, other.name);
          await box
            .getByRole("button", { name: logOut(), exact: true })
            .click();
          await confirmPassword(page, t);
          const alert = box.getByRole("alert");
          await alert.waitFor({ timeout: 15000 });
          const text = (await alert.innerText()).trim();
          if (!text || text === "InternalError")
            throw new Error(`alert says ${text}`);
          await page.screenshot({ path: shot(`error-${locale}-${size}`) });
          await box
            .getByRole("button", { name: t("Cancel"), exact: true })
            .click();
          await expectGone(box);
          await page.unroute(failing, refuse);
        },
      );

      await report.step(
        `${at}: Log out closes that session on the server`,
        async () => {
          await pressLogOut(page, other.name, logOut());
          const box = dialog(page, other.name);
          await box
            .getByRole("button", { name: logOut(), exact: true })
            .click();
          await page.evaluate(() => {
            window.e2eTitles = new Set();
            new MutationObserver(() => {
              for (const box of document.querySelectorAll("[role=dialog]")) {
                window.e2eTitles.add(box.innerText.split("\n")[0]);
              }
            }).observe(document.body, {
              subtree: true,
              childList: true,
              characterData: true,
            });
          });
          await confirmPassword(page, t);
          await expectGone(box);
          await expectGone(page.getByText(other.name).first());
          const nameless = t("Log out of <0>{name}</0>?")
            .replace("<0>{name}</0>", "")
            .replace(/\s+/g, " ");
          const titles = await page.evaluate(() => [...window.e2eTitles]);
          if (titles.some((title) => title.replace(/\s+/g, " ") === nameless)) {
            throw new Error("the title lost the name while closing");
          }
          if (await tokenWorks(other.token))
            throw new Error("token still works");
        },
      );

      await report.step(
        `${at}: a session closed elsewhere counts as closed`,
        async () => {
          const gone = await openOtherDevice(`${locale}-${size}-gone`);
          extra.push(gone);
          await openSessions(page, t);
          await pressLogOut(page, gone.name, logOut());
          const box = dialog(page, gone.name);
          await box.waitFor({ timeout: 10000 });

          // while the dialog is open, that device logs out by itself
          await logoutToken(gone.token);
          let status;
          page.on("response", (response) => {
            if (
              response.request().method() === "DELETE" &&
              response.url().includes("/auth/session/")
            ) {
              status = response.status();
            }
          });
          await box
            .getByRole("button", { name: logOut(), exact: true })
            .click();
          await confirmPassword(page, t);
          await expectGone(box);
          await expectGone(page.getByText(gone.name).first());
          if (status !== 404) throw new Error(`server answered ${status}`);
        },
      );

      await report.step(
        `${at}: Log out other sessions closes them on the server`,
        async () => {
          const devices = [
            await openOtherDevice(`${locale}-${size}-b`),
            await openOtherDevice(`${locale}-${size}-c`),
          ];
          extra.push(...devices);
          await openSessions(page, t);
          await page
            .getByText(t("Log out other sessions"))
            .locator("visible=true")
            .first()
            .click();
          const box = dialog(page, t("Log out of all other sessions?"));
          await box
            .getByRole("button", { name: logOut(), exact: true })
            .click();
          await confirmPassword(page, t);
          await expectGone(box);
          await page
            .getByText(t("No other device is signed in."))
            .locator("visible=true")
            .first()
            .waitFor({ timeout: 15000 });
          await page.screenshot({ path: shot(`empty-${locale}-${size}`) });
          for (const device of devices) {
            if (await tokenWorks(device.token)) {
              throw new Error("a token still works");
            }
          }
          if (!(await tokenWorks(signedIn.held.token))) {
            throw new Error("this device was logged out too");
          }
        },
      );

      await report.step(
        `${at}: a list that cannot load says so and can retry`,
        async () => {
          let refused = false;
          await page.route("**/auth/session/all", (route) => {
            if (refused || route.request().method() !== "GET") {
              return route.fallback();
            }
            refused = true;
            return route.fulfill({
              status: 500,
              json: { type: "InternalError", location: "e2e" },
            });
          });
          await page.goto(`${APP}/settings`, { waitUntil: "domcontentloaded" });
          await page
            .getByText(t("Sessions"), { exact: true })
            .locator("visible=true")
            .first()
            .click({ timeout: 30000 });
          await page.getByText(t("We could not load your sessions.")).waitFor({
            timeout: 15000,
          });
          await page
            .getByRole("button", { name: t("Try again"), exact: true })
            .click();
          await page
            .getByText(t("This device"), { exact: true })
            .locator("visible=true")
            .first()
            .waitFor({ timeout: 15000 });
        },
      );

      await report.step(
        `${at}: a failed log out of this device stays in the dialog`,
        async () => {
          const refuse = (route) =>
            route.fulfill({
              status: 500,
              json: { type: "InternalError", location: "e2e" },
            });
          await page.route("**/auth/session/logout", refuse);
          await pressLogOut(page, t("This device"), logOut());
          const box = dialog(page, t("Log out of this device?"));
          await box
            .getByRole("button", { name: logOut(), exact: true })
            .click();
          await box.getByRole("alert").waitFor({ timeout: 15000 });
          if (!(await tokenWorks(signedIn.held.token))) {
            throw new Error("the session closed although it failed");
          }
          await page.unroute("**/auth/session/logout", refuse);
        },
      );

      await report.step(
        `${at}: a session already gone still logs out, on a real 401`,
        async () => {
          const box = dialog(page, t("Log out of this device?"));
          // closed elsewhere while the dialog is open, and the socket is
          // silent about it, so the first the app hears is the 401
          signedIn.held.muteLogout = true;
          await logoutToken(signedIn.held.token);
          let status;
          page.on("response", (response) => {
            if (response.url().endsWith("/auth/session/logout")) {
              status ??= response.status();
            }
          });
          if (!(await box.isVisible())) throw new Error("the dialog went away");
          await box
            .getByRole("button", { name: logOut(), exact: true })
            .click();
          await page.locator('input[type="email"]').waitFor({ timeout: 20000 });
          if (status !== 401) throw new Error(`server answered ${status}`);
        },
      );

      await report.step(`${at}: Log out of this device signs out`, async () => {
        second = await signIn(viewport, locale);
        report.page = second.page;
        await openSessions(second.page, t);
        await pressLogOut(second.page, t("This device"), logOut());
        await dialog(second.page, t("Log out of this device?"))
          .getByRole("button", { name: logOut(), exact: true })
          .click();
        await second.page
          .locator('input[type="email"]')
          .waitFor({ timeout: 20000 });
        if (await tokenWorks(second.held.token)) {
          throw new Error("the token still works");
        }
      });

      await report.step(`${at}: no page errors`, async () => {
        if (errors.length) throw new Error(errors[0]);
      });

      if (simulatedLastSeen) {
        console.log(
          `  note ${at}: last_seen added by the test, the API on ${API} does not send it yet`,
        );
      }
    } finally {
      await logoutToken(other?.token);
      for (const entry of extra) await logoutToken(entry.token);
      await logoutToken(signedIn?.held.token);
      await logoutToken(second?.held.token);
      await signedIn?.context.close();
      await second?.context.close();
    }
  }
}

await browser.close();
process.exit(report.done() ? 1 : 0);
