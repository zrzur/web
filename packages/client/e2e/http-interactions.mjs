// The HTTP interactions dialog, as a bot owner uses it, in ar, en, de at desktop
// and 375 px. Makes its own account (the mail catcher confirms it) and bot;
// everything under test is clicks and typing. Two real endpoints run here, a
// careless one and one that uses the SDK, so the API must reach this machine.
//
// Env: E2E_ENDPOINT_HOST (the address the API reaches this machine on, default
// 127.0.0.1), E2E_LOCALES (ar,en,de). The stack must allow private addresses for
// the test endpoints.
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

import { tr } from "./lib/catalog.mjs";
import {
  API,
  APP,
  botSdk,
  closeSessions,
  launch,
  LOCALES,
  login,
  MAIL,
  rememberSession,
  reporter,
  shots,
  sleep,
  VIEWPORTS,
} from "./lib/stack.mjs";

const { createInteractionHandler } = await botSdk();

const HOST = process.env.E2E_ENDPOINT_HOST ?? "127.0.0.1";
const shot = shots("http-interactions");
const pong = '{"type":"Pong"}';

async function call(path, body, session, method = "POST") {
  const response = await fetch(API + path, {
    method,
    headers: {
      ...(session ? { "x-session-token": session } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} ${response.status} ${text}`);
  return text ? JSON.parse(text) : undefined;
}

/** A person with a confirmed address, and a bot */
async function setup() {
  const email = `e2e-${randomUUID().slice(0, 8)}@localhost`;
  const password = `Pw-${randomUUID()}`;
  await call("/auth/account/create", { email, password, birth_month: "1990-01" });
  let code;
  for (let i = 0; i < 40 && !code; i++) {
    const mails = await (await fetch(`${MAIL}/email`)).json();
    code = mails.reverse().find((m) => m.to?.some((t) => t.address === email))?.text?.match(/verify\/([A-Za-z0-9_-]+)/)?.[1];
    if (!code) await sleep(250);
  }
  await call(`/auth/account/verify/${code}`);
  const session = await call("/auth/session/login", { email, password, friendly_name: "e2e" });
  rememberSession(session.token);
  await call("/onboard/complete", { username: `e2e${randomUUID().slice(0, 6)}` }, session.token);
  const bot = await call("/bots/create", { name: `e2e${randomUUID().slice(0, 6)}` }, session.token);
  return { email, password, session: session.token, bot: bot._id };
}

function serve(handle) {
  return new Promise((resolve) => {
    const server = createServer(handle);
    server.listen(0, "0.0.0.0", () => resolve(server));
  });
}

/** Says yes to everything: Zrzur must refuse it */
const careless = await serve((_, response) => {
  response.setHeader("content-type", "application/json");
  response.end('{"type":"Pong"}');
});

/** Checks signatures with the secret the owner copied from the dialog */
let secret = "";
const honest = await serve((incoming, response) => {
  const chunks = [];
  incoming.on("data", (chunk) => chunks.push(chunk));
  incoming.on("end", async () => {
    const headers = new Headers();
    for (const name of ["x-zrzur-timestamp", "x-zrzur-signature", "x-zrzur-delivery"]) {
      if (incoming.headers[name]) headers.set(name, incoming.headers[name]);
    }
    const handle = createInteractionHandler({ secret }, () => {});
    const answer = await handle(
      new Request("http://bot/interactions", { method: "POST", headers, body: Buffer.concat(chunks) }),
    );
    response.statusCode = answer.status;
    response.setHeader("content-type", "application/json");
    response.end(await answer.text());
  });
});
const address = (server) => `http://${HOST}:${server.address().port}/interactions`;

const account = await setup();
const browser = await launch();
const report = reporter("http-interactions");
const locales = process.env.E2E_LOCALES?.split(",") ?? LOCALES;
const button = (scope, locale, english) =>
  scope.getByRole("button", { name: tr(locale, english), exact: true }).first();

try {
for (const locale of locales) {
  for (const [size, viewport] of Object.entries(VIEWPORTS)) {
    const label = `${locale} ${size}`;
    let page;
    let context;
    let errors = [];
    const dialog = () => page.getByRole("dialog").filter({ hasText: tr(locale, "HTTP interactions") }).last();
    const open = async () => {
      await page.goto(`${APP}/developers/${account.bot}`);
      const row = page.getByText(tr(locale, "HTTP interactions"), { exact: true }).first();
      await row.scrollIntoViewIfNeeded({ timeout: 30000 });
      await button(page, locale, "Set up").click();
      await dialog().waitFor();
      await page.waitForTimeout(600);
    };
    const field = () => dialog().locator("input").first();

    await report.step(`${label}: opens from the bot page`, async () => {
      ({ page, context, errors } = await login(browser, account, { viewport, locale }));
      report.page = page;
      await open();
      const dir = await page.evaluate(() => document.documentElement.dir);
      if ((locale === "ar") !== (dir === "rtl")) throw new Error(`dir is "${dir}"`);
      if ((await dialog().locator("select").count()) !== 0) throw new Error("native select");
      const inputDir = await field().getAttribute("dir");
      if (inputDir !== "ltr") throw new Error(`address field dir ${inputDir}`);
      await page.screenshot({ path: shot(`${locale}-${size}-open`) });
    });

    /** The owner confirms with their password */
    const confirmPassword = async () => {
      const password = page.locator('input[type="password"]');
      if (!(await password.isVisible().catch(() => false))) {
        await page.waitForTimeout(800);
        if (!(await password.isVisible())) {
          await page.getByText(tr(locale, "Password"), { exact: true }).first().click();
        }
      }
      await password.fill(account.password);
      await button(page, locale, "Confirm").click();
    };

    await report.step(`${label}: warns before replacing a secret, then makes one after the password`, async () => {
      if (await button(dialog(), locale, "New secret").count()) {
        await button(dialog(), locale, "New secret").click();
        const warning = tr(locale, "The current secret stops working at once. Your server fails every check until it has the new one.");
        await dialog().getByText(warning).waitFor({ timeout: 5000 });
        await page.screenshot({ path: shot(`${locale}-${size}-replace`) });
        await button(dialog(), locale, "Replace secret").click();
      } else {
        await button(dialog(), locale, "Make secret").click();
      }
      await confirmPassword();
      const code = dialog().getByTestId("interactions-secret");
      await code.waitFor({ timeout: 15000 });
      secret = (await code.textContent()).trim();
      if (!secret.startsWith("zrzur_sign_")) throw new Error(`secret: ${secret.slice(0, 12)}`);
      // a real button: reachable by keyboard and screen readers
      await button(dialog(), locale, "Copy secret").waitFor({ timeout: 5000 });
    });

    await report.step(`${label}: refuses a careless address in plain words, inside the dialog`, async () => {
      await page.waitForTimeout(3600); // 3 per 10 seconds on these routes
      await field().fill(address(careless));
      await button(dialog(), locale, "Test and save").click();
      await confirmPassword();
      const alert = dialog().getByRole("alert");
      await alert.waitFor({ timeout: 15000 });
      const expected = tr(locale, "Your server accepted a request with a wrong signature. Check signatures and answer 401.");
      if (!(await alert.textContent()).includes(expected)) throw new Error(await alert.textContent());
      await alert.getByText(tr(locale, "Details"), { exact: true }).click();
      await alert.getByText("accepts_bad_signatures").waitFor();
      await page.screenshot({ path: shot(`${locale}-${size}-refused`) });
    });

    await report.step(`${label}: saves an honest address, still there after reload`, async () => {
      await page.waitForTimeout(7000);
      await field().fill(address(honest));
      await button(dialog(), locale, "Test and save").click();
      await confirmPassword();
      await button(dialog(), locale, "Remove address").waitFor({ timeout: 15000 });
      const status = dialog().getByRole("status");
      await status.waitFor();
      const said = tr(locale, "Address saved. Interactions now go to your server.");
      if (!(await status.textContent()).includes(said)) throw new Error(await status.textContent());
      await page.screenshot({ path: shot(`${locale}-${size}-saved`) });
      await open();
      const value = await field().inputValue();
      if (value !== address(honest)) throw new Error(`after reload: ${value}`);
    });

    await report.step(`${label}: no sideways scroll, buttons fit`, async () => {
      const wide = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      if (wide) throw new Error("sideways scroll");
      const fits = await dialog().locator("button").evaluateAll((buttons, width) =>
        buttons.every((b) => {
          const box = b.getBoundingClientRect();
          return box.left >= -1 && box.right <= width + 1;
        }), viewport.width);
      if (!fits) throw new Error("a button leaves the screen");
      await page.screenshot({ path: shot(`${locale}-${size}-layout`) });
    });

    await report.step(`${label}: removes the address, gone after reload`, async () => {
      await page.waitForTimeout(3600);
      await button(dialog(), locale, "Remove address").click();
      await page.waitForFunction(
        (name) => ![...document.querySelectorAll('[role="dialog"] button')].some((b) => b.textContent.trim() === name),
        tr(locale, "Remove address"),
        { timeout: 15000 },
      );
      await open();
      const value = await field().inputValue();
      if (value !== "") throw new Error(`after reload: ${value}`);
    });

    await report.step(`${label}: the Pong message keeps its JSON in this language`, () => {
      const text = tr(locale, "Your server did not answer the test request with {pong}.");
      if (!text.includes("{pong}")) throw new Error(text);
      if (text.replace("{pong}", pong).includes("{{")) throw new Error(text);
    });

    await report.step(`${label}: no page errors`, async () => {
      if (errors.length) throw new Error(errors.join(" | ").slice(0, 300));
    });
    await context?.close();
    await sleep(3000);
  }
}

} finally {
  await browser.close();
  careless.close();
  honest.close();
  await closeSessions();
}
process.exitCode = report.done() ? 1 : 0;
