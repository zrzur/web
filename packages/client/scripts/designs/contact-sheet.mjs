/**
 * Contact sheets of the built-in designs, at the sizes people see them, on
 * dark and pale surfaces. For looking at the art; not part of any build.
 *
 *   node scripts/designs/contact-sheet.mjs <output folder> [plates|decorations|effects|names|motion]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const client = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const root = resolve(client, "../..");
const pnpmDir = join(root, "node_modules/.pnpm");
const find = (prefix) => readdirSync(pnpmDir).find((d) => d.startsWith(prefix));
const require = createRequire(
  join(pnpmDir, find("playwright@"), "node_modules/playwright/package.json"),
);
const { chromium } = require("playwright");

const [out = ".", only] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const temp = join(tmpdir(), "zrzur-sheets");
mkdirSync(temp, { recursive: true });
const pub = pathToFileURL(join(client, "public")).href;

const browser = await chromium.launch({ channel: "chrome" });

async function shoot(name, html, width = 1500, wait = 500) {
  const file = join(temp, `${name}.html`);
  writeFileSync(file, html);
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
  });
  page.on("pageerror", (e) => console.log("page error", e.message));
  await page.goto(pathToFileURL(file).href);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
  await page.close();
  console.log(name);
}

const DARK = { bg: "#171925", fg: "#F0F1F8", sub: "#A1A5B8" };
const PALE = { bg: "#F1F2F8", fg: "#171925", sub: "#454A62" };

const page = (theme, body, dir = "ltr", extra = "") => `<!doctype html>
<html dir="${dir}"><head><meta charset="utf-8"><style>
:root{--z-plate-ltr:initial;--z-plate-rtl: ;--z-plate-angle:90deg;--z-plate-end:right}
[dir=rtl]{--z-plate-ltr: ;--z-plate-rtl:initial;--z-plate-angle:270deg;--z-plate-end:left}
body{margin:0;padding:16px;background:${theme.bg};color:${theme.fg};font:14px/1.3 "Segoe UI",Tahoma,sans-serif}
.grid{display:grid;gap:8px 12px}
small{color:${theme.sub};font-size:11px}
${extra}
</style></head><body>${body}</body></html>`;

const plateBackground = (id) =>
  `linear-gradient(var(--z-plate-angle,90deg),rgb(8 9 16/.8),rgb(8 9 16/.58) 50%,rgb(8 9 16/.06) 78%),` +
  `var(--z-plate-ltr,url('${pub}/nameplates/${id}.svg')) var(--z-plate-rtl,url('${pub}/nameplates/${id}.svg#rtl')) var(--z-plate-end,right) center/cover no-repeat`;

const NAMES = ["Lina", "Omar Haddad", "Sara", "Alice", "Noor", "Yusuf"];

const ARAB =
  "dz bh km dj eg iq jo kw lb ly mr ma om ps qa sa so sd sy tn ae ye".split(
    " ",
  );

/** The scrim the app uses, from the name's side only */
const SCRIM =
  "linear-gradient(var(--z-plate-angle,90deg),rgb(8 9 16/18%),rgb(8 9 16/0%) 18%)";

async function plates() {
  const flags = readdirSync(join(client, "public/nameplates"))
    .filter((f) => f.startsWith("flag-") && f.endsWith(".svg"))
    .map((f) => f.slice(0, -4));
  const arab = ARAB.map((code) => `flag-${code}`);
  const all = [...arab, ...flags.filter((id) => !arab.includes(id))];
  // 448 x 84, as on Designs: every flag read at its real size
  const cell = (id, i) =>
    `<div><div style="display:flex;align-items:center;gap:12px;width:448px;height:84px;padding-inline:16px;box-sizing:border-box;border-radius:8px;color:#fff;font-weight:600;font-size:16px;text-shadow:0 1px 3px rgb(0 0 0/.7);background:${SCRIM},var(--z-plate-ltr,url('${pub}/nameplates/${id}.svg')) var(--z-plate-rtl,url('${pub}/nameplates/${id}.svg#rtl')) center/100% 100% no-repeat"><span style="width:48px;height:48px;border-radius:50%;background:#7E8299;flex:none"></span>${NAMES[i % NAMES.length]}</div><small>${id}</small></div>`;
  const grid = (ids) =>
    `<div class="grid" style="grid-template-columns:repeat(4,448px)">${ids.map(cell).join("")}</div>`;
  const size = 40;
  for (let part = 0; part * size < all.length; part++) {
    await shoot(
      `flags-v3-${String(part + 1).padStart(2, "0")}`,
      page(DARK, grid(all.slice(part * size, part * size + size))),
      1880,
    );
  }
  await shoot("flags-v3-arab-rtl", page(DARK, grid(arab), "rtl"), 1880);
  await shoot("flags-v3-arab-pale", page(PALE, grid(arab)), 1880);
}

async function decorations() {
  const ids = readdirSync(join(client, "public/decorations"))
    .filter((f) => f.endsWith(".svg"))
    .map((f) => f.slice(0, -4));
  const face =
    "radial-gradient(circle at 50% 38%,#F2C6A0 0 22%,transparent 23%),radial-gradient(circle at 50% 100%,#E0195F 0 44%,transparent 45%),#3A3F55";
  const avatar = (size, id, hash = "") =>
    `<span style="position:relative;display:inline-block;width:${size}px;height:${size}px;margin:${size * 0.3}px"><span style="position:absolute;inset:0;border-radius:50%;background:${face}"></span><img src="${pub}/decorations/${id}.svg${hash}" style="position:absolute;left:-25%;top:-25%;width:150%;height:150%"></span>`;
  const cell = (id) =>
    `<div style="display:flex;align-items:center;gap:4px;min-height:190px;flex-wrap:wrap"><div>${[32, 48, 80, 112].map((s) => avatar(s, id)).join("")}</div><small style="width:100%">${id}</small></div>`;
  const grid = `<div class="grid" style="grid-template-columns:repeat(3,1fr)">${ids.map(cell).join("")}</div>`;
  await shoot("decorations-dark", page(DARK, grid));
  await shoot("decorations-pale", page(PALE, grid));
  const zoom = ids
    .map(
      (id) =>
        `<div>${avatar(112, id, "#play")}<br><small>${id} (playing)</small></div>`,
    )
    .join("");
  await shoot(
    "decorations-playing",
    page(
      DARK,
      `<div class="grid" style="grid-template-columns:repeat(6,1fr)">${zoom}</div>`,
    ),
    1500,
    1400,
  );
}

function effectsBundle() {
  const esbuild = require(
    join(pnpmDir, find("esbuild@"), "node_modules/esbuild"),
  );
  const file = join(temp, "effects.js");
  esbuild.buildSync({
    entryPoints: [
      join(
        client,
        "components/ui/components/features/profiles/effects/effects.ts",
      ),
    ],
    bundle: true,
    format: "iife",
    globalName: "fx",
    outfile: file,
  });
  return readFileSync(file, "utf8");
}

async function effects() {
  const code = effectsBundle();
  // a card the width of a real profile card, at the fullest moment, and a tile
  const script = (from, to) => `<script>${code}</script><script>
  for (const id of fx.EFFECT_IDS.slice(${from}, ${to})) {
    const cell = document.createElement("div");
    cell.innerHTML = "<small>" + id + "</small><br>";
    const add = (w, h, draw) => {
      const c = document.createElement("canvas");
      c.width = w * 2;
      c.height = h * 2;
      c.style.cssText = "width:" + w + "px;height:" + h + "px;margin:2px;border-radius:12px;box-shadow:inset 0 0 0 1px rgb(128 128 128/.3);vertical-align:top";
      cell.append(c);
      draw(c.getContext("2d"), c.width, c.height);
    };
    add(300, 420, (ctx, w, h) => fx.drawEffect(ctx, id, 2000, w, h));
    add(136, 96, (ctx, w, h) => fx.drawEffectStill(ctx, id, w, h));
    document.body.append(cell);
  }
  </script>`;
  const extra =
    "body{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}";
  for (const [theme, label] of [
    [DARK, "dark"],
    [PALE, "pale"],
  ]) {
    for (let part = 0; part < 3; part++) {
      await shoot(
        `effects-${label}-${part + 1}`,
        page(theme, script(part * 10, part * 10 + 10), "ltr", extra),
        1860,
      );
    }
  }
}

async function names() {
  const code = execFileSync(process.execPath, [
    "-e",
    `const s=require("node:fs").readFileSync(${JSON.stringify(join(client, "components/ui/components/features/profiles/nameStyles.ts"))},"utf8");console.log(s)`,
  ]).toString();
  const list = [...code.matchAll(/\["(#[0-9a-f]{6})", "(#[0-9a-f]{6})"\]/gi)];
  const solids = [...code.matchAll(/^\s*"(#[0-9a-f]{6})",$/gim)];
  const cell = (css, label) =>
    `<div style="font-weight:700;font-size:16px"><span style="${css}">زرزور Omar Haddad</span></div>`;
  const body =
    `<div class="grid" style="grid-template-columns:repeat(5,1fr)">` +
    list
      .map(([, a, b]) =>
        cell(
          `background:linear-gradient(90deg,${a},${b});-webkit-background-clip:text;background-clip:text;color:transparent`,
        ),
      )
      .join("") +
    solids.map(([, a]) => cell(`color:${a}`)).join("") +
    `</div>`;
  await shoot("name-colours-dark", page(DARK, body));
}

async function avatars() {
  const files = readdirSync(join(client, "public/avatars")).filter((f) =>
    f.endsWith(".svg"),
  );
  const round = (file, size) =>
    `<img src="${pub}/avatars/${file}" style="width:${size}px;height:${size}px;border-radius:50%">`;
  const cell = (file) =>
    `<div>${round(file, 112)}<br>${round(file, 64)} ${round(file, 32)} ${round(file, 22)}</div>`;
  const grid = `<div class="grid" style="grid-template-columns:repeat(5,1fr)">${files.map(cell).join("")}</div>`;
  await shoot("avatars-pack-dark", page(DARK, grid), 880);
  await shoot("avatars-pack-pale", page(PALE, grid), 880);
}

const sets = { plates, decorations, effects, names, avatars };
for (const [name, run] of Object.entries(sets)) {
  if (!only || only === name) await run();
}
await browser.close();
