/**
 * The Zrzur frame kit: everything a designer needs to draw a community
 * profile frame, served as static files from public/frame-kit/.
 * Run: node scripts/designs/frame-kit.mjs
 *
 *   template.svg        the template with named layers (export area, reach
 *                       area, stretch zones, 4 px grid, card outline, safe
 *                       zone, crest window, labels)
 *   template.png        the same guides at the file's exact size
 *   example-frame.png   a finished frame, drawn the way Zrzur's pixel frames
 *                       are drawn, that passes every upload check
 *   palette.json        Zrzur's colours and the example's ramps
 *   palette.ase         the same, as Adobe Swatch Exchange
 *   README.md           the rules, in English, Arabic and German
 *   zrzur-frame-kit.zip all of the above
 *
 * The numbers are the backend's (PROFILE_FRAME_TEMPLATE, users.rs) and the
 * web app's (communityFrame.ts); frameKit.test.ts checks they agree, that the
 * example passes the safe-area rule, and that the files in public/ are what
 * this script makes. Everything is original to Zrzur (AGPL-3.0); nothing is
 * traced or sampled. The output is the same on every run (no time stamps).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

/* ------------------------------------------------------------------ */
/* The template (template px; the file is twice this)                   */
/* ------------------------------------------------------------------ */

export const TEMPLATE = {
  width: 400,
  height: 510,
  density: 2,
  card: { left: 30, top: 70, right: 370, bottom: 470 },
  safe: { left: 40, top: 80, right: 360, bottom: 460 },
  crest: { left: 120, top: 80, right: 280, bottom: 110 },
  /** drawn as it is; the sides between them stretch with the card */
  slice: { top: 110, side: 40, bottom: 50 },
};
/** The file's size, in pixels */
export const FILE = { width: 800, height: 1020 };
/** Largest file the server takes (the `decorations` upload limit) */
export const MAX_BYTES = 2_500_000;
/** Least alpha that counts as drawn in the safe zone */
export const ALPHA_LIMIT = 16;
/** One pixel-art block, in file pixels (4 px on a 340 px card) */
export const BLOCK = 8;

const D = TEMPLATE.density;
const f = (rect) => ({
  left: rect.left * D,
  top: rect.top * D,
  right: rect.right * D,
  bottom: rect.bottom * D,
});
/** in file pixels */
export const CARD = f(TEMPLATE.card);
export const SAFE = f(TEMPLATE.safe);
export const CREST = f(TEMPLATE.crest);
/** the rows drawn as they are, at the top and the foot, in file pixels */
export const FIXED = {
  top: TEMPLATE.slice.top * D,
  bottom: FILE.height - TEMPLATE.slice.bottom * D,
};

/* ------------------------------------------------------------------ */
/* Colours                                                             */
/* ------------------------------------------------------------------ */

/** Zrzur's interface colours (brand.md, Midnight Pulse) */
const BRAND = [
  ["Action pink-red", "#E0195F"],
  ["Action hover", "#C8155A"],
  ["Action pressed", "#B0124F"],
  ["Action text on dark", "#FF7AA8"],
  ["Surface frame", "#0D0E16"],
  ["Surface nav", "#171925"],
  ["Surface chat", "#1D1F2D"],
  ["Surface raised", "#242638"],
  ["Selected", "#303348"],
  ["Floating", "#11121C"],
  ["Title text", "#F7F8FC"],
  ["Text", "#F0F1F8"],
  ["Secondary text", "#A1A5B8"],
  ["Online aqua", "#55DCC8"],
  ["Warning amber", "#F3B96B"],
  ["Ink", "#191B27"],
  ["Light surface", "#F5F6FB"],
];

/** The example frame's ramps, dark to light (five steps, no gradients) */
const RAMPS = {
  ink: ["#120D1C"],
  rose: ["#3A0A20", "#7A1240", "#B8155A", "#E0195F", "#FF9CC0"],
  aqua: ["#0B3A3A", "#127068", "#24A596", "#55DCC8", "#C9FFF6"],
  gold: ["#FFE29A", "#FFFFFF"],
};

const hex = (value) => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
];

/* ------------------------------------------------------------------ */
/* A small RGBA raster and its PNG                                     */
/* ------------------------------------------------------------------ */

function raster(width, height) {
  const data = new Uint8Array(width * height * 4);
  /** source-over one pixel; colour "#rrggbb", alpha 0..1 */
  const put = (x, y, colour, alpha = 1) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const [r, g, b] = hex(colour);
    const i = (y * width + x) * 4;
    const a = alpha;
    const below = data[i + 3] / 255;
    const out = a + below * (1 - a);
    if (out <= 0) return;
    data[i] = Math.round((r * a + data[i] * below * (1 - a)) / out);
    data[i + 1] = Math.round((g * a + data[i + 1] * below * (1 - a)) / out);
    data[i + 2] = Math.round((b * a + data[i + 2] * below * (1 - a)) / out);
    data[i + 3] = Math.round(out * 255);
  };
  const fill = (left, top, right, bottom, colour, alpha = 1) => {
    for (let y = Math.max(0, top); y < Math.min(height, bottom); y++)
      for (let x = Math.max(0, left); x < Math.min(width, right); x++)
        put(x, y, colour, alpha);
  };
  return { width, height, data, put, fill };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** An RGBA PNG, nothing but the picture (no text, no time) */
export function encodePng({ width, height, data }) {
  const chunk = (type, body) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, "latin1");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
    return Buffer.concat([head, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    rows[y * (width * 4 + 1)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(
      rows,
      y * (width * 4 + 1) + 1,
    );
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ */
/* The rule the server applies                                         */
/* ------------------------------------------------------------------ */

/** Drawn pixels over the card's content: 0 for a file the server takes */
export function coveredPixels(data, width = FILE.width) {
  const height = data.length / 4 / width;
  let covered = 0;
  for (let y = SAFE.top; y < Math.min(SAFE.bottom, height); y++)
    for (let x = SAFE.left; x < SAFE.right; x++) {
      const inCrest =
        x >= CREST.left &&
        x < CREST.right &&
        y >= CREST.top &&
        y < CREST.bottom;
      if (!inCrest && data[(y * width + x) * 4 + 3] > ALPHA_LIMIT) covered++;
    }
  return covered;
}

/* ------------------------------------------------------------------ */
/* The example frame                                                    */
/* ------------------------------------------------------------------ */

/*
 * "Desert night": eight-point stars (two squares, one turned) on a band
 * round the card, a large star as the crest, smaller ones on the corners and
 * the foot. Drawn on 8 px blocks counted from the card's top-left corner, one
 * light from the top start: lit facets up and to the start, shadow down and
 * to the end, an ink outline round every shape. The band's sides are plain,
 * so they stretch with the card's height without showing it.
 */

/** blocks of the card: 0..84 across, 0..99 down */
const CARD_BLOCKS = {
  w: (CARD.right - CARD.left) / BLOCK,
  h: (CARD.bottom - CARD.top) / BLOCK,
};

/** cells of an eight-point star of half-size `r` (square half `q`) */
function starCells(r, q) {
  const cells = [];
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (
        (Math.abs(x) <= q && Math.abs(y) <= q) ||
        Math.abs(x) + Math.abs(y) <= r
      )
        cells.push([x, y]);
  return cells;
}

export function exampleFrame() {
  const art = raster(FILE.width, FILE.height);
  const block = (bx, by, colour) =>
    art.fill(
      CARD.left + bx * BLOCK,
      CARD.top + by * BLOCK,
      CARD.left + (bx + 1) * BLOCK,
      CARD.top + (by + 1) * BLOCK,
      colour,
    );
  const { w, h } = CARD_BLOCKS;
  const ink = RAMPS.ink[0];
  const rose = RAMPS.rose;
  const aqua = RAMPS.aqua;

  // the band: ink outside, the colour on the card's edge, a lit or shaded
  // inner edge (light from the top start)
  for (let x = -1; x <= w; x++) {
    block(x, -1, ink);
    block(x, 0, aqua[2]);
    block(x, 1, aqua[3]);
    block(x, h, ink);
    block(x, h - 1, aqua[2]);
    block(x, h - 2, aqua[1]);
  }
  for (let y = -1; y <= h; y++) {
    block(-1, y, ink);
    block(w, y, ink);
    if (y >= 0 && y < h) {
      block(0, y, aqua[2]);
      block(w - 1, y, aqua[2]);
      if (y >= 1 && y < h - 1) {
        block(1, y, aqua[3]);
        block(w - 2, y, aqua[1]);
      }
    }
  }

  /** a star: outline, a lit half and a shaded half, a glint in the middle */
  const star = (cx, cy, r, q, ramp) => {
    const cells = starCells(r, q);
    const inStar = new Set(cells.map(([x, y]) => `${x},${y}`));
    for (const [x, y] of cells) {
      const edge = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => !inStar.has(`${x + dx},${y + dy}`));
      const colour = edge
        ? ink
        : x === 0 && y === 0
          ? ramp[4]
          : x + y < 0
            ? ramp[3]
            : x + y === 0
              ? ramp[2]
              : ramp[1];
      block(cx + x, cy + y, colour);
    }
  };

  // the crest: one large star over the middle of the card's top edge, its
  // foot inside the crest window, and two small ones beside it
  const mid = (w - 1) / 2;
  star(mid, -5, 8, 5, rose);
  star(mid - 13, -3, 3, 1, aqua);
  star(mid + 13, -3, 3, 1, aqua);
  // the corners, outside the card
  star(-4, -4, 3, 2, rose);
  star(w + 3, -4, 3, 2, rose);
  star(-4, h + 3, 3, 2, rose);
  star(w + 3, h + 3, 3, 2, rose);
  // the foot
  star(mid, h + 4, 3, 1, aqua);
  // studs along the top band, every eight blocks
  for (let x = 8; x < w - 4; x += 8)
    if (Math.abs(x - mid) > 18) {
      block(x, -2, ink);
      block(x, -3, ink);
      block(x - 1, -2, ink);
      block(x + 1, -2, ink);
      block(x, -2, RAMPS.gold[0]);
    }
  // a few sparks in the room above
  for (const [x, y] of [
    [mid - 22, -10],
    [mid + 24, -12],
    [6, -12],
    [w - 7, -11],
  ]) {
    block(x, y, RAMPS.gold[0]);
    block(x - 1, y, RAMPS.gold[1]);
    block(x + 1, y, RAMPS.gold[1]);
    block(x, y - 1, RAMPS.gold[1]);
    block(x, y + 1, RAMPS.gold[1]);
  }
  return art;
}

/* ------------------------------------------------------------------ */
/* The template                                                         */
/* ------------------------------------------------------------------ */

const COLOURS = {
  page: "#171925",
  card: "#242638",
  banner: "#303348",
  mock: "#3B3F58",
  safe: "#E0195F",
  crest: "#F7F8FC",
  stretch: "#55DCC8",
  export: "#F3B96B",
  grid: "#FFFFFF",
  label: "#F7F8FC",
};

/** the card's banner, avatar, name and text, so the safe zone means something */
const MOCK = {
  bannerBottom: CARD.top + 226,
  avatar: { cx: CARD.left + 96, cy: CARD.top + 226, r: 68 },
  name: {
    left: CARD.left + 40,
    top: CARD.top + 316,
    right: CARD.left + 360,
    bottom: CARD.top + 352,
  },
  lines: [400, 440, 480, 560, 600, 640, 720].map((y) => CARD.top + y),
};

/** 5 x 7 digits and the few signs the template's numbers need */
const GLYPHS = {
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  x: ["00000", "00000", "10001", "01010", "00100", "01010", "10001"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ",": ["00000", "00000", "00000", "00000", "00110", "00100", "01000"],
};

function text(image, value, x, y, colour, size = 3) {
  let at = x;
  for (const char of String(value)) {
    const glyph = GLYPHS[char];
    if (glyph)
      glyph.forEach((row, gy) =>
        [...row].forEach((on, gx) => {
          if (on === "1")
            image.fill(
              at + gx * size,
              y + gy * size,
              at + (gx + 1) * size,
              y + (gy + 1) * size,
              colour,
            );
        }),
      );
    at += 6 * size;
  }
}
const textWidth = (value, size = 3) => String(value).length * 6 * size - size;

function dashedRect(image, r, colour, width, dash, alpha = 1) {
  const on = (i) => Math.floor(i / dash) % 2 === 0;
  for (let x = r.left; x < r.right; x++)
    if (on(x - r.left)) {
      image.fill(x, r.top, x + 1, r.top + width, colour, alpha);
      image.fill(x, r.bottom - width, x + 1, r.bottom, colour, alpha);
    }
  for (let y = r.top; y < r.bottom; y++)
    if (on(y - r.top)) {
      image.fill(r.left, y, r.left + width, y + 1, colour, alpha);
      image.fill(r.right - width, y, r.right, y + 1, colour, alpha);
    }
}

function solidRect(image, r, colour, width) {
  image.fill(r.left, r.top, r.right, r.top + width, colour);
  image.fill(r.left, r.bottom - width, r.right, r.bottom, colour);
  image.fill(r.left, r.top, r.left + width, r.bottom, colour);
  image.fill(r.right - width, r.top, r.right, r.bottom, colour);
}

export function templateRaster() {
  const image = raster(FILE.width, FILE.height);
  const { put, fill } = image;
  // the page round the card: where the art may reach
  fill(0, 0, FILE.width, FILE.height, COLOURS.page);
  // the stretch zones: the sides between the fixed top and foot
  fill(0, FIXED.top, SAFE.left, FIXED.bottom, COLOURS.stretch, 0.12);
  fill(SAFE.right, FIXED.top, FILE.width, FIXED.bottom, COLOURS.stretch, 0.12);
  // the card, with what lies on it
  fill(CARD.left, CARD.top, CARD.right, CARD.bottom, COLOURS.card);
  fill(CARD.left, CARD.top, CARD.right, MOCK.bannerBottom, COLOURS.banner);
  const { cx, cy, r } = MOCK.avatar;
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) put(x, y, COLOURS.mock);
  fill(
    MOCK.name.left,
    MOCK.name.top,
    MOCK.name.right,
    MOCK.name.bottom,
    COLOURS.mock,
  );
  MOCK.lines.forEach((y, i) =>
    fill(
      CARD.left + 40,
      y,
      CARD.left + (i % 3 === 2 ? 420 : 600),
      y + 16,
      COLOURS.mock,
    ),
  );
  // the 4 px grid: 8 file px blocks from the card's corner, every fifth line
  // a little stronger
  for (let x = CARD.left % BLOCK; x < FILE.width; x += BLOCK) {
    const strong = ((x - CARD.left) / BLOCK) % 5 === 0;
    fill(x, 0, x + 1, FILE.height, COLOURS.grid, strong ? 0.12 : 0.05);
  }
  for (let y = CARD.top % BLOCK; y < FILE.height; y += BLOCK) {
    const strong = ((y - CARD.top) / BLOCK) % 5 === 0;
    fill(0, y, FILE.width, y + 1, COLOURS.grid, strong ? 0.12 : 0.05);
  }
  // the safe zone: keep clear, less the crest window
  for (let y = SAFE.top; y < SAFE.bottom; y++)
    for (let x = SAFE.left; x < SAFE.right; x++) {
      const inCrest =
        x >= CREST.left &&
        x < CREST.right &&
        y >= CREST.top &&
        y < CREST.bottom;
      // hatched, so the card still shows through
      if (!inCrest) put(x, y, COLOURS.safe, (x + y) % 24 < 4 ? 0.5 : 0.18);
    }
  dashedRect(image, SAFE, COLOURS.safe, 4, 16);
  // the card's edge and the crest window
  solidRect(image, CARD, COLOURS.crest, 2);
  solidRect(image, CREST, COLOURS.crest, 4);
  // the export area: the whole file
  solidRect(
    image,
    { left: 0, top: 0, right: FILE.width, bottom: FILE.height },
    COLOURS.export,
    4,
  );
  // the numbers
  const label = (value, x, y) =>
    text(image, value, x - textWidth(value) / 2, y, COLOURS.label);
  label(`${FILE.width} x ${FILE.height}`, FILE.width / 2, 24);
  label(CARD.top, FILE.width / 2, 80);
  label(FILE.height - CARD.bottom, FILE.width / 2, CARD.bottom + 28);
  label(CARD.left, CARD.left / 2, FILE.height / 2);
  label(
    FILE.width - CARD.right,
    (CARD.right + FILE.width) / 2,
    FILE.height / 2,
  );
  label(
    `${CREST.right - CREST.left} x ${CREST.bottom - CREST.top}`,
    FILE.width / 2,
    CREST.top + 20,
  );
  return image;
}

/** the same template as SVG, with layers a drawing program keeps apart */
export function templateSvg() {
  const layer = (id, label, body, extra = "") =>
    `  <g id="${id}" inkscape:groupmode="layer" inkscape:label="${label}"${extra}>\n${body}\n  </g>`;
  const rect = (r, attrs) =>
    `    <rect x="${r.left}" y="${r.top}" width="${r.right - r.left}" height="${r.bottom - r.top}" ${attrs}/>`;
  const words = (en, ar, de) => `${en} · ${ar} · ${de}`;
  const safePath =
    `M${SAFE.left} ${SAFE.top}H${SAFE.right}V${SAFE.bottom}H${SAFE.left}Z` +
    `M${CREST.left} ${CREST.top}V${CREST.bottom}H${CREST.right}V${CREST.top}Z`;
  const label = (x, y, value, anchor = "middle") =>
    `    <text x="${x}" y="${y}" text-anchor="${anchor}">${value}</text>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Zrzur frame template. ${FILE.width} x ${FILE.height} px. Draw on a layer of your own, then hide every
     layer of this template before you export a PNG or WebP of the whole canvas.
     Card ${CARD.left},${CARD.top} to ${CARD.right},${CARD.bottom}. Safe zone (keep fully transparent)
     ${SAFE.left},${SAFE.top} to ${SAFE.right},${SAFE.bottom}, except the crest window
     ${CREST.left},${CREST.top} to ${CREST.right},${CREST.bottom}. Grid: ${BLOCK} px blocks from the card's corner. -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
  width="${FILE.width}" height="${FILE.height}" viewBox="0 0 ${FILE.width} ${FILE.height}">
  <defs>
    <pattern id="grid" x="${CARD.left}" y="${CARD.top}" width="${BLOCK}" height="${BLOCK}" patternUnits="userSpaceOnUse">
      <path d="M${BLOCK} 0H0V${BLOCK}" fill="none" stroke="${COLOURS.grid}" stroke-opacity="0.08" stroke-width="1"/>
    </pattern>
    <pattern id="hatch" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
      <rect width="24" height="24" fill="${COLOURS.safe}" fill-opacity="0.16"/>
      <rect width="4" height="24" fill="${COLOURS.safe}" fill-opacity="0.45"/>
    </pattern>
  </defs>
${layer("reach-area", words("Reach area: art may go here", "منطقة الامتداد: يجوز الرسم هنا", "Reichweite: hier darf gezeichnet werden"), rect({ left: 0, top: 0, right: FILE.width, bottom: FILE.height }, `fill="${COLOURS.page}"`))}
${layer("stretch-zones", words("Stretch zones: the sides stretch with the card's height", "مناطق التمدد: يتمدد الجانبان مع طول البطاقة", "Dehnzonen: die Seiten dehnen sich mit der Kartenhöhe"), [rect({ left: 0, top: FIXED.top, right: SAFE.left, bottom: FIXED.bottom }, `fill="${COLOURS.stretch}" fill-opacity="0.12"`), rect({ left: SAFE.right, top: FIXED.top, right: FILE.width, bottom: FIXED.bottom }, `fill="${COLOURS.stretch}" fill-opacity="0.12"`)].join("\n"))}
${layer("card", words("Card (sample content)", "البطاقة (محتوى للتوضيح)", "Karte (Beispielinhalt)"), [rect(CARD, `fill="${COLOURS.card}"`), rect({ ...CARD, bottom: MOCK.bannerBottom }, `fill="${COLOURS.banner}"`), `    <circle cx="${MOCK.avatar.cx}" cy="${MOCK.avatar.cy}" r="${MOCK.avatar.r}" fill="${COLOURS.mock}"/>`, rect(MOCK.name, `fill="${COLOURS.mock}"`), ...MOCK.lines.map((y, i) => rect({ left: CARD.left + 40, top: y, right: CARD.left + (i % 3 === 2 ? 420 : 600), bottom: y + 16 }, `fill="${COLOURS.mock}"`))].join("\n"))}
${layer("grid-4px", words("4 px grid (8 file px from the card's corner)", "شبكة 4 بكسل (8 بكسل في الملف من زاوية البطاقة)", "4-px-Raster (8 Datei-px ab der Kartenecke)"), rect({ left: 0, top: 0, right: FILE.width, bottom: FILE.height }, `fill="url(#grid)"`))}
${layer("safe-zone", words("Safe zone: keep fully transparent", "المنطقة الآمنة: اتركها شفافة تمامًا", "Schutzzone: vollständig transparent lassen"), [`    <path d="${safePath}" fill="url(#hatch)" fill-rule="evenodd"/>`, rect(SAFE, `fill="none" stroke="${COLOURS.safe}" stroke-width="4" stroke-dasharray="16 16"`)].join("\n"))}
${layer("card-outline", words("Card outline", "حدود البطاقة", "Kartenrand"), rect(CARD, `fill="none" stroke="${COLOURS.crest}" stroke-width="2"`))}
${layer("crest-window", words("Crest window: may be drawn on", "نافذة الشعار: يجوز الرسم فيها", "Wappenfenster: darf bemalt werden"), rect(CREST, `fill="none" stroke="${COLOURS.crest}" stroke-width="4"`))}
${layer("export-area", words("Export area: the whole canvas", "منطقة التصدير: اللوحة كلها", "Exportbereich: die ganze Fläche"), rect({ left: 2, top: 2, right: FILE.width - 2, bottom: FILE.height - 2 }, `fill="none" stroke="${COLOURS.export}" stroke-width="4"`))}
${layer("labels", words("Labels", "التسميات", "Beschriftungen"), [label(FILE.width / 2, 44, `${FILE.width} × ${FILE.height}`), label(FILE.width / 2, 104, `${CARD.top}`), label(FILE.width / 2, CARD.bottom + 50, `${FILE.height - CARD.bottom}`), label(CARD.left / 2, FILE.height / 2, `${CARD.left}`), label((CARD.right + FILE.width) / 2, FILE.height / 2, `${FILE.width - CARD.right}`), label(FILE.width / 2, CREST.top + 42, `${CREST.right - CREST.left} × ${CREST.bottom - CREST.top}`), label(SAFE.left + 16, SAFE.bottom - 20, words("Keep clear", "اتركها فارغة", "Freihalten"), "start")].join("\n"), ` font-family="IBM Plex Sans, IBM Plex Sans Arabic, sans-serif" font-size="22" fill="${COLOURS.label}"`)}
</svg>
`;
}

/* ------------------------------------------------------------------ */
/* Palette                                                              */
/* ------------------------------------------------------------------ */

function paletteEntries() {
  return [
    ...BRAND.map(([name, value]) => ({ group: "Zrzur", name, value })),
    ...Object.entries(RAMPS).flatMap(([ramp, values]) =>
      values.map((value, i) => ({
        group: "Example frame",
        name: `${ramp} ${i + 1}`,
        value,
      })),
    ),
  ];
}

export function paletteJson() {
  const entries = paletteEntries();
  return `${JSON.stringify(
    {
      name: "Zrzur frame kit",
      note: "Zrzur's interface colours and the ramps of the example frame. Five steps per ramp, dark to light; no gradients.",
      colours: entries,
    },
    null,
    2,
  )}\n`;
}

/** Adobe Swatch Exchange 1.0: one group per palette, RGB global colours */
export function paletteAse() {
  const blocks = [];
  const name = (value) => {
    const units = Buffer.alloc((value.length + 1) * 2);
    for (let i = 0; i < value.length; i++)
      units.writeUInt16BE(value.charCodeAt(i), i * 2);
    const head = Buffer.alloc(2);
    head.writeUInt16BE(value.length + 1, 0);
    return Buffer.concat([head, units]);
  };
  const block = (type, body) => {
    const head = Buffer.alloc(6);
    head.writeUInt16BE(type, 0);
    head.writeUInt32BE(body.length, 2);
    blocks.push(Buffer.concat([head, body]));
  };
  const groups = new Map();
  for (const entry of paletteEntries()) {
    if (!groups.has(entry.group)) groups.set(entry.group, []);
    groups.get(entry.group).push(entry);
  }
  for (const [group, entries] of groups) {
    block(0xc001, name(group));
    for (const entry of entries) {
      const rgb = Buffer.alloc(12);
      hex(entry.value).forEach((c, i) => rgb.writeFloatBE(c / 255, i * 4));
      const kind = Buffer.alloc(2); // 2 = normal
      kind.writeUInt16BE(2, 0);
      block(
        0x0001,
        Buffer.concat([
          name(entry.name),
          Buffer.from("RGB ", "latin1"),
          rgb,
          kind,
        ]),
      );
    }
    block(0xc002, Buffer.alloc(0));
  }
  const head = Buffer.alloc(12);
  head.write("ASEF", 0, "latin1");
  head.writeUInt16BE(1, 4);
  head.writeUInt16BE(0, 6);
  head.writeUInt32BE(blocks.length, 8);
  return Buffer.concat([head, ...blocks]);
}

/* ------------------------------------------------------------------ */
/* README                                                               */
/* ------------------------------------------------------------------ */

export function readme() {
  const mb = MAX_BYTES / 1_000_000;
  return `# Zrzur frame kit

English · العربية · Deutsch

## English

A profile frame is a picture laid round your profile card, still or moving. Draw it on this template.

- **Canvas:** exactly ${FILE.width} × ${FILE.height} px (the server takes no other size).
- **Card:** ${CARD.left},${CARD.top} to ${CARD.right},${CARD.bottom} (${CARD.right - CARD.left} × ${CARD.bottom - CARD.top} px).
- **Room for art:** ${CARD.top} px above the card, ${CARD.left} px beside it, ${FILE.height - CARD.bottom} px below it, plus a ${SAFE.left - CARD.left} px band just inside its edge.
- **Safe zone, keep fully transparent in every frame:** ${SAFE.left},${SAFE.top} to ${SAFE.right},${SAFE.bottom}. A pixel counts as drawn above alpha ${ALPHA_LIMIT} of 255.
- **Crest window, may be drawn on:** ${CREST.left},${CREST.top} to ${CREST.right},${CREST.bottom}, over the middle of the banner.
- **Stretching:** the top ${FIXED.top} px and the bottom ${FILE.height - FIXED.bottom} px are shown as drawn; the sides between them stretch with the card's height. Keep the sides plain.
- **Pixel grid:** draw in blocks of ${BLOCK} × ${BLOCK} file px, counted from the card's corner (${CARD.left},${CARD.top}). One block shows as 4 px on a 340 px card.
- **File:** PNG, animated PNG, WebP or GIF, transparent background, up to ${mb} MB.
- **Animation:** allowed, of any length, up to 240 frames. People who turn motion off see it as a still picture.
- **Naming:** lowercase words joined by hyphens, such as \`desert-night.png\`. Creator Studio names the design after the file; you can change it there.
- **Rules:** your own work, no copied art, no logos, no text or letters, nothing hateful.

Hide every layer of the template before you export. \`example-frame.png\` is a finished frame that passes every check. Upload in Designs → Creator Studio → New design → Profile frame.

## العربية

الإطار صورة تُوضع حول بطاقة ملفك الشخصي، ثابتة أو متحركة. ارسمه على هذا القالب.

- **اللوحة:** ${FILE.width} × ${FILE.height} بكسل تمامًا (لا يقبل الخادم أي مقاس آخر).
- **البطاقة:** من ${CARD.left},${CARD.top} إلى ${CARD.right},${CARD.bottom} (${CARD.right - CARD.left} × ${CARD.bottom - CARD.top} بكسل).
- **مساحة الرسم:** ${CARD.top} بكسل فوق البطاقة، و${CARD.left} بكسل على كل جانب، و${FILE.height - CARD.bottom} بكسل تحتها، إضافة إلى شريط عرضه ${SAFE.left - CARD.left} بكسل داخل حافتها.
- **المنطقة الآمنة، اتركها شفافة تمامًا في كل لقطة:** من ${SAFE.left},${SAFE.top} إلى ${SAFE.right},${SAFE.bottom}. يُعدّ البكسل مرسومًا إذا زادت شفافيته (ألفا) على ${ALPHA_LIMIT} من 255.
- **نافذة الشعار، يجوز الرسم فيها:** من ${CREST.left},${CREST.top} إلى ${CREST.right},${CREST.bottom}، فوق منتصف البانر.
- **التمدد:** يظهر أعلى ${FIXED.top} بكسل وأسفل ${FILE.height - FIXED.bottom} بكسل كما رُسما، ويتمدد الجانبان بينهما مع طول البطاقة. اجعل الجانبين بسيطين.
- **شبكة البكسل:** ارسم بمربعات ${BLOCK} × ${BLOCK} بكسل في الملف، تبدأ من زاوية البطاقة (${CARD.left},${CARD.top}). يظهر المربع الواحد بحجم 4 بكسل على بطاقة عرضها 340 بكسل.
- **الملف:** PNG أو PNG متحرك أو WebP أو GIF، بخلفية شفافة، بحجم لا يزيد على ${mb} ميغابايت.
- **الحركة:** مسموح بها، بأي مدة، وبما لا يزيد على 240 لقطة. من يوقف الحركة يراه صورة ثابتة.
- **التسمية:** كلمات بأحرف لاتينية صغيرة تفصل بينها شرطات، مثل \`desert-night.png\`. يسمّي استوديو المصممين التصميم باسم الملف، ويمكنك تغييره هناك.
- **القواعد:** عملك أنت، دون رسوم منسوخة أو شعارات أو نصوص أو حروف، ودون أي محتوى يحض على الكراهية.

أخفِ كل طبقات القالب قبل التصدير. الملف \`example-frame.png\` إطار مكتمل يجتاز كل الفحوص. ارفع إطارك من: التصاميم ← استوديو المصممين ← تصميم جديد ← إطار البطاقة.

## Deutsch

Ein Profilrahmen ist ein Bild, still oder bewegt, das um deine Profilkarte gelegt wird. Zeichne ihn auf dieser Vorlage.

- **Fläche:** genau ${FILE.width} × ${FILE.height} px (der Server nimmt keine andere Größe an).
- **Karte:** ${CARD.left},${CARD.top} bis ${CARD.right},${CARD.bottom} (${CARD.right - CARD.left} × ${CARD.bottom - CARD.top} px).
- **Platz für Kunst:** ${CARD.top} px über der Karte, ${CARD.left} px daneben, ${FILE.height - CARD.bottom} px darunter, dazu ein ${SAFE.left - CARD.left}-px-Band direkt innerhalb ihres Rands.
- **Schutzzone, in jedem Einzelbild vollständig transparent lassen:** ${SAFE.left},${SAFE.top} bis ${SAFE.right},${SAFE.bottom}. Ein Pixel gilt ab Alpha ${ALPHA_LIMIT} von 255 als gezeichnet.
- **Wappenfenster, darf bemalt werden:** ${CREST.left},${CREST.top} bis ${CREST.right},${CREST.bottom}, über der Mitte des Banners.
- **Dehnung:** Die oberen ${FIXED.top} px und die unteren ${FILE.height - FIXED.bottom} px erscheinen wie gezeichnet; die Seiten dazwischen dehnen sich mit der Kartenhöhe. Halte die Seiten schlicht.
- **Pixelraster:** Zeichne in Blöcken von ${BLOCK} × ${BLOCK} Datei-px, gezählt ab der Kartenecke (${CARD.left},${CARD.top}). Ein Block erscheint auf einer 340 px breiten Karte als 4 px.
- **Datei:** PNG, animiertes PNG, WebP oder GIF, transparenter Hintergrund, höchstens ${mb} MB.
- **Animation:** erlaubt, beliebig lang, höchstens 240 Einzelbilder. Wer Bewegung ausschaltet, sieht ein Standbild.
- **Benennung:** kleine Wörter mit Bindestrichen, etwa \`desert-night.png\`. Das Creator-Studio benennt das Design nach der Datei; du kannst den Namen dort ändern.
- **Regeln:** eigene Arbeit, keine kopierte Kunst, keine Logos, keine Texte oder Buchstaben, nichts Hasserfülltes.

Blende vor dem Export alle Ebenen der Vorlage aus. \`example-frame.png\` ist ein fertiger Rahmen, der alle Prüfungen besteht. Hochladen unter Designs → Creator-Studio → Neues Design → Profilrahmen.

---

Zrzur frame kit, part of the Zrzur web app (AGPL-3.0). The template, the example and the palette are original to Zrzur.
`;
}

/* ------------------------------------------------------------------ */
/* Zip (stored, fixed dates)                                            */
/* ------------------------------------------------------------------ */

/** 2026-11-25 00:00 in DOS time, the same in every build */
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (11 << 5) | 25;

export function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [path, body] of files) {
    const name = Buffer.from(path, "utf8");
    const crc = crc32(body);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/** Every file of the kit, by name, as bytes */
export function frameKitFiles() {
  const inZip = [
    ["README.md", Buffer.from(readme(), "utf8")],
    ["template.svg", Buffer.from(templateSvg(), "utf8")],
    ["template.png", encodePng(templateRaster())],
    ["example-frame.png", encodePng(exampleFrame())],
    ["palette.json", Buffer.from(paletteJson(), "utf8")],
    ["palette.ase", paletteAse()],
  ];
  return new Map([
    ...inZip,
    [
      "zrzur-frame-kit.zip",
      zip(inZip.map(([name, body]) => [`zrzur-frame-kit/${name}`, body])),
    ],
  ]);
}

export const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../public/frame-kit",
);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const example = exampleFrame();
  const covered = coveredPixels(example.data);
  if (covered) throw new Error(`the example covers ${covered} px of the card`);
  mkdirSync(OUT, { recursive: true });
  for (const [name, body] of frameKitFiles()) {
    writeFileSync(join(OUT, name), body);
    console.log(`${name}  ${body.length.toLocaleString("en")} bytes`);
  }
}
