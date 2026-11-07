/**
 * Draws Zrzur's built-in avatar frames as SVG files in public/decorations.
 * Run: node scripts/designs/decorations.mjs
 *
 * All original to Zrzur (AGPL-3.0), drawn here in code; nothing is traced or
 * adapted from any file. The canvas is 120 wide and the avatar is the middle
 * 80, so everything stays outside radius 38 and the face is never covered.
 * Shapes are at least 2.5 units thick: a frame around a 32 px avatar is drawn
 * at 0.4 px per unit and has to hold up there.
 *
 * Still by default. Motion runs only in `file.svg#play` (`svg:target`), which
 * the app asks for on hover or in a preview, so a list of avatars costs
 * nothing and reduced motion simply never asks for it.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../public/decorations",
);

const n = (value) => +value.toFixed(1);

/** A point `r` from the centre, `a` degrees clockwise from the top */
function at(r, a) {
  const t = ((a - 90) * Math.PI) / 180;
  return [60 + Math.cos(t) * r, 60 + Math.sin(t) * r];
}
const xy = ([x, y]) => `${n(x)} ${n(y)}`;
const range = (count) => [...Array(count).keys()];

function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function linear(id, stops, from = [0, 0], to = [0, 1]) {
  return `<linearGradient id="${id}" x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}">${stops
    .map(
      (colour, i) =>
        `<stop offset="${n(i / (stops.length - 1))}" stop-color="${colour}"/>`,
    )
    .join("")}</linearGradient>`;
}

const ring = (r, stroke, width, extra = "") =>
  `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${stroke}" stroke-width="${width}"${extra}/>`;

/** An arc along the frame, clockwise from `a` to `b` */
function arc(r, a, b) {
  const large = (b - a + 360) % 360 > 180 ? 1 : 0;
  return `M${xy(at(r, a))}A${r} ${r} 0 ${large} 1 ${xy(at(r, b))}`;
}

const place = (r, a, turn = 0, scale = 1) => {
  const [x, y] = at(r, a);
  return `translate(${n(x)} ${n(y)}) rotate(${n(a + turn)})${scale === 1 ? "" : ` scale(${n(scale)})`}`;
};

const leafShape = (l, w) =>
  `M0 ${n(-l / 2)}C${n(w / 2)} ${n(-l / 4)} ${n(w / 2)} ${n(l / 4)} 0 ${n(l / 2)}C${n(-w / 2)} ${n(l / 4)} ${n(-w / 2)} ${n(-l / 4)} 0 ${n(-l / 2)}Z`;

function star4(x, y, r, fill, extra = "") {
  const k = r * 0.2;
  return `<path d="M${n(x)} ${n(y - r)}Q${n(x + k)} ${n(y - k)} ${n(x + r)} ${n(y)}Q${n(x + k)} ${n(y + k)} ${n(x)} ${n(y + r)}Q${n(x - k)} ${n(y + k)} ${n(x - r)} ${n(y)}Q${n(x - k)} ${n(y - k)} ${n(x)} ${n(y - r)}Z" fill="${fill}"${extra}/>`;
}

const heartShape = (s) =>
  `M0 ${n(s * 0.9)}C${n(-s * 1.5)} ${n(-s * 0.1)} ${n(-s * 0.8)} ${n(-s * 1.1)} 0 ${n(-s * 0.35)}C${n(s * 0.8)} ${n(-s * 1.1)} ${n(s * 1.5)} ${n(-s * 0.1)} 0 ${n(s * 0.9)}Z`;

/** Motion, only under #play. `name: [keyframes, how it runs]` */
const MOTION = {
  spin: ["to{transform:rotate(360deg)}", "28s linear infinite"],
  slow: ["to{transform:rotate(360deg)}", "64s linear infinite"],
  rev: ["to{transform:rotate(-360deg)}", "44s linear infinite"],
  breathe: ["50%{opacity:.62}", "4s ease-in-out infinite"],
  glint: ["50%{opacity:.45}", "2.8s ease-in-out infinite"],
  glint2: ["50%{opacity:.45}", "2.8s ease-in-out -1.4s infinite"],
  sway: ["50%{transform:rotate(1.6deg)}", "5s ease-in-out infinite"],
  swayb: ["50%{transform:rotate(-1.6deg)}", "5s ease-in-out infinite"],
  lift: ["50%{transform:translateY(-1.6px)}", "3.6s ease-in-out infinite"],
  liftb: [
    "50%{transform:translateY(1.6px)}",
    "3.6s ease-in-out -1.8s infinite",
  ],
  flick: ["50%{transform:scale(1.025);opacity:.8}", "1.6s ease-in-out infinite"],
  flickb: [
    "50%{transform:scale(.985);opacity:.85}",
    "1.3s ease-in-out infinite",
  ],
  run: ["to{stroke-dashoffset:-92}", "4.8s linear infinite"],
};

function file(defs, body) {
  const used = Object.keys(MOTION).filter((name) =>
    new RegExp(`class="[^"]*\\b${name}\\b`).test(body),
  );
  const style = used
    .map(
      (name) =>
        `@keyframes ${name}{${MOTION[name][0]}}svg:target .${name}{animation:${name} ${MOTION[name][1]}}`,
    )
    .join("");
  // only what moves: an origin on anything else would bend `transform` attributes
  const origin = used.length
    ? `<style>${used.map((name) => `.${name}`).join()}{transform-origin:60px 60px}${style}</style>`
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" id="play" viewBox="0 0 120 120">${origin}` +
    (defs ? `<defs>${defs}</defs>` : "") +
    body +
    `</svg>`
  );
}

const GOLD = ["#FFF0B0", "#F2C14E", "#B97A12"];
const INK = "#3A2A10";

/** The frames, one drawing function each */
const FRAMES = {
  laurel() {
    const side = range(9)
      .map((i) => {
        const a = 176 - i * 18;
        const scale = 1 - i * 0.03;
        return (
          `<path transform="${place(54, a, -62, scale)}" d="${leafShape(15, 7)}" fill="url(#l)" stroke="${INK}" stroke-width=".9"/>` +
          `<path transform="${place(46.5, a - 8, -118, scale)}" d="${leafShape(14, 6.4)}" fill="url(#l)" stroke="${INK}" stroke-width=".9"/>`
        );
      })
      .join("");
    const branch =
      `<path d="${arc(50, 16, 176)}" fill="none" stroke="#8A5A0E" stroke-width="2.2" stroke-linecap="round"/>` +
      side;
    return file(
      linear("l", GOLD, [0, 0], [1, 1]),
      `<g class="sway">${branch}</g><g class="swayb"><g transform="matrix(-1 0 0 1 120 0)">${branch}</g></g>` +
        `<circle cx="60" cy="110" r="4.2" fill="url(#l)" stroke="${INK}" stroke-width=".9"/>` +
        star4(...at(50, 18), 4.5, "#FFF6D2", ' class="glint"') +
        star4(...at(50, 342), 4.5, "#FFF6D2", ' class="glint2"'),
    );
  },

  "light-crown"() {
    const rays = range(15)
      .map((i) => {
        const a = -56 + i * 8;
        const tall = i % 2 === 0;
        const top = tall ? 59 : 50;
        const [p, q] = [at(42, a - 3), at(42, a + 3)];
        return `<path class="${tall ? "glint" : "glint2"}" d="M${xy(p)}L${xy(at(top, a))}L${xy(q)}Z" fill="url(#g)" stroke="#B97A12" stroke-width=".8" stroke-linejoin="round"/>`;
      })
      .join("");
    return file(
      linear("g", ["#FFFFFF", "#FFE27A", "#F2A91F"]),
      ring(43, "#B97A12", 2.6, ' opacity=".7"') +
        ring(43, "#FFE58C", 1.4) +
        `<path d="${arc(42.5, 300, 60)}" fill="none" stroke="#B97A12" stroke-width="5" stroke-linecap="round"/>` +
        `<path d="${arc(42.5, 300, 60)}" fill="none" stroke="#FFD866" stroke-width="3.2" stroke-linecap="round"/>` +
        rays +
        `<circle cx="60" cy="5.5" r="3.4" fill="#FFF7D6" stroke="#B97A12" stroke-width=".8"/>` +
        star4(...at(50, 112), 4.4, "#FFE9A0", ' class="glint" stroke="#B97A12" stroke-width=".7"') +
        star4(...at(50, 248), 4.4, "#FFE9A0", ' class="glint2" stroke="#B97A12" stroke-width=".7"'),
    );
  },

  rings() {
    const bead = (a, r, colour) =>
      `<circle cx="${n(at(49, a)[0])}" cy="${n(at(49, a)[1])}" r="${r}" fill="${colour}" stroke="#2A2038" stroke-width=".8"/>`;
    return file(
      linear("r", ["#FFE3D3", "#E69A84", "#9A4F4A"], [0, 0], [1, 1]) +
        linear("s", ["#F5F7FF", "#AEB6D2", "#5E6684"], [1, 0], [0, 1]),
      ring(44, "#2A2038", 5, ' opacity=".35"') +
        ring(44, "url(#r)", 3.4) +
        `<g class="slow">${ring(49, "url(#s)", 2.6, ' stroke-dasharray="46 16"')}</g>` +
        `<g class="spin">` +
        bead(40, 4, "#FF8FB1") +
        bead(160, 3.2, "#FFD27A") +
        bead(280, 3.6, "#9FD8FF") +
        `</g>` +
        ring(54.5, "url(#r)", 1.6, ' opacity=".7"'),
    );
  },

  ivy() {
    const random = seeded(31);
    const leaf = (a, r, size, turn, colour) =>
      `<path transform="${place(r, a, turn, size)}" d="M0 9L-3 6L-9 7L-6.5 2L-10-3L-4.5-2.5L0-10L4.5-2.5L10-3L6.5 2L9 7L3 6Z" fill="${colour}" stroke="#123B1E" stroke-width="1" stroke-linejoin="round"/>`;
    const greens = ["url(#i)", "#3FA45C", "#7CCB6F", "url(#i)"];
    const leaves = range(15)
      .map((i) => {
        const a = 96 + i * 24 + random() * 6;
        return leaf(
          a,
          i % 2 ? 53 : 45,
          0.72 + random() * 0.28,
          i % 2 ? 24 : 156,
          greens[i % 4],
        );
      })
      .join("");
    const vine = range(49)
      .map((i) => {
        const a = 88 + i * 7.3;
        return xy(at(48 + Math.sin(i * 0.9) * 2.6, a));
      })
      .join("L");
    return file(
      linear("i", ["#A5E58A", "#3C9A52", "#1F6B38"], [0, 0], [1, 1]),
      `<path d="M${vine}" fill="none" stroke="#2C5A2E" stroke-width="2.6" stroke-linecap="round"/>` +
        `<g class="sway">${leaves}</g>`,
    );
  },

  "thorn-roses"() {
    const thorns = range(24)
      .map((i) => {
        const a = i * 15;
        const r = i % 2 ? 48.5 : 43.5;
        const tip = at(i % 2 ? 54 : 39.5, a + 3);
        const [p, q] = [at(r, a - 2.4), at(r, a + 2.4)];
        return `<path d="M${xy(p)}L${xy(tip)}L${xy(q)}Z" fill="#8A5E68" stroke="#23161C" stroke-width=".7"/>`;
      })
      .join("");
    const rose = (a, r, s) => {
      const [x, y] = at(r, a);
      return (
        `<g transform="translate(${n(x)} ${n(y)}) scale(${s})">` +
        `<circle r="11" fill="url(#o)" stroke="#4A0716" stroke-width="1.2"/>` +
        `<path d="M-7-3C-3-9 6-9 8-2C9 4 3 9-3 7C-7 5-7 0-3-2C0-4 4-2 3 1C2 3 0 3-1 2" fill="none" stroke="#5A0A1E" stroke-width="1.8" stroke-linecap="round"/>` +
        `<path d="M-9 6C-13 9-14 12-12 14C-8 15-5 13-4 9Z" fill="#2E6B3C" stroke="#10301B" stroke-width=".9"/>` +
        `</g>`
      );
    };
    return file(
      `<radialGradient id="o" cx=".4" cy=".35" r=".75"><stop stop-color="#FF7A8E"/><stop offset=".55" stop-color="#D21F46"/><stop offset="1" stop-color="#7A0C24"/></radialGradient>`,
      thorns +
        ring(46, "#23161C", 4.6) +
        ring(46, "#8A5E68", 2.8) +
        `<g class="breathe">` +
        rose(222, 47, 1) +
        rose(62, 48, 0.82) +
        rose(150, 50, 0.62) +
        `</g>`,
    );
  },

  "ice-crystal"() {
    const spike = (a, r0, r1, w, cls = "") => {
      const [p, q] = [at(r0, a - w), at(r0, a + w)];
      const tip = at(r1, a);
      return (
        `<path${cls ? ` class="${cls}"` : ""} d="M${xy(p)}L${xy(tip)}L${xy(q)}Z" fill="url(#c)" stroke="#2F6C9E" stroke-width=".9" stroke-linejoin="round"/>` +
        `<path d="M${xy(at(r0, a))}L${xy(tip)}L${xy(q)}Z" fill="#fff" opacity=".42"/>`
      );
    };
    const spikes = range(12)
      .map((i) => {
        const a = i * 30;
        const big = i % 2 === 0;
        return spike(a, 41, big ? 59 : 51, big ? 7.5 : 6.4);
      })
      .join("");
    const small = range(12)
      .map((i) => spike(15 + i * 30, 41, 47, 5))
      .join("");
    return file(
      linear("c", ["#FFFFFF", "#BCE8FF", "#5FB4EA"], [0, 0], [1, 1]),
      ring(42, "#BCE8FF", 3) +
        ring(42, "#2F6C9E", 0.8, ' opacity=".6"') +
        small +
        spikes +
        star4(...at(55, 30), 3.6, "#fff", ' class="glint"') +
        star4(...at(55, 150), 3.6, "#fff", ' class="glint2"') +
        star4(...at(55, 270), 3.6, "#fff", ' class="glint"'),
    );
  },

  "flame-ring"() {
    const random = seeded(77);
    const tongue = (a, r0, r1, w, lean, fill) => {
      const [p, q] = [at(r0, a - w), at(r0, a + w)];
      const tip = at(r1, a + lean);
      const [c1, c2] = [at(r0 + (r1 - r0) * 0.6, a - w * 0.9), at(r0 + (r1 - r0) * 0.6, a + w * 0.9)];
      return `<path d="M${xy(p)}Q${xy(c1)} ${xy(tip)}Q${xy(c2)} ${xy(q)}Z" fill="${fill}"/>`;
    };
    const layer = (count, offset, r0, r1, w, fill, shift) =>
      range(count)
        .map((i) => {
          const tall = 0.8 + random() * 0.25;
          return tongue(
            offset + i * (360 / count),
            r0,
            r0 + (r1 - r0) * tall,
            w,
            shift,
            fill,
          );
        })
        .join("");
    return file(
      linear("f", ["#FFD76A", "#FF7A1A", "#C51F12"], [0.5, 0], [0.5, 1]),
      ring(42, "#7A1208", 4.5) +
        `<g class="flickb">${layer(13, 0, 40, 60, 15, "#D5261A", 6)}</g>` +
        `<g class="flick">${layer(13, 14, 40, 55, 12, "#FF7A1A", -5)}</g>` +
        `<g class="flickb">${layer(13, 7, 40, 49, 9, "#FFD24A", 4)}</g>` +
        ring(40.5, "#FFE9A8", 1.8),
    );
  },

  lightning() {
    const bolt = (a, turn, scale, cls) =>
      `<g class="${cls}"><path transform="${place(51, a, turn, scale)}" d="M-2-17H7L2-4H9L-6 18L-2 3H-9Z" fill="url(#y)" stroke="#2B1C8F" stroke-width="1.2" stroke-linejoin="round"/></g>`;
    const crackle = (start) =>
      `<path d="M${range(7)
        .map((i) => xy(at(i % 2 ? 50.5 : 46.5, start + i * 6)))
        .join("L")}" fill="none" stroke="#8E7CF0" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`;
    return file(
      linear("e", ["#B7A6FF", "#6A4DF0", "#3A22B8"], [0, 0], [1, 1]) +
        linear("y", ["#FFFFFF", "#FFF0A0", "#FFC93C"]),
      ring(43, "#2B1C8F", 5, ' opacity=".5"') +
        ring(43, "url(#e)", 3.2) +
        crackle(68) +
        crackle(190) +
        crackle(310) +
        bolt(38, 24, 1.05, "glint") +
        bolt(158, 24, 0.9, "glint2") +
        bolt(278, 24, 1, "glint"),
    );
  },

  "moon-halo"() {
    const stars = [
      [150, 53, 3.8],
      [205, 50, 2.8],
      [260, 54, 3.4],
      [315, 50, 2.6],
      [105, 52, 2.6],
    ]
      .map(([a, r, size]) =>
        star4(...at(r, a), size, "#E9EDFF", ' stroke="#3E467E" stroke-width=".7"'),
      )
      .join("");
    const [mx, my] = at(45, 45);
    return file(
      linear("h", ["#F7F4DF", "#C7CCF2", "#6E76B8"], [0, 0], [1, 1]) +
        linear("m", ["#FFF9E0", "#E8D79A"], [0, 0], [1, 1]),
      ring(44, "#3E467E", 5, ' opacity=".45"') +
        ring(44, "url(#h)", 3.2) +
        ring(50, "#8E96D6", 1.6, ' stroke-dasharray="2 7" stroke-linecap="round"') +
        `<g class="rev">${stars}</g>` +
        `<path transform="translate(${n(mx)} ${n(my)}) rotate(-28)" d="M5-14.5A15.4 15.4 0 1 0 5 14.5A18 18 0 0 1 5-14.5Z" fill="url(#m)" stroke="#6E6A3A" stroke-width="1"/>`,
    );
  },

  "sun-rays"() {
    const rays = range(24)
      .map((i) => {
        const a = i * 15;
        const long = i % 2 === 0;
        const [p, q] = [at(43, a - (long ? 6 : 4.5)), at(43, a + (long ? 6 : 4.5))];
        return `<path d="M${xy(p)}L${xy(at(long ? 59 : 51, a))}L${xy(q)}Z" fill="${long ? "url(#s)" : "#FFB82E"}"/>`;
      })
      .join("");
    return file(
      linear("s", ["#FFF2B0", "#FFC93C", "#F08A12"], [0.5, 0], [0.5, 1]) +
        linear("r", ["#FFF2B0", "#E98F16"], [0, 0], [1, 1]),
      `<g class="slow">${rays}</g>` +
        ring(42.5, "#B05F08", 4.6) +
        ring(42.5, "url(#r)", 3),
    );
  },

  "star-orbit"() {
    const star = ([a, r, size, cls]) =>
      star4(...at(r, a), size, "url(#t)", ` stroke="#3A2A70" stroke-width=".7"${cls ? ` class="${cls}"` : ""}`);
    const stars = [
      [20, 50, 7.5, ""],
      [88, 50, 4, "glint"],
      [150, 50, 6, ""],
      [212, 50, 3.6, "glint2"],
      [276, 50, 7, ""],
      [330, 50, 3.8, "glint"],
    ]
      .map(star)
      .join("");
    return file(
      linear("o", ["#D7C8FF", "#7C63E8", "#3A2A9E"], [0, 0], [1, 1]) +
        linear("t", ["#FFFFFF", "#FFD97A"], [0, 0], [1, 1]),
      ring(44, "url(#o)", 2.6) +
        ring(50, "#8D79F0", 1.6, ' opacity=".8"') +
        `<g class="spin">${stars}</g>`,
    );
  },

  "sakura-branch"() {
    const blossom = (a, r, s) => {
      const [x, y] = at(r, a);
      const petals = range(5)
        .map(
          (i) =>
            `<path transform="rotate(${i * 72})" d="M0-1.5C-4.6-3.6-5-9 -1.2-11L0-9.6L1.2-11C5-9 4.6-3.6 0-1.5Z" fill="url(#p)" stroke="#B83A72" stroke-width=".7"/>`,
        )
        .join("");
      return `<g transform="translate(${n(x)} ${n(y)}) scale(${s})">${petals}<circle r="2.2" fill="#FFD36E"/></g>`;
    };
    const petal = (x, y, turn, cls) =>
      `<g class="${cls}"><path transform="translate(${x} ${y}) rotate(${turn})" d="M0-4C3-3 3.4 1 0 4C-3.4 1-3-3 0-4Z" fill="#FFC2D9" stroke="#B83A72" stroke-width=".5"/></g>`;
    return file(
      linear("p", ["#FFF1F6", "#FFB3CF", "#F2709F"], [0.5, 0], [0.5, 1]),
      `<path d="${arc(49, 128, 356)}" fill="none" stroke="#4A2A22" stroke-width="3.4" stroke-linecap="round"/>` +
        `<path d="M${xy(at(49, 190))}L${xy(at(57, 176))}M${xy(at(49, 300))}L${xy(at(57, 316))}M${xy(at(49, 250))}L${xy(at(42, 236))}" fill="none" stroke="#4A2A22" stroke-width="2.2" stroke-linecap="round"/>` +
        `<g class="sway">` +
        blossom(150, 50, 0.95) +
        blossom(180, 55, 0.72) +
        blossom(214, 49, 1.05) +
        blossom(250, 52, 0.82) +
        blossom(286, 49, 1) +
        blossom(322, 53, 0.78) +
        blossom(350, 48, 0.82) +
        `</g>` +
        petal(97, 82, 30, "lift") +
        petal(106, 62, 110, "liftb") +
        petal(94, 28, 70, "lift"),
    );
  },

  "geometric-hex"() {
    const hex = (r, turn) =>
      `M${range(6)
        .map((i) => xy(at(r, i * 60 + turn)))
        .join("L")}Z`;
    const nodes = range(6)
      .map((i) => {
        const [x, y] = at(58, i * 60 + 30);
        return `<circle cx="${n(x)}" cy="${n(y)}" r="3.2" fill="#E6FBFF" stroke="#1F5F8F" stroke-width="1"/>`;
      })
      .join("");
    return file(
      linear("h", ["#7FE8FF", "#5E7DF0", "#B46BFF"], [0, 0], [1, 1]),
      `<path d="${hex(58, 30)}" fill="none" stroke="#14233F" stroke-width="5.4" stroke-linejoin="round" opacity=".5"/>` +
        `<path d="${hex(58, 30)}" fill="none" stroke="url(#h)" stroke-width="3.2" stroke-linejoin="round"/>` +
        `<path d="${hex(51, 0)}" fill="none" stroke="url(#h)" stroke-width="1.6" stroke-linejoin="round" opacity=".85"/>` +
        `<g class="slow">${ring(44, "url(#h)", 2, ' stroke-dasharray="18 7.5"')}</g>` +
        nodes,
    );
  },

  neon() {
    return file(
      linear("n", ["#FF4FA3", "#FF4FA3", "#4DF0C8"], [0, 0], [1, 1]) +
        `<filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2"/></filter>`,
      `<g class="breathe">${ring(46, "url(#n)", 6, ' filter="url(#b)"')}</g>` +
        ring(46, "#1A0F24", 5.4, ' opacity=".45"') +
        ring(46, "url(#n)", 3.6) +
        ring(46, "#fff", 1.2, ' opacity=".85"') +
        `<g class="spin">${ring(53, "url(#n)", 2.4, ' stroke-dasharray="26 24 8 24" stroke-linecap="round"')}</g>`,
    );
  },

  wings() {
    const feather = (angle, length, width, fill) =>
      `<path transform="translate(95 86) rotate(${angle})" d="M0 0C${width} ${n(-length * 0.35)} ${width} ${n(-length * 0.8)} 0 ${-length}C${-width * 0.7} ${n(-length * 0.7)} ${-width * 0.7} ${n(-length * 0.3)} 0 0Z" fill="${fill}" stroke="#4A5578" stroke-width=".9"/>`;
    const wing = [
      [64, 25, 5.6],
      [52, 32, 6],
      [40, 40, 6.2],
      [28, 48, 6.4],
      [16, 53, 6.4],
      [4, 55, 6.2],
    ]
      .map(([a, l, w]) => feather(a, l, w, "url(#w)"))
      .join("");
    const coverts = [
      [48, 17],
      [30, 22],
      [12, 26],
    ]
      .map(([a, l]) => feather(a, l, 4.6, "#F7F9FF"))
      .join("");
    const side = `<path d="M84 104C94 100 102 92 104 84" fill="none" stroke="#4A5578" stroke-width="2.6" stroke-linecap="round"/>${wing}${coverts}`;
    return file(
      linear("w", ["#FFFFFF", "#DCE3FA", "#9FB0E4"], [0, 0], [0, 1]),
      `<g class="sway">${side}</g><g class="swayb"><g transform="matrix(-1 0 0 1 120 0)">${side}</g></g>`,
    );
  },

  feathers() {
    const feather = (a, length, turn, fill) => {
      const l = length;
      const barbs = range(4)
        .map((i) => {
          const y = -l * (0.25 + i * 0.17);
          return `M0 ${n(y)}L${n(l * 0.13)} ${n(y - l * 0.08)}`;
        })
        .join("");
      return (
        `<g transform="${place(41, a, turn)}">` +
        `<path d="M0 0C${n(l * 0.46)} ${n(-l * 0.3)} ${n(l * 0.38)} ${n(-l * 0.82)} 0 ${-l}C${n(-l * 0.38)} ${n(-l * 0.82)} ${n(-l * 0.46)} ${n(-l * 0.3)} 0 0Z" fill="${fill}" stroke="#5E0F26" stroke-width="1"/>` +
        `<path d="M0 3V${n(-l * 0.92)}${barbs}" fill="none" stroke="#FFE3EA" stroke-width="1.1" stroke-linecap="round"/>` +
        `</g>`
      );
    };
    const list = [
      [62, 13, 30],
      [298, 13, -30],
      [88, 16, 28],
      [272, 16, -28],
      [112, 18, 26],
      [248, 18, -26],
      [136, 19, 24],
      [224, 19, -24],
      [160, 19, 20],
      [200, 19, -20],
    ];
    return file(
      linear("f", ["#FFB3C4", "#E23D68", "#8E1B3C"], [0.5, 0], [0.5, 1]),
      ring(41.5, "#8E1B3C", 2.6) +
        `<g class="sway">${list.map(([a, l, t]) => feather(a, l, t, "url(#f)")).join("")}</g>`,
    );
  },

  gear() {
    const teeth = (cx, cy, outer, root, count) => {
      const points = [];
      for (let i = 0; i < count; i++) {
        const base = (i * 360) / count;
        const step = 360 / count;
        const polar = (r, a) => {
          const t = ((a - 90) * Math.PI) / 180;
          return `${n(cx + Math.cos(t) * r)} ${n(cy + Math.sin(t) * r)}`;
        };
        points.push(
          polar(root, base - step * 0.28),
          polar(outer, base - step * 0.16),
          polar(outer, base + step * 0.16),
          polar(root, base + step * 0.28),
        );
      }
      return `M${points.join("L")}Z`;
    };
    const hole = (cx, cy, r) =>
      `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
    const rivets = range(8)
      .map((i) => {
        const [x, y] = at(45.5, i * 45 + 22.5);
        return `<circle cx="${n(x)}" cy="${n(y)}" r="1.5" fill="#FFE6B0"/>`;
      })
      .join("");
    const [sx, sy] = at(47, 135);
    return file(
      linear("b", ["#F2CE8E", "#C08A3E", "#6E4518"], [0, 0], [1, 1]) +
        linear("s", ["#EDF0F7", "#9AA3B8", "#4E566A"], [0, 0], [1, 1]),
      `<g class="spin"><path fill-rule="evenodd" d="${teeth(60, 60, 58, 50, 18)}${hole(60, 60, 41.5)}" fill="url(#b)" stroke="#3E2610" stroke-width="1"/>${rivets}</g>` +
        `<g style="transform-origin:${n(sx)}px ${n(sy)}px" class="rev"><path fill-rule="evenodd" d="${teeth(n(sx), n(sy), 15.5, 11.5, 9)}${hole(n(sx), n(sy), 5.5)}" fill="url(#s)" stroke="#22283A" stroke-width="1"/></g>`,
    );
  },

  circuit() {
    const trace = (a, turn, out, end) => {
      const points = [at(43, a), at(out, a), at(end, a + turn)];
      const d = `M${points.map(xy).join("L")}`;
      const [x, y] = points[2];
      return { d, node: [x, y] };
    };
    const all = range(16).map((i) => {
      const a = i * 22.5;
      return i % 2
        ? trace(a, 9, 49, 58)
        : trace(a, -9, 47, 53);
    });
    const lines = all.map((t) => t.d).join("");
    const nodes = all
      .map(
        ({ node: [x, y] }) =>
          `<circle cx="${n(x)}" cy="${n(y)}" r="2.6" fill="#0E3A3A" stroke="#7CF5D2" stroke-width="1.4"/>`,
      )
      .join("");
    return file(
      linear("c", ["#7CF5D2", "#2BB8A3", "#127A7A"], [0, 0], [1, 1]),
      ring(43, "#0B2E30", 5.2, ' opacity=".6"') +
        ring(43, "url(#c)", 3) +
        `<path d="${lines}" fill="none" stroke="#0B2E30" stroke-width="4" stroke-linejoin="round" opacity=".5"/>` +
        `<path d="${lines}" fill="none" stroke="url(#c)" stroke-width="2.2" stroke-linejoin="round"/>` +
        `<path class="run" d="${lines}" fill="none" stroke="#EFFFFA" stroke-width="2.2" stroke-dasharray="7 85" stroke-linejoin="round"/>` +
        nodes,
    );
  },

  waves() {
    const crest = (base, height, cycles, phase) =>
      `M${range(145)
        .map((i) => {
          const a = i * 2.5;
          return xy(
            at(
              base +
                Math.sin((a * Math.PI * cycles) / 180 + phase) * height,
              a,
            ),
          );
        })
        .join("L")}Z`;
    const foam = range(10)
      .map((i) => {
        const [x, y] = at(56, i * 36 + 12);
        return `<circle class="${i % 2 ? "glint" : "glint2"}" cx="${n(x)}" cy="${n(y)}" r="1.9" fill="#E9FAFF"/>`;
      })
      .join("");
    return file(
      linear("w", ["#A8EBFF", "#2E9BDC", "#135CAB"], [0, 0], [1, 1]),
      `<g class="slow">` +
        `<path d="${crest(51, 4, 10, 1.6)}" fill="none" stroke="#7FD2F5" stroke-width="2.6"/>` +
        `</g>` +
        `<g class="rev">` +
        `<path d="${crest(45, 3.2, 10, 0)}" fill="none" stroke="#0E3F72" stroke-width="6" opacity=".4"/>` +
        `<path d="${crest(45, 3.2, 10, 0)}" fill="none" stroke="url(#w)" stroke-width="4"/>` +
        `</g>` +
        foam,
    );
  },

  leaves() {
    const random = seeded(19);
    const colours = ["url(#a)", "#E8622A", "#F2B134", "#C93A22", "url(#a)", "#F08A2B"];
    const list = range(18)
      .map((i) => {
        const a = i * 20 + random() * 6;
        const outer = i % 2 === 0;
        return `<path transform="${place(outer ? 52 : 46, a, outer ? 62 : 118, 0.92 + random() * 0.2)}" d="${leafShape(17, 8.6)}" fill="${colours[i % 6]}" stroke="#4A1A0E" stroke-width=".9"/>`;
      })
      .join("");
    return file(
      linear("a", ["#FFD76A", "#F27A22", "#B8301A"], [0, 0], [1, 1]),
      ring(47, "#5A2C14", 2.8) + `<g class="sway">${list}</g>`,
    );
  },

  snow() {
    const flake = (a, r, s) => {
      const arms = range(6)
        .map((i) => `<path transform="rotate(${i * 60})" d="M0 0V-10M0-6L-3-9M0-6L3-9"/>`)
        .join("");
      return (
        `<g transform="${place(r, a, 12, s)}">` +
        `<g fill="none" stroke-linecap="round" stroke="#3A7DB5" stroke-width="3.8">${arms}</g>` +
        `<g fill="none" stroke-linecap="round" stroke="#fff" stroke-width="1.9">${arms}</g>` +
        `</g>`
      );
    };
    const dots = range(16)
      .map((i) => {
        const [x, y] = at(i % 2 ? 56 : 42, i * 22.5 + 11);
        return `<circle cx="${n(x)}" cy="${n(y)}" r="1.5" fill="#fff" stroke="#2F6C9E" stroke-width=".5"/>`;
      })
      .join("");
    return file(
      linear("s", ["#E9F7FF", "#8CCBF2", "#4A8FCC"], [0, 0], [1, 1]),
      ring(44, "url(#s)", 3) +
        dots +
        `<g class="slow">` +
        [0, 60, 120, 180, 240, 300]
          .map((a, i) => flake(a + 15, 50, i % 2 ? 0.78 : 1))
          .join("") +
        `</g>`,
    );
  },

  hearts() {
    const list = range(14)
      .map((i) => {
        const a = i * (360 / 14);
        const big = i % 2 === 0;
        return `<g class="${big ? "lift" : "liftb"}"><path transform="${place(big ? 50 : 49, a, 0, big ? 1 : 0.68)}" d="${heartShape(6.6)}" fill="url(#h)" stroke="#7A0F3C" stroke-width="1"/></g>`;
      })
      .join("");
    return file(
      linear("h", ["#FFC2D9", "#FF5C96", "#C41F62"], [0.2, 0], [0.8, 1]),
      ring(42.5, "#FF8FB6", 2.2, ' opacity=".9"') + list,
    );
  },

  "music-notes"() {
    const note = (x, y, s, turn, fill, cls) =>
      `<g class="${cls}"><g transform="translate(${x} ${y}) rotate(${turn}) scale(${s})" fill="${fill}" stroke="#231A44" stroke-width=".9"><ellipse cx="-3" cy="9" rx="4.6" ry="3.5" transform="rotate(-20 -3 9)"/><path d="M0.6 8V-10L9-13V-8.6L2.8-6.4V8Z"/></g></g>`;
    const beam = (x, y, s, turn, fill, cls) =>
      `<g class="${cls}"><g transform="translate(${x} ${y}) rotate(${turn}) scale(${s})" fill="${fill}" stroke="#231A44" stroke-width=".9"><ellipse cx="-7.4" cy="9" rx="4.2" ry="3.2" transform="rotate(-20 -7.4 9)"/><ellipse cx="6.6" cy="6.4" rx="4.2" ry="3.2" transform="rotate(-20 6.6 6.4)"/><path d="M-4 8V-9.5L10-12.5V6H8V-6.6L-2-4.5V8Z"/></g></g>`;
    const staff = [46, 50, 54]
      .map(
        (r) =>
          `<path d="${arc(r, 192, 340)}" fill="none" stroke="#B9A8FF" stroke-width="1.4" stroke-linecap="round"/>`,
      )
      .join("");
    return file(
      linear("g", ["#FFE9A0", "#F2B441"], [0, 0], [1, 1]) +
        linear("v", ["#D8C7FF", "#8C6BF0"], [0, 0], [1, 1]),
      staff +
        ring(42.5, "url(#v)", 2.6) +
        note(16, 44, 1, -14, "url(#g)", "lift") +
        beam(34, 15, 0.95, -28, "url(#v)", "liftb") +
        note(100, 18, 1, 16, "url(#g)", "lift") +
        beam(107, 62, 0.95, 18, "url(#v)", "liftb") +
        note(94, 100, 0.95, 26, "url(#g)", "lift") +
        note(26, 100, 0.9, -20, "url(#v)", "liftb"),
    );
  },

  "shield-frame"() {
    const outer =
      "M60 2C72 11 92 14 110 13V60C110 90 86 108 60 119C34 108 10 90 10 60V13C28 14 48 11 60 2Z";
    const hole = "M60 19A41 41 0 1 0 60 101A41 41 0 1 0 60 19Z";
    const rivets = [
      [18, 22],
      [102, 22],
      [15, 62],
      [105, 62],
      [33, 96],
      [87, 96],
    ]
      .map(
        ([x, y]) =>
          `<circle cx="${x}" cy="${y}" r="2.1" fill="#FFE39A" stroke="#5A3E0E" stroke-width=".7"/>`,
      )
      .join("");
    return file(
      linear("s", ["#6E86B8", "#2F4576", "#141F42"], [0, 0], [1, 1]) +
        linear("g", GOLD, [0, 0], [1, 1]),
      `<path fill-rule="evenodd" d="${outer}${hole}" fill="url(#s)" stroke="#0E1630" stroke-width="1.4"/>` +
        `<path d="M60 7C71 15 89 18 105 17.5V60C105 87 84 103 60 113.5C36 103 15 87 15 60V17.5C31 18 49 15 60 7Z" fill="none" stroke="url(#g)" stroke-width="2.2"/>` +
        ring(42, "url(#g)", 2.4) +
        rivets +
        `<path class="glint" d="M60 8L65.5 15L60 22L54.5 15Z" fill="#FF5C7A" stroke="#7A1022" stroke-width=".9"/>`,
    );
  },
};

mkdirSync(OUT, { recursive: true });
for (const [id, draw] of Object.entries(FRAMES)) {
  writeFileSync(join(OUT, `${id}.svg`), draw());
}
console.log(`${Object.keys(FRAMES).length} frames`);
