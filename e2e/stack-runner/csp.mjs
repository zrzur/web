// The page policy holds in a real browser: the built app, served by
// docker/server.js with its Content-Security-Policy, loads, signs in and
// opens a server channel with no policy violation, in en/ar/de on desktop
// and at 375 px. First it proves the listener works: an inline script the
// test adds is refused and reported.
//
//   node e2e/stack-runner/csp.mjs
//
// Env: E2E_DIST (a `vite build` made with the Docker placeholders, default
//   packages/client/dist), E2E_LIB (folder with stack.mjs; default
//   internal/test-env/e2e/lib/), E2E_API (default http://127.0.0.1:14702),
//   E2E_CHROMIUM, E2E_LOCALES=en,ar,de, E2E_SIZES=desktop,phone, E2E_PORT
//   (default: a free port). Signs in with the first dev account of
//   stack.mjs through the login page.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const web = fileURLToPath(new URL("../../", import.meta.url));
const here = fileURLToPath(import.meta.url)
  .split("\\")
  .join("/");
const internal = here.includes("/internal/")
  ? `${here.split("/internal/")[0]}/internal/`
  : undefined;
const API = process.env.E2E_API ?? "http://127.0.0.1:14702";

/** A port nobody listens on */
const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

const port = Number(process.env.E2E_PORT) || (await freePort());
const APP = `http://127.0.0.1:${port}`;
process.env.E2E_BASE = APP;

// the container's start: inject the addresses, then serve
const env = {
  ...process.env,
  VITE_HOST: `127.0.0.1:${port}`,
  VITE_API_URL: API,
  VITE_DEV_WS_URL: process.env.E2E_WS ?? "ws://127.0.0.1:14703",
  VITE_DEV_MEDIA_URL: process.env.E2E_MEDIA ?? "http://127.0.0.1:14704",
  VITE_DEV_PROXY_URL: process.env.E2E_PROXY ?? "http://127.0.0.1:14705",
  VITE_DEV_GIFBOX_URL: process.env.E2E_GIFBOX ?? "http://127.0.0.1:14706",
  VITE_INVITE_ORIGIN: "https://zrzur.cc",
  PORT: String(port),
  HOST: "127.0.0.1",
};
const outDir = join(mkdtempSync(join(tmpdir(), "zrzur-csp-")), "dist_injected");
const { inject } = require(join(web, "docker", "inject.js"));
inject({
  buildDir: process.env.E2E_DIST ?? join(web, "packages", "client", "dist"),
  outDir,
  env,
  log: () => {},
});

const server = spawn(
  process.execPath,
  [join(web, "docker", "server.js"), outDir],
  {
    env,
    stdio: ["ignore", "pipe", "inherit"],
  },
);
process.on("exit", () => server.kill());
await new Promise((resolve, reject) => {
  const timer = setTimeout(
    () => reject(new Error("server.js did not start")),
    20000,
  );
  let text = "";
  server.stdout.on("data", (chunk) => {
    text += chunk;
    process.stdout.write(chunk);
    // ready once it has tried the API root
    if (/Page policy:/.test(text)) {
      clearTimeout(timer);
      resolve();
    }
  });
  server.once("exit", (code) =>
    reject(new Error(`server.js exited (${code})`)),
  );
});

const libDir = process.env.E2E_LIB
  ? pathToFileURL(`${process.env.E2E_LIB.replace(/\/?$/, "/")}`)
  : pathToFileURL(`${internal}test-env/e2e/lib/`);
const { VIEWPORTS, LOCALES, accounts, pw, login } = await import(
  new URL("stack.mjs", libDir)
);
const { tr } = await import(new URL("catalog.mjs", libDir));

const locales = process.env.E2E_LOCALES?.split(",") ?? LOCALES;
const sizes = process.env.E2E_SIZES?.split(",") ?? Object.keys(VIEWPORTS);
const browser = await pw.chromium.launch({
  executablePath: process.env.E2E_CHROMIUM,
  headless: true,
  // a fake microphone for the voice step
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});

const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ok   ${name}`);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(
      `  FAIL ${name}: ${String(error?.message ?? error).split("\n")[0]}`,
    );
  }
}

/** Collect every policy violation of a page, from the start of each document */
async function watch(context) {
  await context.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__csp.push(
        `${event.violatedDirective} ${event.blockedURI} (${event.sourceFile}:${event.lineNumber})`,
      );
    });
  });
}
const violations = (page) => page.evaluate(() => window.__csp ?? []);

/** Console lines the browser writes for refused content, as a second source */
function consoleRefusals(page) {
  const lines = [];
  page.on("console", (message) => {
    const text = message.text();
    if (
      /Content Security Policy|Refused to (load|execute|connect|frame|apply|create)/i.test(
        text,
      )
    )
      lines.push(text);
  });
  return lines;
}

/** Click a server in the list; on phones, where the list is folded away, open its address */
async function openServer(page, server) {
  try {
    await server.click({ timeout: 5000 });
  } catch {
    await page.goto(`${APP}${await server.getAttribute("href")}`);
  }
  await page.waitForURL(/\/server\/[^/]+\/channel\//, { timeout: 30000 });
}

const expectNone = (found, where) => {
  if (found.length)
    throw new Error(
      `${found.length} violation(s) on ${where}: ${found.slice(0, 3).join(" | ")}`,
    );
};

console.log(`csp: app ${APP}, API ${API}`);

await step(
  "the app is served with a script policy without inline or eval",
  async () => {
    const response = await fetch(`${APP}/login`);
    const policy = response.headers.get("content-security-policy") ?? "";
    const script = /script-src ([^;]*)/.exec(policy)?.[1] ?? "";
    if (!script.includes("'self'"))
      throw new Error(`no script-src 'self': ${policy}`);
    if (/'unsafe-inline'|'unsafe-eval'|(^|\s)\*(\s|$)/.test(script))
      throw new Error(`script-src too wide: ${script}`);
    if (!/frame-ancestors 'none'/.test(policy))
      throw new Error("no frame-ancestors 'none'");
    if (!policy.includes(API)) throw new Error("connect-src lacks the API");
    if (response.headers.get("access-control-allow-origin"))
      throw new Error("CORS header still sent");
  },
);

await step(
  "the listener sees a refused inline script (the check can fail)",
  async () => {
    const context = await browser.newContext();
    await watch(context);
    const page = await context.newPage();
    await page.goto(`${APP}/login`);
    await page.evaluate(() => {
      const script = document.createElement("script");
      script.textContent = "window.__ran = true";
      document.head.appendChild(script);
    });
    await page.waitForTimeout(300);
    const ran = await page.evaluate(() => window.__ran === true);
    const found = await violations(page);
    await context.close();
    if (ran) throw new Error("the inline script ran");
    if (!found.some((v) => v.startsWith("script-src")))
      throw new Error("no violation reported");
  },
);

for (const size of sizes) {
  for (const locale of locales) {
    const viewport = VIEWPORTS[size];
    const label = `${locale} ${size}`;

    await step(`${label}: the login page loads with no violation`, async () => {
      const context = await browser.newContext({ viewport, locale });
      await watch(context);
      await context.addInitScript(
        (l) => localStorage.setItem("lang", l),
        locale,
      );
      const page = await context.newPage();
      const refused = consoleRefusals(page);
      await page.goto(`${APP}/login`);
      await page.locator('input[type="email"]').waitFor({ timeout: 30000 });
      await page.waitForLoadState("networkidle");
      expectNone([...(await violations(page)), ...refused], "the login page");
      await context.close();
    });

    await step(
      `${label}: signing in and opening a server channel has no violation`,
      async () => {
        const session = await login(browser, accounts[0], { viewport, locale });
        const { page, context } = session;
        await watch(context);
        await page.evaluate((l) => localStorage.setItem("lang", l), locale);
        const refused = consoleRefusals(page);
        await page.reload();
        await page.waitForLoadState("networkidle");
        // the first server in the list, as a person clicks it
        try {
          const server = page.locator('a[href^="/server/"]').first();
          await server.waitFor({ state: "attached", timeout: 30000 });
          await openServer(page, server);
          // the server may open on a voice channel: go through its channels
          // until one has a message box (on phones the list is folded away,
          // so by address there)
          const composer = page.locator('[contenteditable="true"]').last();
          const hrefs = await page.evaluate(() =>
            [...document.querySelectorAll('a[href*="/channel/"]')].map((a) =>
              a.getAttribute("href"),
            ),
          );
          for (const href of hrefs.slice(0, 8)) {
            if (await composer.isVisible()) break;
            await page.goto(`${APP}${href}`);
            await composer.waitFor({ timeout: 8000 }).catch(() => {});
          }
          await composer.waitFor({ timeout: 10000 });
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(1500);
        } catch (error) {
          if (internal)
            await page
              .screenshot({
                path: `${internal}screenshots/e2e/csp/${locale}-${size}-fail.png`,
              })
              .catch(() => {});
          throw error;
        }
        const found = [...(await violations(page)), ...refused];
        await context.close();
        expectNone(found, page.url());
      },
    );

    // voice: the events socket, the voice node (ws + http probe), the gate
    // worklet and the noise filter (its worklet and WebAssembly) all start
    if (size === "desktop")
      await step(
        `${label}: joining a voice call has no violation`,
        async () => {
          const session = await login(browser, accounts[0], {
            viewport,
            locale,
          });
          const { page, context } = session;
          await context.grantPermissions(["microphone", "camera"], {
            origin: APP,
          });
          await watch(context);
          await page.evaluate((l) => localStorage.setItem("lang", l), locale);
          const refused = consoleRefusals(page);
          await page.reload();
          const server = page.locator('a[href^="/server/"]').first();
          await server.waitFor({ timeout: 30000 });
          await server.click();
          await page.waitForURL(/\/server\/[^/]+\/channel\//, {
            timeout: 30000,
          });
          // a voice channel: the one whose page has the join button
          const join = page.getByRole("button", {
            name: tr(locale, "Join call"),
          });
          const channels = page.locator('a[href*="/channel/"]');
          for (let i = 0; i < Math.min(await channels.count(), 12); i++) {
            if (await join.isVisible()) break;
            await channels
              .nth(i)
              .click()
              .catch(() => {});
            await join.waitFor({ timeout: 3000 }).catch(() => {});
          }
          await join.click({ timeout: 10000 });
          // connected: the join button is gone
          await join.waitFor({ state: "hidden", timeout: 30000 });
          await page.waitForTimeout(4000);
          const found = [...(await violations(page)), ...refused];
          await context.close();
          expectNone(found, "a voice call");
        },
      );
  }
}

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(
  `csp: ${passed} passed, ${results.length - passed} failed, ${results.length} tests`,
);
server.kill();
process.exit(passed === results.length && results.length > 0 ? 0 : 1);
