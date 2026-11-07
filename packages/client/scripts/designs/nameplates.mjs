/**
 * Draws Zrzur's built-in zodiac and theme nameplates as small SVG files in
 * public/nameplates. Run: node scripts/designs/nameplates.mjs
 * Country plates are built by flags.mjs.
 *
 * Everything here is original to Zrzur (AGPL-3.0): the signs are our own line
 * drawings, and no outside file is opened, traced or sampled.
 *
 * The art is drawn with its emblem on the left, which is how a right-to-left
 * row wants it: the name sits on the right and the emblem stays free. The
 * plain address flips it, so a left-to-right row gets the emblem on its right.
 * `file.svg#rtl` shows the unflipped art.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../public/nameplates",
);

const W = 560;
const H = 88;
/** Where an emblem sits: away from the name */
const E = 124;
const CY = H / 2;

const n = (value) => +value.toFixed(1);

const rect = (x, y, w, h, fill) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"/>`;

/** A crescent opening to the right */
function crescent(cx, cy, R, r, dx, fill) {
  const x0 = (dx * dx + R * R - r * r) / (2 * dx);
  const y0 = Math.sqrt(R * R - x0 * x0);
  const top = `${n(cx + x0)} ${n(cy - y0)}`;
  const bottom = `${n(cx + x0)} ${n(cy + y0)}`;
  const large = x0 > dx ? 1 : 0;
  return `<path d="M${top}A${R} ${R} 0 1 0 ${bottom}A${r} ${r} 0 ${large} 1 ${top}Z" fill="${fill}"/>`;
}

const circle = (cx, cy, r, fill, extra = "") =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}"${extra}/>`;

/** A group that stays the right way round when the plate is flipped */
const keep = (art) => `<g class="k">${art}</g>`;

/** One plate: the art is flipped unless the address ends in #rtl */
function plate(art, finish = "", flip = true) {
  // every plate is 448 x 84: the middle of the art, drawn 560 x 88
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="448" height="84" viewBox="56 2 448 84">`;
  if (!flip) return `${open}${art}${finish}</svg>`;
  // `.k` keeps what must never read backwards the right way round
  const keeps = art.includes('class="k"')
    ? `.k{transform-box:fill-box;transform-origin:center;transform:scaleX(-1)}#rtl:target~#a .k{transform:none}`
    : "";
  return (
    open +
    `<style>#a{transform:translateX(${W}px) scaleX(-1)}#rtl:target~#a{transform:none}${keeps}</style>` +
    `<g id="rtl"/><g id="a">${art}${finish}</g></svg>`
  );
}

/* ---------- zodiac ---------- */

/** Our own line drawings of the twelve signs, in a 64 box */
const ZODIAC = {
  aries: [
    "M32 54V26C32 14 22 9 16 13C10 17 11 26 18 27M32 26C32 14 42 9 48 13C54 17 53 26 46 27",
    ["#3A0F2E", "#7C1D3C"],
  ],
  taurus: [
    "M14 9C16 21 24 26 32 26C40 26 48 21 50 9M17.5 40.5A14.5 14.5 0 1 0 46.5 40.5A14.5 14.5 0 1 0 17.5 40.5",
    ["#10302A", "#1E6A55"],
  ],
  gemini: [
    "M13 12C23 18 41 18 51 12M13 52C23 46 41 46 51 52M25 16.5V47.5M39 16.5V47.5",
    ["#152550", "#2F5D9B"],
  ],
  cancer: [
    "M15 24A7.5 7.5 0 1 0 30 24A7.5 7.5 0 1 0 15 24M15.5 21C22 10 42 10 52 18M34 40A7.5 7.5 0 1 0 49 40A7.5 7.5 0 1 0 34 40M48.5 43C42 54 22 54 12 46",
    ["#1A1A55", "#3E3E9E"],
  ],
  leo: [
    "M13 36A8 8 0 1 0 29 36A8 8 0 1 0 13 36M27 31C20 19 25 9 36 9C47 9 49 20 44.5 28C40 36 38 44 42 50C45 54 50 53 52 49",
    ["#431607", "#A5461A"],
  ],
  virgo: [
    "M11 15C15 13 18 16 18 21V47M18 22C20 14 29 14 29 22V47M29 22C31 14 40 14 40 22V44C40 50 44 54 50 56M40 29C45 21 54 25 52 34C50 42 42 48 34 53",
    ["#26321A", "#54723A"],
  ],
  libra: [
    "M10 51H54M10 41H24C17 34 18 19 32 19C46 19 47 34 40 41H54",
    ["#23204D", "#5A4C9F"],
  ],
  scorpio: [
    "M10 15C14 13 17 16 17 21V47M17 22C19 14 28 14 28 22V47M28 22C30 14 39 14 39 22V43C39 51 46 53 53 46M47 44.5L53.5 45.5L52.5 52",
    ["#3C0D29", "#83204F"],
  ],
  sagittarius: ["M12 52L51 13M30 13H51V34M17 31L33 47", ["#3C1A07", "#8F4A17"]],
  capricorn: [
    "M10 13C15 13 18 17 18 24V42M18 24C20 13 33 13 33 24V45C33 52 29 56 22 56M33 42C35 31 50 31 50 42C50 53 35 53 33 42",
    ["#1E2A1E", "#4F5F3A"],
  ],
  aquarius: [
    "M9 27L18 19L27 27L36 19L45 27L54 19M9 44L18 36L27 44L36 36L45 44L54 36",
    ["#0F2C4F", "#1F6E9E"],
  ],
  pisces: [
    "M15 9C26 21 26 43 15 55M49 9C38 21 38 43 49 55M11 32H53",
    ["#132A58", "#3B4FA3"],
  ],
};

/** A repeatable random sequence, so a run always gives the same art */
function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function nightSky(seed, count) {
  const random = seeded(seed);
  let dots = "";
  for (let i = 0; i < count; i++) {
    dots += circle(
      random() * W,
      random() * H,
      0.7 + random() * 1.1,
      "#fff",
      ` opacity="${n(0.25 + random() * 0.6)}"`,
    );
  }
  return dots;
}

function zodiac([glyph, [deep, lit]], index) {
  const random = seeded(index * 977 + 13);
  // a small made-up constellation of dots and lines beside the sign
  const walk = [];
  let x = 196;
  for (let i = 0; i < 6; i++) {
    walk.push([x, 16 + random() * 56]);
    x += 34 + random() * 26;
  }
  const line = `<path d="M${walk.map(([a, b]) => `${n(a)} ${n(b)}`).join("L")}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1"/>`;
  const nodes = walk
    .map(
      ([a, b]) =>
        circle(a, b, 2.2, "#FFE7B0") +
        circle(a, b, 5, "#FFE7B0", ' opacity=".16"'),
    )
    .join("");
  return (
    `<defs>` +
    `<linearGradient id="b"><stop stop-color="${lit}"/><stop offset=".55" stop-color="${deep}"/><stop offset="1" stop-color="#0D0E16"/></linearGradient>` +
    `<radialGradient id="h"><stop stop-color="#FFE7B0" stop-opacity=".34"/><stop offset="1" stop-color="#FFE7B0" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="z" x2="0" y2="1"><stop stop-color="#FFF3D1"/><stop offset="1" stop-color="#F0BD5E"/></linearGradient>` +
    `</defs>` +
    rect(0, 0, W, H, "url(#b)") +
    nightSky(index + 7, 42) +
    circle(E - 12, CY, 58, "url(#h)") +
    line +
    nodes +
    keep(
      `<path transform="translate(${E - 44} ${CY - 32})" d="${glyph}" fill="none" stroke="url(#z)" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
  );
}

/* ---------- plain themes ---------- */

/** A closed band that repeats exactly every `W`: `y` is its wave */
function wave(y, height, cycles, phase, top = true) {
  const points = [];
  for (let x = 0; x <= W; x += 14) {
    const a = (x / W) * Math.PI * 2 * cycles + phase;
    points.push([
      x,
      y + Math.sin(a) * height + Math.sin(a * 2 + 1) * height * 0.3,
    ]);
  }
  const edge = top ? H + 2 : -2;
  return `M0 ${edge}L${points.map(([a, b]) => `${n(a)} ${n(b)}`).join("L")}L${W} ${edge}Z`;
}

const blur = (id, amount) =>
  `<filter id="${id}" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="${amount}"/></filter>`;

function gradient(id, stops, vertical = false) {
  const list = stops
    .map(
      ([offset, colour, opacity]) =>
        `<stop offset="${offset}" stop-color="${colour}"${opacity === undefined ? "" : ` stop-opacity="${opacity}"`}/>`,
    )
    .join("");
  return `<linearGradient id="${id}"${vertical ? ' x2="0" y2="1"' : ""}>${list}</linearGradient>`;
}

/** One small leaf or petal, pointing up, centred on the origin */
const LEAF = "M0-10C6-6 7 2 0 10C-7 2-6-6 0-10Z";
const PETAL = "M0-8C5-8 8-3 5 2C3 6 1 8 0 8C-1 8-3 6-5 2C-8-3-5-8 0-8Z";

function scatter(
  seed,
  count,
  shape,
  colours,
  scale = [0.6, 1.1],
  area = [0, W],
) {
  const random = seeded(seed);
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = area[0] + random() * (area[1] - area[0]);
    const y = 8 + random() * 72;
    const size = scale[0] + random() * (scale[1] - scale[0]);
    out += `<path transform="translate(${n(x)} ${n(y)}) rotate(${Math.round(random() * 360)}) scale(${n(size)})" d="${shape}" fill="${colours[i % colours.length]}" opacity="${n(0.55 + random() * 0.45)}"/>`;
  }
  return out;
}

function wavePath(y, height, cycles, phase) {
  const points = [];
  for (let x = 0; x <= W; x += 14) {
    points.push([
      x,
      y + Math.sin((x / W) * Math.PI * 2 * cycles + phase) * height,
    ]);
  }
  return `M${points.map(([a, b]) => `${n(a)} ${n(b)}`).join("L")}`;
}

function cloud(x, y, scale, opacity) {
  const blob = (dx, dy, r) =>
    circle(x + dx * scale, y + dy * scale, r * scale, "#fff");
  return (
    `<g opacity="${opacity}">` +
    blob(-30, 8, 14) +
    blob(-12, 0, 20) +
    blob(12, -4, 24) +
    blob(36, 6, 16) +
    `<rect x="${n(x - 44 * scale)}" y="${n(y + 6 * scale)}" width="${n(92 * scale)}" height="${n(16 * scale)}" rx="${n(8 * scale)}" fill="#fff"/>` +
    `</g>`
  );
}

/** Art and a slow layer that repeats every width */
const THEMES = {
  aurora: {
    art:
      `<defs>` +
      gradient("b", [
        [0, "#071B2E"],
        [0.55, "#0B2E3E"],
        [1, "#10183A"],
      ]) +
      blur("s", 7) +
      `</defs>` +
      rect(0, 0, W, H, "url(#b)") +
      nightSky(3, 34) +
      `<g filter="url(#s)"><path d="${wave(36, 15, 2, 0.4, false)}" fill="#2FE6A8" opacity=".8"/><path d="${wave(56, 16, 3, 2, false)}" fill="#3BB8E8" opacity=".42"/><path d="${wave(24, 9, 3, 4, false)}" fill="#B58CFF" opacity=".4"/></g>`,
    motion:
      `<defs>${blur("s", 6)}</defs><g filter="url(#s)">` +
      `<path d="${wave(34, 14, 2, 1.8, false)}" fill="#7CF5C8" opacity=".5"/>` +
      `<path d="${wave(22, 10, 3, 0.2, false)}" fill="#B58CFF" opacity=".36"/></g>`,
  },
  autumn: {
    art:
      `<defs>` +
      gradient("b", [
        [0, "#D9791F"],
        [0.5, "#A83F16"],
        [1, "#3E1711"],
      ]) +
      `</defs>` +
      rect(0, 0, W, H, "url(#b)") +
      `<path d="${wave(70, 7, 2, 1)}" fill="#5A1F12" opacity=".55"/>` +
      scatter(
        11,
        24,
        LEAF,
        ["#FFC24B", "#F2802E", "#E2552B", "#FFE08A"],
        [0.7, 1.25],
        [0, 420],
      ),
    motion: scatter(17, 10, LEAF, ["#FFD479", "#F2802E"], [0.6, 1]),
  },
  sakura: {
    art:
      `<defs>` +
      gradient("b", [
        [0, "#FFC2D6"],
        [0.5, "#D9608E"],
        [1, "#4A1D3F"],
      ]) +
      `</defs>` +
      rect(0, 0, W, H, "url(#b)") +
      `<path d="M-6 8C40 30 96 26 150 46S240 62 290 88" fill="none" stroke="#3A1626" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M78 28C100 18 120 18 142 8M160 50C176 36 200 34 222 22" fill="none" stroke="#3A1626" stroke-width="3" stroke-linecap="round"/>` +
      [
        [34, 22],
        [66, 36],
        [92, 20],
        [122, 16],
        [146, 34],
        [178, 40],
        [206, 28],
        [226, 54],
        [120, 50],
        [250, 70],
      ]
        .map(
          ([x, y]) =>
            `<g transform="translate(${x} ${y})">` +
            [0, 72, 144, 216, 288]
              .map(
                (a) =>
                  `<path transform="rotate(${a}) translate(0 -5.4) scale(.62)" d="${PETAL}" fill="#FFE3EC"/>`,
              )
              .join("") +
            circle(0, 0, 2, "#E0457B") +
            `</g>`,
        )
        .join("") +
      scatter(23, 16, PETAL, ["#FFE3EC", "#FFC2D6"], [0.35, 0.6], [260, 560]),
    motion: scatter(29, 12, PETAL, ["#FFF0F5", "#FFC2D6"], [0.35, 0.6]),
  },
  ocean: {
    art:
      `<defs>` +
      gradient("b", [
        [0, "#4FC3E0"],
        [0.5, "#12719C"],
        [1, "#082F55"],
      ]) +
      `</defs>` +
      rect(0, 0, W, H, "url(#b)") +
      `<path d="${wave(42, 6, 2, 0.6)}" fill="#1C8FB8" opacity=".55"/>` +
      `<path d="${wave(54, 6, 3, 0)}" fill="#0E5F8C" opacity=".75"/>` +
      `<path d="${wavePath(54, 6, 3, 0)}" fill="none" stroke="#D6F6FF" stroke-opacity=".45" stroke-width="1.4"/>` +
      `<path d="${wave(68, 5, 4, 1.4)}" fill="#0A4A78" opacity=".9"/>` +
      `<path d="${wavePath(68, 5, 4, 1.4)}" fill="none" stroke="#D6F6FF" stroke-opacity=".3" stroke-width="1.2"/>`,
    motion:
      `<path d="${wave(46, 5, 3, 2.2)}" fill="#BDEBFF" opacity=".16"/>` +
      `<path d="${wave(72, 4, 4, 0.4)}" fill="#072E52" opacity=".6"/>`,
  },
  clouds: {
    art:
      `<defs>` +
      gradient("b", [
        [0, "#3C8BD9"],
        [0.55, "#6DB2EA"],
        [1, "#BEE3F7"],
      ]) +
      blur("s", 1.4) +
      `</defs>` +
      rect(0, 0, W, H, "url(#b)") +
      `<g filter="url(#s)" fill="#fff">` +
      cloud(110, 58, 1.2, 0.95) +
      cloud(270, 40, 0.8, 0.7) +
      cloud(420, 66, 1.05, 0.85) +
      `</g>`,
    motion:
      `<defs>${blur("s", 1.6)}</defs><g filter="url(#s)" fill="#fff">` +
      cloud(190, 26, 0.6, 0.55) +
      cloud(480, 30, 0.7, 0.6) +
      `</g>`,
  },
  sunset: {
    art:
      `<defs>` +
      gradient("b", [
        [0, "#F7B05C"],
        [0.5, "#E8567A"],
        [1, "#3A1F6E"],
      ]) +
      `<radialGradient id="h"><stop stop-color="#FFF1BD" stop-opacity=".8"/><stop offset="1" stop-color="#FFF1BD" stop-opacity="0"/></radialGradient>` +
      `</defs>` +
      rect(0, 0, W, H, "url(#b)") +
      circle(E, 64, 62, "url(#h)") +
      circle(E, 64, 26, "#FFE9A8") +
      `<path d="${wave(70, 5, 2, 0.8)}" fill="#5A2466"/>` +
      `<path d="${wave(78, 4, 3, 2)}" fill="#2E1450"/>`,
    motion: `<path d="${wave(26, 4, 2, 1)}" fill="#FFD9A8" opacity=".1"/><path d="${wave(70, 5, 2, 2.6)}" fill="#7A2F7E" opacity=".35"/>`,
  },
  midnight: {
    art:
      `<defs>` +
      gradient("b", [
        [0, "#0B1033"],
        [0.5, "#121C5C"],
        [1, "#080B22"],
      ]) +
      `<radialGradient id="h"><stop stop-color="#DDE6FF" stop-opacity=".3"/><stop offset="1" stop-color="#DDE6FF" stop-opacity="0"/></radialGradient>` +
      `</defs>` +
      rect(0, 0, W, H, "url(#b)") +
      nightSky(41, 70) +
      circle(E, CY, 52, "url(#h)") +
      keep(crescent(E - 4, CY, 22, 19, 8, "#F4F1DE")),
    motion: nightSky(59, 26),
  },
  mint: {
    art:
      `<defs>` +
      gradient("b", [
        [0, "#BDF5DD"],
        [0.5, "#3CC9A4"],
        [1, "#0E5A5A"],
      ]) +
      `</defs>` +
      rect(0, 0, W, H, "url(#b)") +
      [0, 1, 2, 3, 4]
        .map(
          (i) =>
            `<path d="${wavePath(22 + i * 11, 6, 2, i * 0.7)}" fill="none" stroke="#fff" stroke-opacity="${n(0.5 - i * 0.07)}" stroke-width="1.6"/>`,
        )
        .join(""),
    motion: [0, 1]
      .map(
        (i) =>
          `<path d="${wavePath(34 + i * 18, 7, 2, 2 + i)}" fill="none" stroke="#E9FFF6" stroke-opacity=".5" stroke-width="1.6"/>`,
      )
      .join(""),
  },
};

/* ---------- write ---------- */

mkdirSync(join(OUT, "motion"), { recursive: true });

const put = (name, svg) => writeFileSync(join(OUT, name), svg);

Object.entries(ZODIAC).forEach(([id, sign], index) => {
  put(`zodiac-${id}.svg`, plate(zodiac(sign, index + 1)));
});
for (const [id, theme] of Object.entries(THEMES)) {
  put(`${id}.svg`, plate(theme.art));
  put(
    `motion/${id}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${theme.motion}</svg>`,
  );
}

console.log(
  `${Object.keys(ZODIAC).length} signs, ${Object.keys(THEMES).length} themes`,
);
