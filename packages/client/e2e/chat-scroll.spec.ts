import { expect, Page, test } from "@playwright/test";

/**
 * Chat scroll reachability (regression for the "newest messages hidden under
 * the composer" defect). Needs a running backend and an existing test account:
 *
 *   ZRZUR_E2E_EMAIL / ZRZUR_E2E_PASSWORD  test account credentials
 *   ZRZUR_E2E_CHANNELS                      comma-separated /server/…/channel/… paths
 *
 * Read-only: it scrolls and measures, never sends or edits.
 */
const email = process.env.ZRZUR_E2E_EMAIL;
const password = process.env.ZRZUR_E2E_PASSWORD;
const channels = (process.env.ZRZUR_E2E_CHANNELS ?? "")
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean);

const viewports = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1024, height: 600 },
];

test.skip(
  !email || !password || !channels.length,
  "set ZRZUR_E2E_EMAIL, ZRZUR_E2E_PASSWORD and ZRZUR_E2E_CHANNELS",
);

async function login(page: Page) {
  await page.goto("/login");
  const form = page.locator("form");
  await form.locator('input[name="email"]').fill(email!);
  await form.locator('input[name="password"]').fill(password!);
  await form.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/**
 * Geometry of the message scroller, its newest message and the composer
 */
function measure(page: Page) {
  return page.evaluate(async () => {
    const main = document.querySelector("main")!;
    const scroller = [...main.children].find((el) =>
      /(auto|scroll)/.test(getComputedStyle(el).overflowY),
    ) as HTMLElement;
    const composer = main.lastElementChild!.getBoundingClientRect();

    // column-reverse list: scrollTop 0 is the newest end
    scroller.scrollTop = 0;
    await new Promise((resolve) => setTimeout(resolve, 300));

    const groups = [
      ...scroller.firstElementChild!.firstElementChild!.children,
    ].filter((el) => el.getBoundingClientRect().height > 27);
    const newest = groups.at(-1)!.getBoundingClientRect();
    const box = scroller.getBoundingClientRect();

    // and the oldest end must be reachable too. Read it in the same tick
    // (scroll-behavior is auto, so the jump is instant): in a channel with
    // more history, reaching the top loads older messages, which makes the
    // list taller within a few ms — waiting first measured that, not the bug.
    scroller.scrollTop = -scroller.scrollHeight;
    const oldestReached =
      Math.abs(scroller.scrollTop) + scroller.clientHeight >=
      scroller.scrollHeight - 2;
    await new Promise((resolve) => setTimeout(resolve, 300));
    scroller.scrollTop = 0;

    return {
      scrollerBottom: box.bottom,
      newestBottom: newest.bottom,
      composerTop: composer.top,
      composerBottom: composer.bottom,
      viewportHeight: window.innerHeight,
      oldestReached,
    };
  });
}

// one login for the whole matrix: repeated logins trip the auth rate limit
test("newest message is reachable above the composer at every viewport", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await login(page);

  for (const channel of channels) {
    await page.goto(channel);
    await page.locator("main .cm-editor").waitFor();

    for (const viewport of viewports) {
      const at = `${channel} @ ${viewport.width}x${viewport.height}`;
      await page.setViewportSize(viewport);
      await page.waitForTimeout(800);

      const m = await measure(page);
      expect(
        m.newestBottom,
        `${at}: newest message clipped`,
      ).toBeLessThanOrEqual(m.scrollerBottom + 1);
      expect(m.newestBottom, `${at}: under composer`).toBeLessThanOrEqual(
        m.composerTop + 1,
      );
      expect(
        m.composerBottom,
        `${at}: composer outside viewport`,
      ).toBeLessThanOrEqual(m.viewportHeight);
      expect(m.oldestReached, `${at}: oldest end unreachable`).toBe(true);
    }
  }
});
