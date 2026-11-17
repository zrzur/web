/* eslint-disable no-undef */
// Icons and launch images of the installed app, made from the committed
// brand files (nothing is redrawn):
//   apple-touch-icon.png     the Android icon (zrzur-pwa-512.png) at 180 px:
//                            iOS paints black behind a transparent icon
//   masking-192x192.png      masking-512x512.png at 192 px
//   shortcut-*.png           96 px, an icon of the app's set on the icon colour
//   splash/<w>x<h>.png       iOS launch images: the mark on the frame colour
// Run from packages/client:  node scripts/pwaIcons.mjs
// (E2E_CHROMIUM=<chrome> to use a browser other than Playwright's own)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { chromium } from "@playwright/test";

import { IOS_SCREENS, splashFile } from "../components/pwa/iosScreens.ts";

const dir = resolve("scripts/assets_fallback/web");
const data = (file, type) =>
  `data:${type};base64,${readFileSync(resolve(dir, file)).toString("base64")}`;

/** The inside of an icon of the app's set (components/ui/icons/drawings.ts) */
function drawing(name) {
  const source = readFileSync(
    resolve("components/ui/icons/drawings.ts"),
    "utf8",
  );
  // a name with a dash is quoted in the table, a plain word is not
  const quoted = source.indexOf(`\n  "${name}":`);
  const at = quoted < 0 ? source.indexOf(`\n  ${name}:`) : quoted;
  if (at < 0) throw new Error(`no icon named ${name}`);
  const from = source.indexOf("'", at) + 1;
  return source.slice(from, source.indexOf("',\n", from));
}

const FRAME = "#0D0E16";
const browser = await chromium.launch({
  executablePath: process.env.E2E_CHROMIUM || undefined,
});
const page = await browser.newPage({ deviceScaleFactor: 1 });

/** Screenshot of a page that is exactly width x height */
async function shoot(html, width, height, file) {
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<!doctype html><style>*{margin:0}html,body{width:100%;height:100%;overflow:hidden}</style>${html}`,
  );
  const path = resolve(dir, file);
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, await page.screenshot({ type: "png" }));
  console.log(`${file} ${width}x${height}`);
}

const scaled = (file) =>
  `<img src="${data(file, "image/png")}" style="display:block;width:100%;height:100%">`;

await shoot(scaled("zrzur-pwa-512.png"), 180, 180, "apple-touch-icon.png");
await shoot(scaled("masking-512x512.png"), 192, 192, "masking-192x192.png");

// the colour behind the mark on the app icon, read from the icon itself
await page.setContent(`<img src="${data("zrzur-pwa-512.png", "image/png")}">`);
const iconColour = await page.evaluate(async () => {
  const image = document.querySelector("img");
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 8;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, 8, 8, 0, 0, 8, 8);
  const [r, g, b] = context.getImageData(2, 2, 1, 1).data;
  return `rgb(${r} ${g} ${b})`;
});

for (const [file, icon] of [
  ["shortcut-messages.png", "chat-circle-dots"],
  ["shortcut-discover.png", "compass"],
  ["shortcut-you.png", "user-circle"],
])
  await shoot(
    `<div style="width:100%;height:100%;display:grid;place-items:center;background:${iconColour};color:#fff">
      <svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke-width="1.6">${drawing(icon)}</svg></div>`,
    96,
    96,
    file,
  );

const mark = data("zrzur-mark.svg", "image/svg+xml");
for (const screen of IOS_SCREENS) {
  const width = screen.width * screen.ratio;
  const height = screen.height * screen.ratio;
  await shoot(
    `<div style="width:100%;height:100%;display:grid;place-items:center;background:${FRAME}">
      <img src="${mark}" style="width:${96 * screen.ratio}px;height:${96 * screen.ratio}px"></div>`,
    width,
    height,
    `splash/${splashFile(screen)}`,
  );
}

await browser.close();
