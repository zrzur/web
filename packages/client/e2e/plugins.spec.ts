import { type Browser, type Page, expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Plugin system end to end, against an ISOLATED local stack only:
 *
 *   ZPLUG_API   loopback API (e.g. http://127.0.0.1:24712)
 *   ZPLUG_DIR   folder written by e2e/plugins-setup.mjs (accounts, packages)
 *   PLAYWRIGHT_BASE_URL  Vite dev server pointed at that API
 *
 * The reviewer account must have `plugins.review` (set by the runner in
 * the isolated database). Hostile sandbox plugins run only as local
 * previews in this development build.
 */
const api = process.env.ZPLUG_API ?? "";
const dir = process.env.ZPLUG_DIR ?? "";
test.skip(!api || !dir, "set ZPLUG_API and ZPLUG_DIR");
test.skip(
  !!api && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(api),
  "loopback API only",
);
test.use({
  locale: "en-GB",
  colorScheme: "dark",
  viewport: { width: 1280, height: 860 },
});

/** Debug handle the plugin host puts on window (PluginHostRoot). */
type PluginDebug = {
  plugins: Record<
    string,
    {
      id: string;
      status: string;
      error?: string;
      manifest: { version: string };
      metrics: { activationMs: number };
    }
  >;
  host: {
    applyOverlays(): void;
    setSafeMode(on: boolean): Promise<void>;
    preview(manifest: unknown, code: unknown): Promise<void>;
    runCommand(id: string, command: string): Promise<void>;
    stopPreview(id: string): Promise<void>;
  };
  footprint(): { frames: number };
};
type DebugWindow = Window & { __zrzurPlugins: PluginDebug };

type Account = {
  email: string;
  password: string;
  token: string;
  user_id: string;
};
const data = () =>
  JSON.parse(readFileSync(join(dir, "accounts.json"), "utf8")) as {
    tag: string;
    id: string;
    accounts: Record<"dev" | "reviewer" | "user" | "other", Account>;
  };

async function call(
  method: string,
  path: string,
  token: string,
  body?: unknown,
) {
  const response = await fetch(api + path, {
    method,
    headers: { "Content-Type": "application/json", "x-session-token": token },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined };
}

async function signIn(browser: Browser, account: Account) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login/auth");
  const form = page.locator("form");
  await form.locator('input[name="email"]').fill(account.email);
  await form.locator('input[name="password"]').fill(account.password);
  await form.locator('button[type="submit"]').click();
  const settings = page.getByRole("button", { name: "User settings" });
  try {
    await settings.waitFor({ timeout: 20_000 });
  } catch {
    // all test browsers share one IP and session start-up can hit the
    // generic rate limit: wait it out once and reload
    await page.waitForTimeout(11_000);
    await page.reload();
  }
  try {
    await settings.waitFor({ timeout: 30_000 });
  } catch (error) {
    await page.screenshot({
      path: join(dir, `signin-fail-${account.email}.png`),
    });
    throw error;
  }
  return page;
}

async function openPlugins(page: Page) {
  await page.getByRole("button", { name: "User settings" }).click();
  await page
    .getByRole("link", { name: /Advanced$/ })
    .first()
    .click();
  await page.getByText("Install, turn on and manage reviewed plugins.").click();
  await expect(page.getByText("Run plugins")).toBeVisible();
}

async function tab(page: Page, name: string) {
  await page
    .getByRole("radiogroup", { name: "Plugin sections" })
    .getByText(name, { exact: true })
    .click();
}

const themeCss = (page: Page) =>
  page.evaluate(
    () => document.getElementById("zrzur-plugin-theme")?.textContent ?? "",
  );
const frames = (page: Page) =>
  page.evaluate(
    () =>
      document.querySelectorAll("iframe[data-zrzur-plugin-sandbox]").length,
  );

test.describe.configure({ mode: "serial" });

test("developer → review → install → use → disable → update → uninstall", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const { id, accounts } = data();

  // 1-3: a developer creates the plugin, validates and submits it in the UI
  const dev = await signIn(browser, accounts.dev);
  await openPlugins(dev);
  await tab(dev, "Developer");
  await dev.getByLabel("Plugin id (like yourname.my-plugin)").fill(id);
  await dev.getByLabel("Name", { exact: true }).fill("Midnight Test");
  await dev.getByRole("button", { name: "Create plugin" }).click();
  await expect(dev.getByText(id).first()).toBeVisible();
  await dev
    .locator('input[type="file"]')
    .setInputFiles(join(dir, "v1.zplugin.json"));
  await expect(dev.getByText(/^Valid · Low/)).toBeVisible();
  await dev.getByRole("button", { name: "Submit for review" }).click();
  await expect(dev.getByText(/^Submitted\./)).toBeVisible();
  await expect(dev.getByText("PendingReview")).toBeVisible();

  // not installable before review
  const before = await call(
    "GET",
    "/plugins?query=Midnight%20Test",
    accounts.user.token,
  );
  expect(before.body.plugins.some((p: { _id: string }) => p._id === id)).toBe(
    false,
  );

  // 4: a reviewer approves it in the UI
  const reviewer = await signIn(browser, accounts.reviewer);
  await openPlugins(reviewer);
  await tab(reviewer, "Review");
  const card = reviewer
    .locator("div", { hasText: `Midnight Test v1.0.0` })
    .last();
  await expect(card).toBeVisible();
  await reviewer
    .getByText("I checked who the publisher is: mark them verified")
    .click();
  await reviewer.getByRole("button", { name: "Approve" }).first().click();
  await expect(
    reviewer.getByText("Nothing is waiting for review."),
  ).toBeVisible();

  // 5-8: a user finds it, sees the permissions, consents, and it works
  const user = await signIn(browser, accounts.user);
  user.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await openPlugins(user);
  await tab(user, "Browse");
  await user.getByPlaceholder("Search plugins").fill("Midnight Test");
  await user.getByText("Midnight Test", { exact: true }).first().click();
  await expect(user.getByText("Permissions it asks for")).toBeVisible();
  await expect(user.getByText("Change colours")).toBeVisible();
  await expect(user.getByText("Verified publisher")).toBeVisible();
  await user.getByRole("button", { name: "Install", exact: true }).click();
  await user.getByRole("button", { name: "Allow and install" }).click();
  await expect(user.getByText("Running", { exact: true })).toBeVisible();
  await expect
    .poll(() => themeCss(user))
    .toContain("--md-sys-color-primary:#7aa2ff");
  const primary = await user.evaluate(() =>
    getComputedStyle(document.body)
      .getPropertyValue("--md-sys-color-primary")
      .trim(),
  );
  expect(primary).toBe("#7aa2ff");
  // declarative: no sandbox frame at all
  expect(await frames(user)).toBe(0);

  // settings change, then restart: setting and plugin come back
  await user
    .locator('input[type="color"]')
    .first()
    .evaluate((input: HTMLInputElement) => {
      input.value = "#ff8800";
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  await expect
    .poll(() => themeCss(user))
    .toContain("--md-sys-color-primary:#ff8800");
  await user.reload();
  await expect
    .poll(() => themeCss(user), { timeout: 20_000 })
    .toContain("#ff8800");

  // 9-10: disable and enable
  await openPlugins(user);
  await user.getByText("Midnight Test", { exact: true }).first().click();
  const enabled = user.getByRole("switch").first();
  await enabled.click();
  await expect(user.getByText("Disabled", { exact: true })).toBeVisible();
  await expect.poll(() => themeCss(user)).toBe("");
  await enabled.click();
  await expect(user.getByText("Running", { exact: true })).toBeVisible();
  await expect.poll(() => themeCss(user)).toContain("#ff8800");

  // Safe Mode stops it; turning it off brings it back
  await user.getByRole("button", { name: "Plugins", exact: true }).click();
  const run = user.getByRole("switch", { name: "Run plugins" });
  await run.click();
  await expect(run).not.toBeChecked();
  await expect.poll(() => themeCss(user)).toBe("");
  await user.screenshot({ path: join(dir, "safe-mode-on.png") });
  await run.click();
  await expect(run).toBeChecked();
  await user.screenshot({ path: join(dir, "safe-mode-off.png") });
  await expect.poll(() => themeCss(user)).toContain("#ff8800");

  // 11: an update that adds permissions needs new consent
  const pkg2 = JSON.parse(readFileSync(join(dir, "v2.zplugin.json"), "utf8"));
  const submitted = await call(
    "POST",
    `/plugins/${id}/releases`,
    accounts.dev.token,
    {
      ...pkg2,
      changelog: "Adds a shortcut",
    },
  );
  expect(submitted.status).toBe(200);
  const approved = await call(
    "POST",
    `/plugins/releases/${submitted.body._id}/approve`,
    accounts.reviewer.token,
    {},
  );
  expect(approved.status).toBe(200);
  await user.getByRole("button", { name: "Check for updates" }).click();
  await user.getByText("Midnight Test", { exact: true }).first().click();
  await expect(user.getByText("Update available").first()).toBeVisible();
  await expect(
    user.getByText("This version asks for new permissions:"),
  ).toBeVisible();
  await user.getByRole("button", { name: "Review and update" }).click();
  await user.getByRole("button", { name: "Allow and update" }).click();
  // wait until the host really runs the new release
  await expect
    .poll(() =>
      user.evaluate((pid) => {
        const p = (window as unknown as DebugWindow).__zrzurPlugins.plugins[
          pid
        ];
        return p ? `${p.manifest.version}:${p.status}` : "";
      }, id),
    )
    .toBe("1.1.0:running");
  // the new shortcut works: Alt+Shift+M toggles the theme
  await user.keyboard.press("Escape");
  await user.keyboard.press("Alt+Shift+M");
  await expect.poll(() => themeCss(user)).toBe("");
  await user.keyboard.press("Alt+Shift+M");
  await expect.poll(() => themeCss(user)).toContain("#ff8800");

  // 12-13: uninstall leaves nothing behind
  await openPlugins(user);
  await user.getByText("Midnight Test", { exact: true }).first().click();
  await user.getByRole("button", { name: "Uninstall", exact: true }).click();
  await user.getByRole("button", { name: "Yes, uninstall" }).click();
  await expect(user.getByText("No plugins yet")).toBeVisible();
  expect(await themeCss(user)).toBe("");
  expect(await frames(user)).toBe(0);
  await user.keyboard.press("Escape");
  await user.keyboard.press("Alt+Shift+M");
  await user.waitForTimeout(300);
  expect(await themeCss(user)).toBe("");
  const installs = await call(
    "GET",
    "/plugins/@me/installs",
    accounts.user.token,
  );
  expect(installs.body).toEqual([]);
  // settings and grant are gone too: a reinstall starts from defaults
  const reinstall = await call(
    "PUT",
    `/plugins/@me/installs/${id}`,
    accounts.user.token,
    {
      release_id: submitted.body._id,
      permissions: pkg2.manifest.permissions,
    },
  );
  expect(reinstall.body.settings).toEqual({});
  await call("DELETE", `/plugins/@me/installs/${id}`, accounts.user.token);
});

test("untrusted or unsupported plugins are refused", async () => {
  const { id, tag, accounts } = data();
  const pkg = JSON.parse(readFileSync(join(dir, "v1.zplugin.json"), "utf8"));
  const forbidden = await call(
    "POST",
    `/plugins/${id}/releases`,
    accounts.dev.token,
    {
      manifest: {
        ...pkg.manifest,
        version: "9.0.0",
        permissions: [...pkg.manifest.permissions, "auth.token"],
      },
    },
  );
  expect(forbidden.status).toBe(400);
  expect(forbidden.body.error).toContain("can never be granted");

  const unsupported = await call(
    "POST",
    `/plugins/${id}/releases`,
    accounts.dev.token,
    {
      manifest: {
        ...pkg.manifest,
        version: "9.0.0",
        permissions: [...pkg.manifest.permissions, "network.fetch"],
      },
    },
  );
  expect(unsupported.status).toBe(400);

  const probe = JSON.parse(
    readFileSync(join(dir, "probe.zplugin.json"), "utf8"),
  );
  await call("POST", "/plugins", accounts.dev.token, {
    id: probe.manifest.id,
    name: "Probe",
    category: "developer",
  });
  const code = await call(
    "POST",
    `/plugins/${probe.manifest.id}/releases`,
    accounts.dev.token,
    probe,
  );
  expect(code.status).toBe(400);
  expect(code.body.error).toContain("third-party plugin code is not enabled");

  // someone else can't publish into the developer's plugin
  const hijack = await call(
    "POST",
    `/plugins/${id}/releases`,
    accounts.other.token,
    {
      manifest: { ...pkg.manifest, version: "9.0.0" },
    },
  );
  expect(hijack.status).toBe(404);
  // nor take the official prefix
  const official = await call("POST", "/plugins", accounts.other.token, {
    id: `zrzur.fake${tag}`,
    name: "Fake",
    category: "appearance",
  });
  expect(official.status).toBe(400);
});

test("sandbox holds against hostile plugin code (dev preview)", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const { tag, accounts } = data();
  const page = await signIn(browser, accounts.dev);
  await openPlugins(page);
  await tab(page, "Developer");

  const preview = async (name: string) => {
    await page
      .locator('input[type="file"]')
      .setInputFiles(join(dir, `${name}.zplugin.json`));
    await page.getByRole("button", { name: "Preview here" }).click();
  };

  // probe: every escape attempt must be blocked
  await preview("probe");
  const key = `zrzur:plugin-storage:dev.z${tag}.probe`;
  await expect
    .poll(() => page.evaluate((k) => localStorage.getItem(k), key), {
      timeout: 15_000,
    })
    .toContain('"done":true');
  const results = JSON.parse(
    (await page.evaluate((k) => localStorage.getItem(k), key))!,
  ).results;
  console.log("sandbox probe:", JSON.stringify(results, null, 2));
  const allowed = Object.entries(results).filter(
    ([name, value]) => name !== "done" && String(value).startsWith("ALLOWED"),
  );
  expect(allowed).toEqual([]);

  // the app's own token never reached the sandbox: no network request
  // carried it from a plugin frame (the frame can't make requests at all)
  const frameOrigins = await page.evaluate(() =>
    [...document.querySelectorAll("iframe[data-zrzur-plugin-sandbox]")].map(
      (f) => {
        try {
          return (f as HTMLIFrameElement).contentDocument
            ? "same-origin"
            : "opaque";
        } catch {
          return "opaque";
        }
      },
    ),
  );
  expect(frameOrigins.every((o) => o === "opaque")).toBe(true);

  // an infinite loop is stopped and never freezes the page
  const status = (name: string) =>
    page.evaluate((pid) => {
      const p = (window as unknown as DebugWindow).__zrzurPlugins.plugins[
        pid
      ];
      return p ? `${p.status}:${p.error ?? ""}` : "";
    }, `dev.z${tag}.${name}`);
  await preview("loop");
  await expect
    .poll(() => status("loop"), { timeout: 10_000 })
    .toMatch(/^running/);
  // while the worker spins, the main thread keeps answering
  const lag: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    await page.evaluate(() => new Promise((r) => setTimeout(r, 100)));
    lag.push(Date.now() - t0);
  }
  console.log(
    "main-thread round trips during plugin loop (ms):",
    lag.join(", "),
  );
  expect(Math.max(...lag)).toBeLessThan(1000);
  await expect
    .poll(() => status("loop"), { timeout: 20_000 })
    .toMatch(/^(failed|quarantined):unresponsive/);

  // flooding and crashing plugins are stopped, the rest keeps running
  await preview("flood");
  await expect
    .poll(() => status("flood"), { timeout: 15_000 })
    .toMatch(/^(failed|quarantined):flood/);
  await preview("crash");
  await expect
    .poll(() => status("crash"), { timeout: 15_000 })
    .toMatch(/^(failed|quarantined):crash/);
  expect(await status("probe")).toMatch(/^running/);
  await tab(page, "Installed");
  await page.screenshot({ path: join(dir, "sandbox-states.png") });

  // and the chat UI still works
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "User settings" }),
  ).toBeVisible();
});

test("Arabic and right-to-left", async ({ browser }) => {
  const { accounts } = data();
  const page = await signIn(browser, accounts.other);
  await page.getByRole("button", { name: "User settings" }).click();
  await page
    .getByRole("link", { name: /Language$/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Change" }).click();
  await page.getByRole("searchbox").fill("العربية");
  await page.getByText("العربية", { exact: true }).last().click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dir))
    .toBe("rtl");
  await page
    .getByRole("link", { name: /متقدم$/ })
    .first()
    .click();
  await page.getByText("ثبّت الإضافات المراجَعة وشغّلها وأدرها.").click();
  await expect(page.getByText("تشغيل الإضافات")).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "تشغيل الإضافات" }),
  ).toBeChecked();
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(dir, "plugins-ar-rtl.png") });
  // the language is kept per browser context; later tests start in English
  const bodyDir = await page.evaluate(
    () => getComputedStyle(document.body).direction,
  );
  expect(bodyDir).toBe("rtl");
});

test("performance with four plugins and a sandboxed worker", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const { tag, accounts } = data();
  const { writeFileSync } = await import("node:fs");
  const names = [
    "midnight-theme",
    "focus-tools",
    "quiet-hours",
    "reading-comfort",
  ];
  for (const name of names) {
    const pkg = JSON.parse(
      readFileSync(join(dir, `perf-${name}.zplugin.json`), "utf8"),
    );
    await call("POST", "/plugins", accounts.dev.token, {
      id: pkg.manifest.id,
      name: pkg.manifest.name,
      category: pkg.manifest.category,
    });
    const release = await call(
      "POST",
      `/plugins/${pkg.manifest.id}/releases`,
      accounts.dev.token,
      pkg,
    );
    expect(release.status, JSON.stringify(release.body)).toBe(200);
    expect(
      (
        await call(
          "POST",
          `/plugins/releases/${release.body._id}/approve`,
          accounts.reviewer.token,
          {},
        )
      ).status,
    ).toBe(200);
    const installed = await call(
      "PUT",
      `/plugins/@me/installs/${pkg.manifest.id}`,
      accounts.other.token,
      {
        release_id: release.body._id,
        permissions: release.body.permissions,
      },
    );
    expect(installed.status).toBe(200);
  }

  const page = await signIn(browser, accounts.other);
  const bootStart = Date.now();
  await page.reload();
  await page.waitForFunction(
    (n) => {
      const p = (window as unknown as DebugWindow).__zrzurPlugins?.plugins;
      return (
        p && Object.values(p).filter((x) => x.status === "running").length >= n
      );
    },
    names.length,
    { timeout: 30_000 },
  );
  const bootToRunningMs = Date.now() - bootStart;

  const metrics = await page.evaluate(async () => {
    const z = (window as unknown as DebugWindow).__zrzurPlugins;
    const activation = Object.values(z.plugins).map((p) => [
      p.id,
      p.metrics.activationMs,
    ]);
    const keys = () => {
      const t = performance.now();
      for (let i = 0; i < 5000; i++)
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
      return performance.now() - t;
    };
    const withPlugins = keys();
    const t = performance.now();
    for (let i = 0; i < 100; i++) z.host.applyOverlays();
    const overlays100 = performance.now() - t;
    const heap =
      (performance as Performance & { memory?: { usedJSHeapSize: number } })
        .memory?.usedJSHeapSize ?? null;
    await z.host.setSafeMode(true);
    const safe = keys();
    await z.host.setSafeMode(false);
    return {
      activation,
      keydown5000WithPluginsMs: withPlugins,
      keydown5000SafeModeMs: safe,
      applyOverlays100Ms: overlays100,
      heapBytes: heap,
    };
  });

  // sandboxed worker: start time and one round trip
  const worker = JSON.parse(
    readFileSync(join(dir, "word-count.zplugin.json"), "utf8"),
  );
  const sandbox = await page.evaluate(async (pkg) => {
    const z = (window as unknown as DebugWindow).__zrzurPlugins;
    const start = performance.now();
    await z.host.preview(pkg.manifest, pkg.code);
    while (z.plugins[pkg.manifest.id]?.status !== "running") {
      if (performance.now() - start > 10_000)
        return { error: z.plugins[pkg.manifest.id]?.error };
      await new Promise((r) => setTimeout(r, 20));
    }
    const ready = performance.now() - start;
    const before = performance.now();
    await z.host.runCommand(pkg.manifest.id, "stats");
    const roundTrip = performance.now() - before;
    const frames = z.footprint().frames;
    await z.host.stopPreview(pkg.manifest.id);
    return {
      startToRunningMs: ready,
      activationMs: z.plugins[pkg.manifest.id]?.metrics.activationMs,
      commandRoundTripMs: roundTrip,
      framesWhileRunning: frames,
      framesAfterStop: z.footprint().frames,
    };
  }, worker);

  const result = { bootToRunningMs, ...metrics, sandbox };
  console.log("performance:", JSON.stringify(result, null, 2));
  writeFileSync(join(dir, "perf.json"), JSON.stringify(result, null, 2));
  expect(sandbox.framesAfterStop).toBe(0);
  expect(metrics.keydown5000WithPluginsMs).toBeLessThan(500);
  void tag;
});
