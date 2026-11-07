// P-03 / P-04 on the dev stack: players from other sites wait for a click, the
// GIF picker talks only to our GIF service, sent GIFs make no request to
// Klipy/Tenor/Giphy, and the GIF service's media route answers 200 for a link
// it signed itself. Runs in en/ar/de on desktop and at 375 px.
//
// Set E2E_LIB to a folder holding stack.mjs.
//
// Usage: node privacy-embeds-gif.mjs
// Env: E2E_CHROMIUM, E2E_BASE (web build of this branch), E2E_API,
//      E2E_GIF (GIF service, default http://127.0.0.1:14706; the web build needs
//      VITE_DEV_GIFBOX_URL set to the same address, and the GIF service needs
//      GIFBOX_KLIPY_KEY and GIFBOX_MEDIA_SECRET), E2E_GIF_CHANNEL (optional
//      /server/…/channel/… path of a channel that holds sent GIFs).
// Needs internet for january to build the embeds. Not for production stacks.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  APP,
  LOCALES,
  VIEWPORTS,
  accounts,
  api,
  login,
  pw,
  reporter,
  shots,
  token,
} from "./lib/stack.mjs";

const SERVER = "01M6H53ZDR6PJGQ22WBDYAZ6AD";
const GENERAL = "01M6H53ZDRK9YVYQNSAWNQKJKM";
const CHANNEL = `/server/${SERVER}/channel/${GENERAL}`;
const GIF = process.env.E2E_GIF ?? "http://127.0.0.1:14706";
const GIF_CHANNEL = process.env.E2E_GIF_CHANNEL;

const OUTSIDE =
  /(^|\.)(youtube(-nocookie)?\.com|youtu\.be|ytimg\.com|googlevideo\.com|google\.com|googleapis\.com|gstatic\.com|klipy\.com|twitch\.tv|jtvnw\.net|spotify\.com|scdn\.co|soundcloud\.com|sndcdn\.com|bandcamp\.com|bcbits\.com|apple\.com|mzstatic\.com|streamable\.com|tenor\.com|giphy\.com)$/;

const LINKS = {
  YouTube: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  Spotify: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
  SoundCloud: "https://soundcloud.com/forss/flickermood",
  Bandcamp: "https://daniellanois.bandcamp.com/album/for-the-good-times",
  Twitch: "https://www.twitch.tv/videos/1",
  "Apple Music":
    "https://music.apple.com/us/album/1989-taylors-version/1708308989",
  Streamable: "https://streamable.com/moo",
};

const shot = shots("privacy-embeds-gif");
const report = reporter("privacy-embeds-gif");
const owner = await token(accounts[0]);
const browser = await pw.chromium.launch({
  executablePath: process.env.E2E_CHROMIUM,
});

const hostsOf = (urls) => urls.map((u) => new URL(u).hostname);

for (const locale of LOCALES) {
  for (const [sizeName, viewport] of Object.entries(VIEWPORTS)) {
    const tag = `${locale} ${sizeName}`;
    const { page, context } = await login(browser, accounts[0], {
      viewport,
      locale,
    });
    report.page = page;
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));

    for (const [provider, link] of Object.entries(LINKS)) {
      await report.step(`${tag}: ${provider} waits for the click`, async () => {
        await api(owner, "POST", `/channels/${GENERAL}/messages`, {
          content: `${link} ${Date.now()}`,
        });
        requests.length = 0;
        await page.goto(`${APP}${CHANNEL}`);
        const placeholder = page
          .locator('[data-testid="player-placeholder"]')
          .last();
        await placeholder.waitFor({ timeout: 45000 });
        if ((await page.locator("iframe").count()) !== 0)
          throw new Error("iframe before the click");
        const bad = hostsOf(requests).filter((h) => OUTSIDE.test(h));
        if (bad.length)
          throw new Error(
            `requests before the click: ${[...new Set(bad)].join(", ")}`,
          );
        const button = placeholder.locator("button");
        const box = await button.boundingBox();
        if (viewport.width < 600 && box.height < 44)
          throw new Error(`button ${box.height}px high`);
        await page.screenshot({
          path: shot(`${provider.replace(/\W/g, "")}-${locale}-${sizeName}`),
        });
        await button.click();
        await page.locator("iframe").last().waitFor({ timeout: 15000 });
      });
    }

    await report.step(
      `${tag}: GIF picker search uses only the GIF service`,
      async () => {
        requests.length = 0;
        let signed;
        page.on("response", async (response) => {
          if (!signed && response.url().includes("/klipy/gifs")) {
            const body = await response.text().catch(() => "");
            const first = body.match(/"src":"([^"]+)"/);
            if (first) signed = first[1];
          }
        });
        await page.goto(`${APP}${CHANNEL}`);
        await page.getByRole("button", { name: /gif/i }).first().click();
        await page.locator('input[type="search"]').fill("cat");
        await page.waitForTimeout(2500);
        const urls = requests.map((u) => new URL(u));
        const gifHost = new URL(GIF).host;
        const gifCalls = urls.filter((u) => u.pathname.startsWith("/klipy/"));
        if (!gifCalls.length) throw new Error("no request to the GIF service");
        for (const u of gifCalls)
          if (u.host !== gifHost) throw new Error(`GIF call to ${u.host}`);
        const outside = urls.filter((u) => OUTSIDE.test(u.hostname));
        if (outside.length)
          throw new Error(`request to ${outside[0].hostname}`);
        if (urls.some((u) => u.searchParams.has("customer_id")))
          throw new Error("customer_id in a request");
        if (!signed)
          throw new Error(
            "search returned no signed media link (Klipy key set on the GIF service?)",
          );
        const media = await fetch(`${GIF}${signed}`);
        if (media.status !== 200)
          throw new Error(`/klipy/media answered ${media.status}`);
        const unsigned = await fetch(
          `${GIF}/klipy/media?u=https%3A%2F%2Fstatic.klipy.com%2Fa.gif`,
        );
        if (unsigned.status === 200)
          throw new Error("unsigned /klipy/media answered 200");
      },
    );

    await report.step(
      `${tag}: toggle "always load" skips the placeholder`,
      async () => {
        await page.goto(`${APP}/settings/account`);
        const row = page
          .getByText(
            /always load media players|Medienplayer anderer Seiten immer laden|مشغّلات الوسائط من المواقع الأخرى/,
          )
          .first();
        await row.scrollIntoViewIfNeeded();
        await row.click();
        await api(owner, "POST", `/channels/${GENERAL}/messages`, {
          content: `${LINKS.YouTube} ${Date.now()}`,
        });
        await page.goto(`${APP}${CHANNEL}`);
        await page.locator("iframe").last().waitFor({ timeout: 45000 });
        await page.goto(`${APP}/settings/account`);
        await row.click(); // back off for the next run
      },
    );

    if (GIF_CHANNEL) {
      await report.step(
        `${tag}: reader of sent GIFs contacts no GIF host`,
        async () => {
          requests.length = 0;
          await page.goto(`${APP}${GIF_CHANNEL}`);
          await page.locator("video, img").first().waitFor({ timeout: 30000 });
          await page.waitForTimeout(2000);
          const bad = hostsOf(requests).filter((h) => OUTSIDE.test(h));
          if (bad.length)
            throw new Error(`requests to ${[...new Set(bad)].join(", ")}`);
        },
      );
    }
    await context.close();
  }
}

await browser.close();
const failed = report.done();
writeFileSync(
  fileURLToPath(new URL("./privacy-embeds-gif-results.json", import.meta.url)),
  JSON.stringify(report.results, null, 2),
);
process.exit(failed ? 1 : 0);
