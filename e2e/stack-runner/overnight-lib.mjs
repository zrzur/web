// Shared bits of the overnight suites (overnight-search.mjs,
// overnight-forward.mjs): the stack helpers, a sign-in that waits out the
// stack's 429 answers, a PNG made in memory, and a runner that does every
// test in en/ar/de at desktop size and at 375 px with one retry.
//
// Env: E2E_BASE (web preview), E2E_API, E2E_WEB (web checkout whose catalogs
//   are read), E2E_CHROMIUM, E2E_LANGS=en,ar,de, E2E_SIZES=desktop,phone,
//   E2E_LIB (folder with stack.mjs and catalog.mjs; default
//   internal/test-env/e2e/lib/).
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = fileURLToPath(import.meta.url).split("\\").join("/");
export const INTERNAL = here.includes("/internal/")
  ? `${here.split("/internal/")[0]}/internal/`
  : undefined;
const libDir = process.env.E2E_LIB
  ? pathToFileURL(`${process.env.E2E_LIB.replace(/\/?$/, "/")}`)
  : existsSync(new URL("./lib/stack.mjs", import.meta.url))
    ? new URL("./lib/", import.meta.url)
    : pathToFileURL(`${INTERNAL}test-env/e2e/lib/`);
const stack = await import(new URL("stack.mjs", libDir));
const { tr } = await import(new URL("catalog.mjs", libDir));

export const { API, APP, VIEWPORTS, LOCALES, accounts, pw, token } = stack;
export { tr };

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** An API call that waits and tries again when the stack answers 429 */
export async function api(...args) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await stack.api(...args);
    } catch (error) {
      const wait = /\b429\b.*"retry_after":(\d+)/s.exec(String(error?.message))?.[1];
      if (!wait || attempt >= 12) throw error;
      await sleep(Number(wait) + 1000);
    }
  }
}

/**
 * Sign in through the login page; a 429 answer from the API is tried again
 * after the time the stack names (it has no CORS headers, so the app would
 * show "Can't reach Zrzur" for a short pause).
 */
export async function login(browser, account, options) {
  const session = await stack.login(browser, account, options);
  await session.context.route(`${API}/**`, async (route) => {
    for (let attempt = 0; attempt < 12; attempt++) {
      let response;
      try {
        response = await route.fetch();
      } catch {
        return route.abort();
      }
      if (response.status() !== 429) return route.fulfill({ response });
      const wait = Number((await response.json().catch(() => ({})))?.retry_after ?? 2000);
      await sleep(wait + 500);
    }
    return route.abort();
  });
  await session.page.evaluate((l) => localStorage.setItem("lang", l), options.locale);
  return session;
}

/** The servers an account is in, from the event socket's Ready */
export async function readyServers(session) {
  const root = await (await fetch(`${API}/`)).json();
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${root.ws ?? "ws://127.0.0.1:14703"}/?version=1&format=json&token=${session}`);
    const timer = setTimeout(() => reject(new Error("Ready: timeout")), 20000);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type !== "Ready") return;
      clearTimeout(timer);
      ws.close();
      resolve(data.servers);
    };
    ws.onerror = () => reject(new Error("Ready: socket error"));
  });
}

/**
 * The suite's own server, by name. A new one is made when there is none;
 * when the account is at its server limit, a leftover of the box-padding
 * suite (which makes a new server on every run and never reads it again)
 * is renamed and used instead.
 */
export async function ownServer(session, name) {
  const me = await api(session, "GET", "/users/@me");
  const servers = await readyServers(session);
  const mine = servers.find((s) => s.owner === me._id && s.name === name);
  if (mine) return api(session, "GET", `/servers/${mine._id}`);
  try {
    return (await api(session, "POST", "/servers/create", { name, nonce: `${name}-${Date.now()}` })).server;
  } catch (error) {
    if (!String(error?.message).includes("TooManyServers")) throw error;
    const leftover = servers.find((s) => s.owner === me._id && s.name === "E2E box padding");
    if (!leftover) throw error;
    console.log(`[setup] at the server limit: using leftover "E2E box padding" ${leftover._id} as "${name}"`);
    await api(session, "PATCH", `/servers/${leftover._id}`, { name });
    return api(session, "GET", `/servers/${leftover._id}`);
  }
}

/** Upload a file to the media service and return its id */
export async function upload(session, name, type, buffer) {
  const root = await (await fetch(`${API}/`)).json();
  const form = new FormData();
  form.append("file", new Blob([buffer], { type }), name);
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(`${root.features.autumn.url}/attachments`, {
      method: "POST",
      headers: { "x-session-token": session },
      body: form,
    });
    if (res.status === 429) {
      await sleep(3000);
      continue;
    }
    const body = await res.json();
    if (!body.id) throw new Error(`upload ${res.status} ${JSON.stringify(body)}`);
    return body.id;
  }
  throw new Error("upload: rate limited");
}

/** A square PNG of one colour, made here (no files in the repo) */
export function png(size = 64, [r, g, b] = [224, 25, 95]) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body) >>> 0, body.length + 4);
    return out;
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(size).fill([r, g, b]).flat())]);
  const raw = Buffer.concat(Array(size).fill(row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", head),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Screenshots and notes of the overnight suites */
export const SHOTS = `${INTERNAL ?? "./"}screenshots/e2e/overnight/`;
mkdirSync(SHOTS, { recursive: true });

/** Western digits as Arabic-Indic digits */
export const arabicDigits = (text) => text.replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));

/** A day as YYYY-MM-DD in local time, `offset` days from today */
export function day(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Press and hold with a finger. The finger goes down through Chrome's touch
 * pipeline and stays; after the hold the page gets the `contextmenu` event
 * Chrome on Android sends for a long press, and the touch is cancelled, as
 * there. Desktop Chromium (headless or not) never makes that event from
 * touch input — checked with Input.synthesizeTapGesture and a held
 * touchStart: only pointerdown/touchstart/pointerup/click arrive — so that
 * one event is sent by the test.
 */
export async function longPress(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("long press: element has no box");
  // centre of the element (a message: on its text, not its author's name)
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await sleep(600);
  await page.evaluate(
    ([px, py]) => {
      const target = document.elementFromPoint(px, py);
      target?.dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, cancelable: true, composed: true, clientX: px, clientY: py, button: 2 }),
      );
    },
    [x, y],
  );
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await cdp.detach().catch(() => {});
  await sleep(400);
}

/**
 * Run `tests` ({ name, fn }) in every language × size with one signed-in
 * page each. `before(c)` runs ahead of every attempt (opens the start page).
 * Prints a line per test and a summary; returns the exit code.
 */
export async function runSuite(suite, tests, { account = accounts[0], before } = {}) {
  const only = process.argv.slice(2);
  const want = (name) => !only.length || only.some((part) => name.includes(part));
  const SIZES = (process.env.E2E_SIZES ?? "desktop,phone").split(",");
  const LANGS = process.env.E2E_LANGS ? process.env.E2E_LANGS.split(",") : LOCALES;
  const results = [];
  const browser = await pw.chromium.launch({ executablePath: process.env.E2E_CHROMIUM });
  for (const lang of LANGS) {
    for (const size of SIZES) {
      const phone = size === "phone";
      const { page, context, errors } = await login(browser, account, {
        viewport: VIEWPORTS[size],
        locale: lang,
      });
      const t = (english) => tr(lang, english);
      for (const entry of tests) {
        if (!want(entry.name)) continue;
        const label = `${entry.name} [${lang} ${size}]`;
        let lastError;
        let c;
        for (let attempt = 1; attempt <= 2; attempt++) {
          c = { page, t, lang, size, phone, browser, step: "" };
          try {
            if (attempt > 1) await sleep(8000);
            await before?.(c);
            const note = await entry.fn(c);
            results.push({ suite, lang, size, name: entry.name, ok: true, retried: attempt > 1, note });
            console.log(`  ok   ${label}${attempt > 1 ? " (retry)" : ""}${note ? ` (${note})` : ""}`);
            lastError = undefined;
            break;
          } catch (error) {
            lastError = error;
            console.log(`    attempt ${attempt} failed: ${String(error?.message ?? error).split("\n")[0].slice(0, 200)}${c.step ? ` @ ${c.step}` : ""}`);
            if (attempt === 2)
              await page
                .screenshot({ path: `${SHOTS}FAIL-${suite}-${entry.name.replace(/[^\w-]+/g, "_").slice(0, 60)}-${lang}-${size}.png` })
                .catch(() => {});
          }
        }
        if (lastError) {
          const message = String(lastError?.message ?? lastError).split("\n")[0].slice(0, 300) + (c.step ? ` @ ${c.step}` : "");
          results.push({ suite, lang, size, name: entry.name, ok: false, error: message });
          console.log(`  FAIL ${label}\n       ${message}`);
        }
      }
      if (errors.length) console.log(`  page errors [${lang} ${size}]: ${errors.slice(0, 3).join(" | ")}`);
      await context.close();
    }
  }
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log("\nper language × size:");
  for (const lang of LANGS)
    for (const size of SIZES) {
      const mine = results.filter((r) => r.lang === lang && r.size === size);
      if (mine.length)
        console.log(`  ${lang} ${size}: ${mine.filter((r) => r.ok).length} passed, ${mine.filter((r) => !r.ok).length} failed`);
    }
  writeFileSync(`${SHOTS}${suite}-results.json`, JSON.stringify(results, null, 2));
  console.log(`\n${suite}: ${results.length - failed} passed, ${failed} failed`);
  if (!results.length) {
    console.log(`${suite}: no tests ran — that is a failure`);
    return 1;
  }
  return failed ? 1 : 0;
}
