// Screens beyond the first runner: More sheet (owner and plain member),
// connection bar, friends, direct message, member list, voice, settings list.
// Called by mobile-polish.mjs with the per-run helpers.
import { tr } from "./mobile-polish-env.mjs";

const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

export async function moreFlows(h) {
  const {
    step,
    page,
    ctx,
    browser,
    S,
    APP,
    width,
    height,
    locale,
    tag,
    shot,
    shotDir,
    SHOTS,
    noSideways,
    composer,
    chat,
    back,
  } = h;
  const T = (s) => tr(locale, s);
  const expectVisible = (loc, msg) =>
    loc
      .waitFor({ state: "visible", timeout: 15000 })
      .catch(() => expect(false, msg));
  const expectHidden = (loc, msg) =>
    loc
      .waitFor({ state: "hidden", timeout: 20000 })
      .catch(() => expect(false, msg));

  await step("More sheet: the owner sees channel settings", async () => {
    await chat();
    await page.getByRole("button", { name: T("More"), exact: true }).tap();
    const menu = page.getByRole("menu");
    await menu.waitFor();
    await menu.getByRole("menuitem", { name: T("Channel settings") }).waitFor();
    await menu.getByRole("menuitem", { name: T("Threads") }).waitFor();
    await page.keyboard.press("Escape");
  });

  if (width === 375) {
    await step(
      "More sheet: a member without permissions gets no channel settings",
      async () => {
        const bctx = await browser.newContext({
          viewport: { width, height },
          locale,
          isMobile: true,
          hasTouch: true,
          deviceScaleFactor: 2,
        });
        const bp = await bctx.newPage();
        try {
          await bp.goto(`${APP}/login`);
          await bp.locator('input[type="email"]').fill(S.b.email);
          await bp.locator('input[type="password"]').fill(S.b.password);
          await bp.locator('button[type="submit"]').tap();
          await bp.waitForURL((u) => !u.pathname.startsWith("/login"), {
            timeout: 60000,
          });
          await bp.goto(`${APP}/server/${S.serverId}/channel/${S.textId}`);
          await bp.locator(".cm-content").first().waitFor({ timeout: 30000 });
          await bp.getByRole("button", { name: T("More"), exact: true }).tap();
          const menu = bp.getByRole("menu");
          await menu.waitFor();
          await menu
            .getByRole("menuitem", { name: T("Pinned messages") })
            .waitFor();
          expect(
            (await menu
              .getByRole("menuitem", { name: T("Channel settings") })
              .count()) === 0,
            "a member sees Channel settings",
          );
          expect(
            (await menu
              .getByRole("menuitem", { name: T("Add friends to group") })
              .count()) === 0,
            "a member sees Add friends to group",
          );
          if (SHOTS)
            await bp.screenshot({ path: `${shotDir}${tag}-more-member.png` });
        } finally {
          await bctx.close();
        }
      },
    );
  }

  await step(
    "connection bar: offline, Reconnect now, back online",
    async () => {
      await chat();
      const bar = page.locator("[data-desktop-titlebar]");
      expect(
        (await bar.isVisible()) === false,
        "the connection bar shows while connected",
      );
      try {
        await ctx.setOffline(true);
        await expectVisible(
          bar,
          "the connection bar did not appear when offline",
        );
        const m = await bar.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const status =
            [...el.querySelectorAll("div")].find((d) => d.querySelector("a")) ??
            el;
          const link = el.querySelector("a")?.getBoundingClientRect();
          return {
            left: r.left,
            right: r.right,
            dir: getComputedStyle(el).direction,
            htmlDir: document.documentElement.dir,
            clipped: status.scrollWidth > status.clientWidth + 1,
            linkHeight: link?.height ?? 0,
            text: el.textContent,
          };
        });
        expect(
          m.left >= -1 && m.right <= width + 1,
          `the bar does not fit the screen (${m.left}..${m.right})`,
        );
        expect(
          m.dir === m.htmlDir,
          `bar direction ${m.dir} is not the page direction ${m.htmlDir}`,
        );
        expect(!m.clipped, "the bar text is cut off");
        expect(m.linkHeight >= 44, `Reconnect now is ${m.linkHeight} px tall`);
        expect(
          m.text.includes(T("Reconnect now")),
          `no "${T("Reconnect now")}" in the bar: ${m.text}`,
        );
        await shot("offline-bar");
      } finally {
        await ctx.setOffline(false);
      }
      await expectHidden(bar, "the connection bar stays after reconnecting");
    },
  );

  await step("friends: filters and search have their own rows", async () => {
    await page.goto(`${APP}/friends`);
    await page.getByRole("tablist").waitFor({ timeout: 30000 });
    const r = await page.evaluate(() => {
      const tl = document
        .querySelector('[role="tablist"]')
        .getBoundingClientRect();
      const header = document.querySelector("header")?.getBoundingClientRect();
      const tabs = [...document.querySelectorAll('[role="tab"]')].map(
        (t) => t.getBoundingClientRect().height,
      );
      return {
        tabsTop: tl.top,
        headerBottom: header?.bottom ?? 0,
        minTab: Math.min(...tabs),
      };
    });
    expect(
      r.tabsTop >= r.headerBottom - 1,
      `the filters share the header row (${r.tabsTop} < ${r.headerBottom})`,
    );
    expect(r.minTab >= 44, `a filter is ${r.minTab} px tall`);
    const search = page.getByRole("searchbox");
    await search.waitFor({ timeout: 10000 });
    const sb = await search.boundingBox();
    expect(
      sb.height >= 40 && sb.width > width / 2,
      `the search field is ${Math.round(sb.width)}x${Math.round(sb.height)}`,
    );
    await noSideways("friends");
    await page.getByRole("tab").nth(2).tap();
    expect(
      (await page.getByRole("tab").nth(2).getAttribute("aria-selected")) ===
        "true",
      "the Pending filter did not select",
    );
    await shot("friends");
  });

  await step("direct message: open and send", async () => {
    await page.goto(`${APP}/channel/${S.dmId}`);
    await composer().waitFor({ timeout: 30000 });
    const text = `DM test ${tag} ${Date.now()}`;
    await composer().tap();
    await composer().pressSequentially(text, { delay: 8 });
    await noSideways("direct message");
    await page.keyboard.press("Enter");
    await page.getByText(text, { exact: true }).waitFor({ timeout: 20000 });
    await shot("dm");
  });

  await step("member list opens as a panel", async () => {
    await chat();
    await page.getByRole("button", { name: T("Member list") }).tap();
    await page
      .getByText(S.meA.username, { exact: false })
      .last()
      .waitFor({ timeout: 15000 });
    await page.waitForTimeout(600);
    await noSideways("member list");
    await shot("members");
    await page
      .getByRole("button", { name: T("Member list") })
      .tap()
      .catch(() => {});
  });

  await step(
    "voice channel: Join call is reachable at the bottom",
    async () => {
      await page.goto(`${APP}/server/${S.serverId}/channel/${S.voiceId}`);
      const join = page.getByRole("button", { name: T("Join call") }).first();
      await join.waitFor({ timeout: 30000 });
      const b = await join.boundingBox();
      expect(b.height >= 44, `Join call is ${b.height} px tall`);
      expect(
        b.y + b.height <= height + 1 && b.y > height / 2,
        `Join call is not in the thumb zone (${Math.round(b.y)})`,
      );
      await noSideways("voice");
      await shot("voice");
    },
  );

  await step("user settings list", async () => {
    await chat();
    await back().tap();
    await page.waitForTimeout(600);
    await page.locator("[data-phone-tabs] button").nth(4).tap(); // You
    await page.getByLabel(T("Settings"), { exact: true }).first().tap();
    await page.waitForTimeout(800);
    await noSideways("settings");
    const small = await page.evaluate(() => {
      const rows = [
        ...document.querySelectorAll('[role="tab"], button, a[href]'),
      ].filter((e) => {
        const r = e.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.height > 0 &&
          r.top >= 0 &&
          r.bottom <= innerHeight &&
          e.textContent.trim().length > 2
        );
      });
      return rows
        .filter((e) => e.getBoundingClientRect().height < 44)
        .map((e) => e.textContent.trim().slice(0, 20));
    });
    expect(small.length === 0, `settings rows under 44 px: ${small}`);
    await shot("settings");
  });

  // the age prompt itself only shows for an account without a stated age (and
  // the dev stack cannot verify new accounts), so this checks the same age
  // controls where they live afterwards: Settings, My account
  await step("age setting in My account fits the phone", async () => {
    await page
      .getByText(T("My account"), { exact: true })
      .locator("visible=true")
      .first()
      .tap();
    const title = page.getByText(T("Month and year of birth"), { exact: true });
    await title.waitFor({ timeout: 15000 });
    await title.scrollIntoViewIfNeeded();
    const change = page
      .getByRole("button", { name: T("Change"), exact: true })
      .first();
    const b = await change.boundingBox();
    expect(b.height >= 44, `the age Change button is ${b.height} px tall`);
    await noSideways("age setting");
    await shot("age-setting");
    await change.tap();
    const dlg = page.getByRole("dialog").first();
    await dlg.waitFor({ timeout: 10000 });
    const d = await dlg.boundingBox();
    expect(
      d.width >= width - 2 && d.x >= -1,
      `the age dialog does not fit (${Math.round(d.x)}, ${Math.round(d.width)})`,
    );
    await noSideways("age dialog");
    await shot("age-dialog");
    await page.keyboard.press("Escape");
    await dlg.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
    // back to the settings list for the sign-out step
    await page
      .getByRole("button", { name: T("Back"), exact: true })
      .first()
      .tap()
      .catch(() => {});
  });
}
