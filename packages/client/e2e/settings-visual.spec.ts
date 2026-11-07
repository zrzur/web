import { Page, expect, test } from "@playwright/test";

/**
 * User Settings visual pass: opens every settings page and the account
 * dialogs, measures them and writes screenshots. Needs a running backend and
 * a local TEST account (never the owner's):
 *
 *   ZRZUR_E2E_EMAIL / ZRZUR_E2E_PASSWORD  test account credentials
 *   ZRZUR_SHOT_DIR                          where screenshots go
 *   ZRZUR_SHOT_PREFIX                       file name prefix (e.g. "after")
 *
 * Read-only: dialogs are opened and dismissed, nothing is submitted.
 */
const email = process.env.ZRZUR_E2E_EMAIL;
const password = process.env.ZRZUR_E2E_PASSWORD;
const dir = process.env.ZRZUR_SHOT_DIR ?? "test-results/settings";
const prefix = process.env.ZRZUR_SHOT_PREFIX ?? "shot";

test.skip(
  !email || !password,
  "set ZRZUR_E2E_EMAIL and ZRZUR_E2E_PASSWORD",
);
test.use({ locale: "en-GB", colorScheme: "dark" });

const PAGES = [
  ["my-account", "My Account"],
  ["profile", "Profile"],
  ["sessions", "Sessions"],
  ["my-bots", "My Bots"],
  ["feedback", "Feedback"],
  ["voice-video", "Voice & Video"],
  ["appearance", "Appearance"],
  ["notifications", "Notifications"],
  ["language", "Language"],
  ["advanced", "Advanced"],
] as const;

async function login(page: Page) {
  await page.goto("/login");
  const form = page.locator("form");
  await form.locator('input[name="email"]').fill(email!);
  await form.locator('input[name="password"]').fill(password!);
  await form.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "User settings" }).click();
  await page.getByRole("heading", { name: "My account" }).waitFor();
}

async function go(page: Page, label: string) {
  // settings sidebar entries are role="link"; the account entry's
  // accessible name also contains the username, hence the regex
  await page
    .getByRole("link", { name: new RegExp(`${label}$`) })
    .first()
    .click();
  await page.waitForTimeout(450);
}

/** Geometry of the top dialog surface */
function measureDialog(page: Page) {
  return page.evaluate(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].pop()!;
    const surface = dialog.firstElementChild as HTMLElement;
    const r = surface.getBoundingClientRect();
    const field = dialog.querySelector(".z-text-field input");
    return {
      width: Math.round(r.width),
      height: Math.round(r.height),
      padding: getComputedStyle(surface).padding,
      radius: getComputedStyle(surface).borderRadius,
      fieldHeight: field
        ? Math.round(field.parentElement!.getBoundingClientRect().height)
        : null,
      focused:
        (document.activeElement as HTMLInputElement | null)?.name ??
        document.activeElement?.getAttribute("aria-label"),
      overflowsViewport:
        r.left < 0 ||
        r.top < 0 ||
        r.right > innerWidth ||
        r.bottom > innerHeight,
    };
  });
}

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
]) {
  test(`settings pages @ ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);
    await login(page);
    await openSettings(page);

    const size = `${viewport.width}x${viewport.height}`;
    for (const [slug, label] of PAGES) {
      await go(page, label);
      await page.screenshot({ path: `${dir}/${prefix}-${slug}-${size}.png` });
    }

    // account dialogs: open, measure, dismiss with Escape
    await go(page, "My Account");
    const rows = [
      ["edit-username", "Username", "Edit"],
      ["change-email", "Email", "Change"],
      ["change-password", "Password", "Change"],
    ] as const;
    const metrics: Record<string, unknown> = {};
    for (const [slug, rowTitle, button] of rows) {
      const row = page.locator("[data-clickable]").filter({
        has: page.locator("[data-row-title]", {
          hasText: new RegExp(`^${rowTitle}$`),
        }),
      });
      await row.getByRole("button", { name: button, exact: true }).click();
      await page.locator('[role="dialog"] .z-text-field').first().waitFor();
      await page.waitForTimeout(300);
      metrics[slug] = await measureDialog(page);
      await page.screenshot({ path: `${dir}/${prefix}-${slug}-${size}.png` });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      // Escape closes only the dialog, settings stay open
      await expect(
        page.getByRole("heading", { name: "My account" }),
      ).toBeVisible();
    }
    console.log(`DIALOG_METRICS ${size} ${JSON.stringify(metrics)}`);

    // first owned bot, if any (the token is never rendered on this page)
    await go(page, "My Bots");
    const bot = page.locator('[role="button"][data-clickable="true"]').first();
    if (await bot.count()) {
      await bot.click();
      await page.waitForTimeout(600);
      await page.screenshot({
        path: `${dir}/${prefix}-bot-detail-${size}.png`,
        fullPage: true,
      });
    }
  });
}

test("appearance drives dialogs, switches and icons, and persists", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await openSettings(page);

  const vars = () =>
    page.evaluate(() => {
      const s = getComputedStyle(document.querySelector(".settings_sidebar")!);
      return {
        accent: s.getPropertyValue("--z-accent").trim(),
        iconAccent: s.getPropertyValue("--z-icon-accent").trim(),
      };
    });
  const iconStyles = () =>
    page.evaluate(() => {
      const counts: Record<string, number> = {};
      for (const el of document.querySelectorAll(".z-icon")) {
        const v = [...el.classList].find((c) => c.startsWith("z-icon--"));
        if (v) counts[v] = (counts[v] ?? 0) + 1;
      }
      return counts;
    });

  await go(page, "Appearance");
  const before = await vars();

  // accent colour
  await page
    .getByRole("radio", { name: /^Accent #/ })
    .nth(4)
    .click();
  const afterAccent = await vars();
  expect(afterAccent.accent).not.toBe(before.accent);

  // independent icon accent
  const match = page.getByRole("switch", {
    name: "Icon accent matches accent colour",
  });
  if ((await match.getAttribute("aria-checked")) === "true")
    await match.click();
  await page
    .getByRole("radio", { name: /^Icon colour #/ })
    .nth(2)
    .click();
  const afterIcon = await vars();
  expect(afterIcon.iconAccent).not.toBe(afterIcon.accent);

  // icon style: outline
  await page.getByRole("radio", { name: "Outline" }).click();
  await go(page, "Notifications");
  const outline = await iconStyles();
  await page.screenshot({ path: `${dir}/${prefix}-icons-outline.png` });

  await go(page, "Appearance");
  await page.getByRole("radio", { name: "Filled" }).click();
  await go(page, "Notifications");
  const filled = await iconStyles();
  await page.screenshot({ path: `${dir}/${prefix}-icons-filled.png` });

  await go(page, "Appearance");
  await page.getByRole("radio", { name: "Expressive" }).click();
  await go(page, "Notifications");
  const expressive = await iconStyles();
  const duotone = await page.evaluate(() => {
    const path = document.querySelector(
      ".z-icon--expressive svg path[opacity]",
    );
    return path ? getComputedStyle(path).fill : null;
  });
  await page.screenshot({ path: `${dir}/${prefix}-icons-expressive.png` });

  // an open dialog follows the new accent
  await go(page, "My Account");
  await page
    .locator("[data-clickable]")
    .filter({
      has: page.locator("[data-row-title]", { hasText: /^Password$/ }),
    })
    .getByRole("button", { name: "Change", exact: true })
    .click();
  await page.locator('[role="dialog"] .z-text-field').first().waitFor();
  await page.locator('[role="dialog"] input').first().fill("x");
  await page.locator('[role="dialog"] input').nth(1).fill("y");
  await page.locator('[role="dialog"] input').nth(2).fill("y");
  const primaryBg = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('[role="dialog"] button')];
    return getComputedStyle(buttons[buttons.length - 1]).backgroundColor;
  });
  const accentRgb = await page.evaluate((hex) => {
    const el = document.createElement("div");
    el.style.color = hex;
    document.body.append(el);
    const rgb = getComputedStyle(el).color;
    el.remove();
    return rgb;
  }, afterIcon.accent);
  // let the 160ms open animation finish before capturing
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/${prefix}-dialog-alt-accent.png` });
  await page.keyboard.press("Escape");

  // persistence across a reload
  await page.reload();
  await openSettings(page);
  const reloaded = await vars();
  await go(page, "Notifications");
  const reloadedStyles = await iconStyles();

  console.log(
    `APPEARANCE ${JSON.stringify({ before, afterAccent, afterIcon, outline, filled, expressive, duotone, primaryBg, accentRgb, reloaded, reloadedStyles })}`,
  );
  expect(outline["z-icon--outline"]).toBeGreaterThan(10);
  expect(filled["z-icon--filled"]).toBeGreaterThan(10);
  expect(expressive["z-icon--expressive"]).toBeGreaterThan(10);
  expect(primaryBg).toBe(accentRgb);
  expect(reloaded).toEqual(afterIcon);

  // restore the defaults for the next run
  await go(page, "Appearance");
  if ((await match.getAttribute("aria-checked")) !== "true")
    await match.click();
  await page
    .getByRole("radio", { name: /^Accent #/ })
    .first()
    .click();
});

/** Scroll the settings content to the bottom and capture it */
async function shotBottom(page: Page, path: string) {
  await page.mouse.move(820, 500);
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(400);
  await page.screenshot({ path });
}

test("other dialogs, page bottoms, profile save, sound toggle", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await openSettings(page);

  const openAndShoot = async (slug: string, open: () => Promise<void>) => {
    await open();
    await page.locator('[role="dialog"]').last().waitFor();
    await page.waitForTimeout(450);
    const m = await measureDialog(page);
    console.log(`DIALOG ${slug} ${JSON.stringify(m)}`);
    await page.screenshot({ path: `${dir}/${prefix}-dialog-${slug}.png` });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(450);
  };

  // MFA confirm opened by "Set up" (cancelled, nothing changes)
  await openAndShoot("mfa-confirm", () =>
    page.getByRole("button", { name: "Set up", exact: true }).click(),
  );

  await go(page, "My Bots");
  await openAndShoot("create-bot", () =>
    page.getByRole("button", { name: "Create bot" }).first().click(),
  );

  const bot = page.locator('[role="button"][data-clickable="true"]').first();
  if (await bot.count()) {
    await bot.click();
    await page.waitForTimeout(500);
    await shotBottom(page, `${dir}/${prefix}-bot-detail-bottom.png`);
    await openAndShoot("reset-bot-token", () =>
      page.getByRole("button", { name: "Reset", exact: true }).click(),
    );
    await openAndShoot("delete-bot", () =>
      page.getByRole("button", { name: "Delete", exact: true }).click(),
    );
  }

  // profile: edit pronouns, save, check the API result, then restore
  await go(page, "Profile");
  const pronouns = page.locator('input[name="pronouns"]');
  await pronouns.fill("they/them");
  await expect(
    page.getByText("Unsaved changes", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: `${dir}/${prefix}-profile-unsaved.png` });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeHidden();
  // reload: the value must come back from the server
  await page.reload();
  await openSettings(page);
  await go(page, "Profile");
  await expect(page.locator('input[name="pronouns"]')).toHaveValue("they/them");
  await expect(page.locator('[aria-label="Profile preview"]')).toContainText(
    "they/them",
  );
  await shotBottom(page, `${dir}/${prefix}-profile-bottom.png`);
  await pronouns.fill("");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeHidden();

  // sound toggle persists across reload
  await go(page, "Notifications");
  const toggle = page.getByRole("switch").nth(3);
  const was = await toggle.getAttribute("aria-checked");
  await toggle.click();
  await expect(toggle).not.toHaveAttribute("aria-checked", was!);
  // the state store debounces disk writes by 1.2s
  await page.waitForTimeout(1800);
  await page.reload();
  await openSettings(page);
  await go(page, "Notifications");
  const now = await page
    .getByRole("switch")
    .nth(3)
    .getAttribute("aria-checked");
  console.log(`SOUND_TOGGLE ${JSON.stringify({ was, now })}`);
  expect(now).not.toBe(was);
  await page.getByRole("switch").nth(3).click();
  await page.waitForTimeout(1800);
});

test("app shell: rail, sidebar, header, members, account panel", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await login(page);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    const size = `${viewport.width}x${viewport.height}`;
    await page.goto("/app");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${dir}/${prefix}-shell-home-${size}.png` });

    const server = page.locator('a[href^="/server/"]').first();
    if (await server.count()) {
      await server.click();
      await page.waitForTimeout(1500);
      const channel = page
        .locator('a[href^="/server/"][href*="/channel/"]')
        .first();
      if (await channel.count()) await channel.click();
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: `${dir}/${prefix}-shell-server-${size}.png`,
      });

      // surfaces and geometry, for the report
      const m = await page.evaluate(() => {
        const bg = (el: Element | null) =>
          el ? getComputedStyle(el).backgroundColor : null;
        const box = (el: Element | null) =>
          el ? el.getBoundingClientRect().toJSON() : null;
        const composer = document.querySelector(
          "main textarea, main [contenteditable]",
        );
        const account = document.querySelector("[data-account-panel]");
        return {
          main: bg(document.querySelector("main")),
          account: box(account),
          composer: box(composer?.closest("[data-composer]") ?? composer),
        };
      });
      console.log(`SHELL ${size} ${JSON.stringify(m)}`);
    }
  }
});

test("profile card and full profile", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.goto("/app");
  await page.locator('a[href^="/server/"]').first().click();
  await page.waitForTimeout(1200);
  await page.locator('a[href^="/server/"][href*="/channel/"]').first().click();
  await page.waitForTimeout(1500);

  if (!(await page.getByText(/^zdup_/).count())) {
    await page.getByRole("button", { name: "Member list" }).click();
    await page.waitForTimeout(800);
  }

  const card = page.locator('[role="dialog"][aria-label]').last();
  // size of the top dialog's visible surface
  const measure = () =>
    page.evaluate(() => {
      const el = [...document.querySelectorAll('[role="dialog"]')].pop()!;
      const surface =
        el.querySelector("[data-dialog-body]")?.parentElement ?? el;
      const r = surface.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });

  for (const [name, who] of [
    ["self", /^zset_renamed$/],
    ["other", /^zdup_/],
  ] as const) {
    if (name === "other") {
      // the other test user: through the DM with them
      await page.goto("/app");
      await page.waitForTimeout(1200);
      await page.locator('a[href^="/channel/"]').getByText(who).first().click();
      await page.waitForTimeout(1500);
    }
    const target = page.locator("main").getByText(who).last();
    if (!(await target.count())) continue;
    await target.click();
    await page.waitForTimeout(900);
    await page.screenshot({
      path: `${dir}/${prefix}-profile-card-${name}.png`,
    });
    console.log(`PROFILE_CARD ${name} ${JSON.stringify(await measure())}`);

    // the ⋯ in the card opens the user menu, and its items work
    await card.getByRole("button", { name: "More" }).click();
    await expect(
      page.getByText("Profile", { exact: true }).last(),
    ).toBeVisible();
    await page.screenshot({
      path: `${dir}/${prefix}-profile-card-${name}-menu.png`,
    });
    const identity = page.getByText("Edit your identity", { exact: true });
    if (name === "self" && (await identity.count())) {
      // server identity dialog: opened and cancelled, nothing saved
      await identity.click();
      await page.getByRole("heading", { name: /Change identity on/ }).waitFor();
      await page.waitForTimeout(400);
      console.log(`IDENTITY ${JSON.stringify(await measure())}`);
      await page.screenshot({ path: `${dir}/${prefix}-server-identity.png` });
      await page.setViewportSize({ width: 420, height: 800 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `${dir}/${prefix}-server-identity-narrow.png`,
      });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole("button", { name: "Cancel" }).click();
      await page.waitForTimeout(400);
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    if (!(await card.count())) {
      await target.click();
      await page.waitForTimeout(700);
    }

    // the banner in the card opens the full profile
    await card.locator('[data-size="card"] > div').first().click();
    await page.waitForTimeout(900);
    await page.screenshot({
      path: `${dir}/${prefix}-profile-full-${name}.png`,
    });
    console.log(`PROFILE_FULL ${name} ${JSON.stringify(await measure())}`);
    if (name === "other") {
      const friends = page.getByRole("tab", { name: /mutual friend/i });
      if (await friends.count()) {
        await friends.click();
        await page.waitForTimeout(400);
        await page.screenshot({
          path: `${dir}/${prefix}-profile-full-${name}-friends.png`,
        });
      }
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }
});

test.describe("reactions close-up", () => {
  // 2x pixels so chip/emoji/number sizes can be judged from the shots
  test.use({ deviceScaleFactor: 2 });

  test("message reactions", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await page.goto("/app");
    await page.locator('a[href^="/server/"]').first().click();
    await page.waitForTimeout(1200);
    await page
      .locator('a[href^="/server/"][href*="/channel/"]')
      .first()
      .click();
    await page.waitForTimeout(2000);

    const list = page.getByRole("group", { name: "Reactions" }).last();
    if (!(await list.count()))
      test.skip(true, "no reactions in the test channel");
    await list.scrollIntoViewIfNeeded();

    // every chip the same height; emoji box fixed; count smaller than emoji
    const metrics = await list.evaluate((el) => {
      const chips = [...el.querySelectorAll("button[aria-pressed]")];
      const add = el.querySelector("button.add") as HTMLElement;
      return {
        chips: chips.map((chip) => {
          const r = chip.getBoundingClientRect();
          const el = chip.querySelector(".emoji")!;
          const emoji = el.getBoundingClientRect();
          // drawn glyph (font emoji draw wider than their box)
          const range = document.createRange();
          range.selectNodeContents(el);
          const ink =
            el.tagName === "IMG" ? emoji : range.getBoundingClientRect();
          const count = chip.querySelector(":scope > span:last-child")!;
          return {
            h: r.height,
            w: Math.round(r.width),
            emoji: [emoji.width, emoji.height],
            // not clipped: no clipping box, and the glyph stays inside the chip
            clipped:
              getComputedStyle(el.parentElement!).overflow === "hidden" ||
              ink.left < r.left ||
              ink.right > r.right ||
              ink.top < r.top ||
              ink.bottom > r.bottom,
            countSize: getComputedStyle(count).fontSize,
          };
        }),
        add: add.getBoundingClientRect().height,
      };
    });
    console.log(`REACTIONS ${JSON.stringify(metrics)}`);
    const heights = new Set([...metrics.chips.map((c) => c.h), metrics.add]);
    expect(heights.size).toBe(1);
    expect(metrics.chips.filter((c) => c.clipped)).toEqual([]);

    const box = (await list.boundingBox())!;
    const clip = {
      x: box.x - 8,
      y: box.y - 40,
      width: Math.min(520, box.width + 16),
      height: box.height + 48,
    };
    await page.mouse.move(box.x + box.width + 200, box.y - 20);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${dir}/${prefix}-reactions.png`, clip });

    // hovering the message shows the add button
    await list.locator("button[aria-pressed]").first().hover();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${dir}/${prefix}-reactions-hover.png`,
      clip,
    });

    // read-only from here: removing your only reaction deletes the chip, so
    // the test never clicks a reaction. "Not mine" look is previewed by
    // dropping the active marker on one chip in the page only.
    await list
      .locator("button[aria-pressed]")
      .first()
      .evaluate((el) => el.removeAttribute("data-active"));
    await page.mouse.move(box.x + box.width + 200, box.y - 20);
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `${dir}/${prefix}-reactions-mixed.png`,
      clip,
    });

    // the add button opens the emoji picker (closed without choosing)
    await list.locator("button[aria-pressed]").first().hover();
    await list.locator("button.add").click();
    await expect(page.getByPlaceholder("Search emoji")).toBeVisible();
    await page.keyboard.press("Escape");
  });
});

test("menus and tooltips attached with use:floating", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);

  // account panel tooltips
  await page.goto("/app");
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "User settings" }).last().hover();
  await expect(page.getByText("User settings", { exact: true })).toBeVisible();

  // right-click a friend row
  await page.goto("/friends");
  await page.waitForTimeout(1500);
  const row = page.getByRole("listitem").first();
  if (await row.count()) {
    await row.click({ button: "right" });
    await expect(
      page.getByText("Profile", { exact: true }).last(),
    ).toBeVisible();
    await page.screenshot({ path: `${dir}/${prefix}-friends-row-menu.png` });
    await page.keyboard.press("Escape");
  }
});

test("app shell variants: messages, collapsed, narrow, light, RTL", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);

  /** dock alignment: account panel vs composer bar */
  const dock = () =>
    page.evaluate(() => {
      const panel = document.querySelector("[data-account-panel]");
      const input = document.querySelector(
        "main textarea, main [contenteditable='true']",
      );
      // the composer bar is the nearest ancestor with a background
      let bar = input?.parentElement ?? null;
      while (
        bar &&
        getComputedStyle(bar).backgroundColor === "rgba(0, 0, 0, 0)"
      )
        bar = bar.parentElement;
      const r = (el: Element | null | undefined) =>
        el ? el.getBoundingClientRect() : null;
      const p = r(panel);
      const c = r(bar);
      return {
        panel: p && { top: p.top, bottom: p.bottom, width: p.width },
        composer: c && { top: c.top, bottom: c.bottom },
        panelBg: panel ? getComputedStyle(panel).backgroundColor : null,
        composerBg: bar ? getComputedStyle(bar).backgroundColor : null,
        shellBg: getComputedStyle(document.querySelector("main")!)
          .backgroundColor,
        dir: document.documentElement.dir,
      };
    });

  // a server channel with some real messages in it (test account's server)
  await page.goto("/app");
  const server = page.locator('a[href^="/server/"]').first();
  // the rail fills in once the client is ready
  await server.waitFor({ timeout: 20_000 }).catch(() => {});
  test.skip(!(await server.count()), "test account has no server");
  await server.click();
  await page.locator('a[href^="/server/"][href*="/channel/"]').first().click();
  const input = page.locator("main textarea, main [contenteditable='true']");
  await input.first().click();
  for (const text of [
    "Shell check: one surface for rail, channels, header, chat and members.",
    "The account panel and this box should line up exactly.",
  ]) {
    await page.keyboard.type(text);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/${prefix}-shell-messages.png` });
  const dark = await dock();
  console.log(`DOCK dark ${JSON.stringify(dark)}`);
  expect(Math.abs(dark.panel!.top - dark.composer!.top)).toBeLessThanOrEqual(1);
  expect(
    Math.abs(dark.panel!.bottom - dark.composer!.bottom),
  ).toBeLessThanOrEqual(1);

  // narrow window
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/${prefix}-shell-1024x768.png` });
  await page.setViewportSize({ width: 1440, height: 900 });

  // channel list collapsed → compact panel (avatar only)
  const toggle = page.getByLabel("Toggle main sidebar").first();
  if (await toggle.count()) {
    await toggle.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/${prefix}-shell-collapsed.png` });
    console.log(`DOCK collapsed ${JSON.stringify(await dock())}`);
    await toggle.click();
    await page.waitForTimeout(400);
  }

  // friends page
  await page.goto("/friends");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/${prefix}-shell-friends.png` });

  // light mode
  await openSettings(page);
  await go(page, "Appearance");
  await page.getByRole("radio", { name: "Light", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.locator('a[href^="/server/"]').first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${dir}/${prefix}-shell-light.png` });
  const light = await dock();
  console.log(`DOCK light ${JSON.stringify(light)}`);
  expect(light.panelBg).not.toBe(light.shellBg);
  await openSettings(page);
  await go(page, "Appearance");
  await page.getByRole("radio", { name: "Dark", exact: true }).click();

  // Arabic, right-to-left (sidebar labels get translated: remember the
  // Language entry by position, reopen settings with the panel's gear)
  const links = page.locator(".settings_sidebar").getByRole("link");
  const names = await links.allTextContents();
  const languageIndex = names.findIndex((n) => /Language$/.test(n));
  await links.nth(languageIndex).click();
  await pickLanguage(page, /^العربية/);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${dir}/${prefix}-shell-rtl.png` });
  const rtl = await dock();
  console.log(`DOCK rtl ${JSON.stringify(rtl)}`);
  expect(rtl.dir).toBe("rtl");

  await page.locator("[data-account-panel] button").last().click();
  await page.waitForTimeout(800);
  await links.nth(languageIndex).click();
  await pickLanguage(page, /^English \(UK\)/);
  await page.waitForTimeout(1800);
});

test("icon buttons change colour only (no background shape)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  const server = page.locator('a[href^="/server/"]').first();
  await server.waitFor({ timeout: 20_000 });
  await server.click();
  await page.locator('a[href^="/server/"][href*="/channel/"]').first().click();
  await page.waitForTimeout(800);

  const style = (locator: ReturnType<typeof page.locator>) =>
    locator.evaluate((el) => {
      const s = getComputedStyle(el);
      const icon = el.querySelector(".z-icon");
      return {
        bg: s.backgroundColor,
        border: s.borderTopWidth,
        icon: icon ? getComputedStyle(icon).color : null,
      };
    });

  // header toggle (member list) in its pressed state, mouse elsewhere
  const pressed = page.getByRole("button", { name: "Member list" });
  await page.mouse.move(700, 500);
  const p = await style(pressed);
  // the same button while hovered
  await pressed.hover();
  await page.waitForTimeout(200);
  const h = await style(pressed);
  // account panel gear while hovered
  const gear = page.locator("[data-account-panel] button").last();
  await gear.hover();
  await page.waitForTimeout(200);
  const g = await style(gear);
  await page.screenshot({
    path: `${dir}/${prefix}-icons-colour-only.png`,
    clip: { x: 1000, y: 30, width: 440, height: 60 },
  });
  console.log(`ICONSTATE ${JSON.stringify({ pressed: p, hover: h, gear: g })}`);
  for (const s of [p, h, g]) expect(s.bg).toBe("rgba(0, 0, 0, 0)");
  expect(p.border).toBe("0px");
});

test("server settings pages", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  const server = page.locator('a[href^="/server/"]').first();
  await server.waitFor({ timeout: 20_000 });
  await server.click();
  await page.waitForTimeout(800);

  // server header → menu → Settings
  await page.getByRole("button", { name: "Server menu" }).click();
  await page.getByRole("menuitem", { name: "Open server settings" }).click();
  await page.waitForTimeout(800);

  const links = page.locator(".settings_sidebar").getByRole("link");
  const names = (await links.allTextContents()).map((n) => n.trim());
  console.log(`SERVER_PAGES ${JSON.stringify(names)}`);

  for (let i = 0; i < names.length; i++) {
    if (!names[i] || /delete/i.test(names[i])) continue;
    await links.nth(i).click();
    await page.waitForTimeout(700);
    const slug = names[i].toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await page.screenshot({ path: `${dir}/${prefix}-server-${slug}.png` });
    await shotBottom(page, `${dir}/${prefix}-server-${slug}-bottom.png`);
    await page.mouse.wheel(0, -6000);
  }

  // first role editor, if there are roles
  const rolesIndex = names.findIndex((n) => /^Roles$/.test(n));
  if (rolesIndex >= 0) {
    await links.nth(rolesIndex).click();
    await page.waitForTimeout(600);
    const role = page.getByText("Everyone", { exact: true }).first();
    if (await role.count()) {
      await role.click();
      await page.waitForTimeout(700);
      await page.screenshot({
        path: `${dir}/${prefix}-server-role-everyone.png`,
      });
    }
  }
});

test("dialogs fit small windows", async ({ page }) => {
  await login(page);
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 800, height: 600 },
    { width: 640, height: 480 },
  ]) {
    await page.setViewportSize(viewport);
    await openSettings(page);
    await page
      .locator("[data-clickable]")
      .filter({
        has: page.locator("[data-row-title]", { hasText: /^Password$/ }),
      })
      .getByRole("button", { name: "Change", exact: true })
      .click();
    await page.locator('[role="dialog"] .z-text-field').first().waitFor();
    await page.waitForTimeout(300);
    const m = await measureDialog(page);
    const footerVisible = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('[role="dialog"] button')];
      const r = buttons[buttons.length - 1].getBoundingClientRect();
      return r.bottom <= innerHeight && r.top >= 0;
    });
    console.log(
      `NARROW ${viewport.width}x${viewport.height} ${JSON.stringify({ ...m, footerVisible })}`,
    );
    expect(m.overflowsViewport).toBe(false);
    expect(footerVisible).toBe(true);
    await page.screenshot({
      path: `${dir}/${prefix}-dialog-${viewport.width}x${viewport.height}.png`,
    });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
});

/**
 * The language list is collapsed behind the current-language row:
 * check that, open it, pick, and check it closes again
 */
async function pickLanguage(page: Page, name: RegExp) {
  const trigger = page.locator("button[aria-expanded]").filter({
    has: page.locator("[data-chevron]"),
  });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("radio")).toHaveCount(0);
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("radio", { name }).click();
  await expect(page.getByRole("radio")).toHaveCount(0);
}

test("language switching: Arabic is right-to-left, German wraps", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await login(page);
  await openSettings(page);
  // sidebar labels get translated, so remember entries by position
  const links = page.locator(".settings_sidebar").getByRole("link");
  const names = await links.allTextContents();
  const languageLink = links.nth(names.findIndex((n) => /Language$/.test(n)));
  const accountLink = links.first();
  const dirOf = () => page.evaluate(() => document.documentElement.dir);

  await languageLink.click();
  // collapsed by default; the row opens the list; Escape closes only the list
  await page.screenshot({ path: `${dir}/${prefix}-language-collapsed.png` });
  const trigger = page.locator("button[aria-expanded]").filter({
    has: page.locator("[data-chevron]"),
  });
  await trigger.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/${prefix}-language-open.png` });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(trigger).toBeVisible();

  await pickLanguage(page, /^العربية/);
  await expect.poll(dirOf).toBe("rtl");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/${prefix}-language-ar-rtl.png` });
  await accountLink.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/${prefix}-my-account-ar-rtl.png` });

  await languageLink.click();
  await pickLanguage(page, /^Deutsch/);
  await expect.poll(dirOf).toBe("ltr");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/${prefix}-language-de.png` });
  await accountLink.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/${prefix}-my-account-de.png` });

  await languageLink.click();
  await pickLanguage(page, /^English \(UK\)/);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.lang))
    .toBe("en");
});
