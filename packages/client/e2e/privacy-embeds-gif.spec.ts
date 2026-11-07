import { expect, Page, test } from "@playwright/test";

/**
 * P-03 / P-04: players from other sites wait for a click, and the GIF picker
 * talks only to our own GIF service.
 *
 * Needs a running dev stack with this web build (VITE_DEV_GIFBOX_URL set):
 *   PLAYWRIGHT_BASE_URL            web app address
 *   ZRZUR_E2E_EMAIL / ZRZUR_E2E_PASSWORD   test account
 *   ZRZUR_E2E_CHANNEL              /server/…/channel/… (or /channel/…) path to post in
 *   ZRZUR_E2E_GIF_HOST             host of the GIF service, e.g. 127.0.0.1:14706
 *   ZRZUR_E2E_GIF_CHANNEL          (optional) channel that already holds sent Klipy,
 *                                  Tenor and Giphy GIFs, for the reader-side check
 */
const email = process.env.ZRZUR_E2E_EMAIL;
const password = process.env.ZRZUR_E2E_PASSWORD;
const channel = process.env.ZRZUR_E2E_CHANNEL;
const gifHost = process.env.ZRZUR_E2E_GIF_HOST;
const gifChannel = process.env.ZRZUR_E2E_GIF_CHANNEL;

test.skip(
  !email || !password || !channel || !gifHost,
  "set ZRZUR_E2E_EMAIL, ZRZUR_E2E_PASSWORD, ZRZUR_E2E_CHANNEL, ZRZUR_E2E_GIF_HOST",
);

const outside =
  /(^|\.)(youtube(-nocookie)?\.com|ytimg\.com|googlevideo\.com|google\.com|googleapis\.com|gstatic\.com|klipy\.com|twitch\.tv|jtvnw\.net|spotify\.com|scdn\.co|soundcloud\.com|sndcdn\.com|bandcamp\.com|bcbits\.com|apple\.com|mzstatic\.com|streamable\.com|tenor\.com|giphy\.com)$/;

/** Links that make an embed whose player comes from another site */
const links = {
  YouTube: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  Spotify: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
  SoundCloud: "https://soundcloud.com/forss/flickermood",
  Bandcamp: "https://daniellanois.bandcamp.com/album/for-the-good-times",
  Twitch: "https://www.twitch.tv/videos/1",
  "Apple Music":
    "https://music.apple.com/us/album/1989-taylors-version/1708308989",
  Streamable: "https://streamable.com/moo",
};

const sizes = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 375, height: 700 },
];

async function login(page: Page) {
  await page.goto("/login");
  const form = page.locator("form");
  await form.locator('input[name="email"]').fill(email!);
  await form.locator('input[name="password"]').fill(password!);
  await form.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

for (const locale of ["en", "ar", "de"]) {
  for (const size of sizes) {
    test.describe(`${locale} ${size.name}`, () => {
      test.use({
        locale,
        viewport: { width: size.width, height: size.height },
      });

      for (const [provider, link] of Object.entries(links)) {
        test(`${provider} link: placeholder first, iframe only after the click`, async ({
          page,
        }) => {
          const hosts: string[] = [];
          page.on("request", (r) => hosts.push(new URL(r.url()).hostname));
          await login(page);
          await page.goto(channel!);
          const box = page.locator('textarea, [contenteditable="true"]').last();
          await box.click();
          await box.fill(`${link} ${Date.now()}`);
          await page.keyboard.press("Enter");

          const placeholder = page
            .locator('[data-testid="player-placeholder"]')
            .last();
          await expect(placeholder).toBeVisible({ timeout: 30_000 });
          await expect(page.locator("iframe")).toHaveCount(0);
          expect(hosts.filter((h) => outside.test(h))).toEqual([]);

          const load = placeholder.locator("button");
          const height = (await load.boundingBox())!.height;
          if (size.width <= 600) expect(height).toBeGreaterThanOrEqual(44);
          await load.click();
          await expect(page.locator("iframe").last()).toBeVisible();
        });
      }

      test("Settings: the always-load toggle skips the placeholder", async ({
        page,
      }) => {
        await login(page);
        await page.goto("/settings/account");
        const row = page.getByText(/always load media players/i).first();
        await row.scrollIntoViewIfNeeded();
        await row.click();
        await page.goto(channel!);
        const box = page.locator('textarea, [contenteditable="true"]').last();
        await box.click();
        await box.fill(`${links.YouTube} ${Date.now()}`);
        await page.keyboard.press("Enter");
        await expect(page.locator("iframe").last()).toBeVisible({
          timeout: 30_000,
        });
        await expect(
          page.locator('[data-testid="player-placeholder"]'),
        ).toHaveCount(0);
        // switch it off again so later tests start clean
        await page.goto("/settings/account");
        await page
          .getByText(/always load media players/i)
          .first()
          .click();
      });

      test("reader: sent GIFs make no request to Klipy, Tenor or Giphy", async ({
        page,
      }) => {
        test.skip(!gifChannel, "set ZRZUR_E2E_GIF_CHANNEL");
        const hosts: string[] = [];
        page.on("request", (r) => hosts.push(new URL(r.url()).hostname));
        await login(page);
        await page.goto(gifChannel!);
        await expect(page.locator("video, img").first()).toBeVisible({
          timeout: 30_000,
        });
        await page.waitForTimeout(2000);
        expect(hosts.filter((h) => outside.test(h))).toEqual([]);
      });

      test("GIF picker search talks only to our GIF service", async ({
        page,
      }) => {
        const seen: URL[] = [];
        page.on("request", (r) => seen.push(new URL(r.url())));
        await login(page);
        await page.goto(channel!);
        await page.getByRole("button", { name: /gif/i }).first().click();
        const search = page.locator('input[type="search"]');
        await search.fill("cat");
        await page.waitForTimeout(1500);
        const klipy = seen.filter((u) => /klipy/.test(u.hostname));
        expect(klipy).toEqual([]);
        const gifCalls = seen.filter((u) => u.pathname.startsWith("/klipy/"));
        expect(gifCalls.length).toBeGreaterThan(0);
        for (const u of gifCalls) expect(u.host).toBe(gifHost);
        for (const u of seen)
          expect(u.searchParams.has("customer_id")).toBe(false);
      });
    });
  }
}
