import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { plainDescription } from "./plainText.mjs";
import { woffToSfnt } from "./woff.mjs";

/**
 * Preview images (1200×630 PNG) for link previews and search results:
 * Midnight Pulse surfaces, IBM Plex Sans Arabic, the logo mark as
 * delivered. Text only from the public card; never member names.
 */

const require = createRequire(import.meta.url);

/** The delivered mark (controller face, version B), white */
const MARK =
  "M 84 78 L 172 78 C 181 78 187 81 193 88 L 226 124 C 237 136 237 148 226 159 L 210 175 C 199 186 185 186 175 176 L 166 167 C 162 163 157 161 150 161 L 106 161 C 99 161 94 163 90 167 L 81 176 C 71 186 57 186 46 175 L 30 159 C 19 148 19 136 30 124 L 63 88 C 69 81 75 78 84 78 Z M 68 126 C 70 113 78 104 89 104 C 102 103 112 112 115 125 C 117 132 112 135 107 131 C 101 126 96 122 91 122 C 85 122 80 126 75 131 C 70 135 67 132 68 126 Z M 188 126 C 186 113 178 104 167 104 C 154 103 144 112 141 125 C 139 132 144 135 149 131 C 155 126 160 122 165 122 C 171 122 176 126 181 131 C 186 135 189 132 188 126 Z";

const C = {
  frame: "#0D0E16",
  page: "#1D1F2D",
  raised: "#242638",
  edge: "#303348",
  title: "#F7F8FC",
  text2: "#A1A5B8",
  online: "#55DCC8",
};

let fonts;
function fontBuffers() {
  if (fonts) return fonts;
  const dir = require
    .resolve("@fontsource/ibm-plex-sans-arabic/package.json")
    .replace(/package\.json$/, "files/");
  fonts = ["arabic-400", "arabic-700", "latin-400", "latin-700"].map((name) =>
    woffToSfnt(readFileSync(`${dir}ibm-plex-sans-arabic-${name}-normal.woff`)),
  );
  return fonts;
}

/** Control characters (also from names people typed) break the renderer */
// eslint-disable-next-line no-control-regex -- removing them is the point
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\ufffe\uffff]/g;

const escape = (value) =>
  String(value)
    .replace(CONTROL, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const isRtl = (text) => /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(text);

/** Words into at most `lines` lines of about `width` characters */
export function wrap(text, width, lines) {
  const out = [];
  let line = "";
  for (const word of text.replace(/\s+/g, " ").trim().split(" ")) {
    if ((line + " " + word).trim().length > width && line) {
      out.push(line);
      line = word;
      if (out.length === lines) break;
    } else line = `${line} ${word}`.trim();
  }
  if (out.length < lines && line) out.push(line);
  if (out.length === lines && text.length > out.join(" ").length)
    out[lines - 1] = `${out[lines - 1].replace(/[.,،]?$/, "")}…`;
  return out;
}

/**
 * A text line, right-aligned when it is Arabic (or `rtl` says so). Right-to-
 * left marks keep end punctuation at the end of an Arabic line.
 */
function line(text, y, size, weight, colour, rtl = isRtl(text)) {
  const body = rtl ? `‏${text}‏` : text;
  return `<text x="${rtl ? 1120 : 80}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${colour}" text-anchor="${rtl ? "end" : "start"}" direction="${rtl ? "rtl" : "ltr"}">${escape(body)}</text>`;
}

/** The logo and name, bottom corner opposite the start of the text */
function lockup(label, atLeft = false) {
  if (atLeft)
    return `<g transform="translate(80 548)">
    <svg x="0" y="-38" width="52" height="52" viewBox="0 0 256 256"><path fill="#FFFFFF" fill-rule="evenodd" d="${MARK}"/></svg>
    <text x="64" y="0" font-size="28" font-weight="700" fill="${C.title}">${escape(label)}</text>
  </g>`;
  return `<g transform="translate(1120 548)">
    <text x="0" y="0" font-size="28" font-weight="700" fill="${C.title}" text-anchor="end">${escape(label)}</text>
    <svg x="${-60 - label.length * 15}" y="-38" width="52" height="52" viewBox="0 0 256 256"><path fill="#FFFFFF" fill-rule="evenodd" d="${MARK}"/></svg>
  </g>`;
}

/** A seeded colour of the same family as the app's banner fallbacks */
function seeded(id) {
  const palette = [
    "#2B3350",
    "#24363A",
    "#3A2C2A",
    "#2E2F45",
    "#3A2A3B",
    "#2A3530",
  ];
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

/**
 * Server preview. `images.banner` / `images.icon` are data: URLs (PNG or
 * JPEG) or undefined.
 */
export function serverSvg(card, text, images = {}) {
  const name = card.name;
  const desc = wrap(plainDescription(card.description), 60, 2);
  const initials = [...name.trim()].slice(0, 2).join("");
  const rtl = isRtl(name);
  const iconX = rtl ? 1120 - 128 : 80;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="IBM Plex Sans Arabic">
  <rect width="1200" height="630" fill="${C.frame}"/>
  ${
    images.banner
      ? `<image href="${images.banner}" width="1200" height="200" preserveAspectRatio="xMidYMid slice"/>`
      : `<rect width="1200" height="200" fill="${seeded(card._id)}"/>`
  }
  <rect x="${iconX - 8}" y="132" width="144" height="144" rx="36" fill="${C.frame}"/>
  ${
    images.icon
      ? `<clipPath id="i"><rect x="${iconX}" y="140" width="128" height="128" rx="30"/></clipPath><image href="${images.icon}" x="${iconX}" y="140" width="128" height="128" clip-path="url(#i)" preserveAspectRatio="xMidYMid slice"/>`
      : `<rect x="${iconX}" y="140" width="128" height="128" rx="30" fill="#3D4A72"/><text x="${iconX + 64}" y="222" font-size="44" font-weight="700" fill="${C.title}" text-anchor="middle">${escape(initials)}</text>`
  }
  ${line(name, 340, 56, 700, C.title)}
  ${desc.map((l, i) => line(l, 400 + i * 42, 30, 400, C.text2)).join("\n  ")}
  ${line(text.counts, 552, 28, 400, C.title, rtl)}
  ${lockup(text.brand, rtl)}
</svg>`;
}

/** Design preview: what it is, its name, and its art when it has one */
export function designSvg(design, text, images = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="IBM Plex Sans Arabic">
  <rect width="1200" height="630" fill="${C.frame}"/>
  <rect x="80" y="80" width="400" height="400" rx="28" fill="${C.page}" stroke="${C.edge}" stroke-width="2"/>
  ${
    images.art
      ? `<image href="${images.art}" x="120" y="120" width="320" height="320" preserveAspectRatio="xMidYMid meet"/>`
      : `<circle cx="280" cy="280" r="96" fill="#3D4A72"/><circle cx="280" cy="280" r="112" fill="none" stroke="#E0195F" stroke-width="12"/>`
  }
  <text x="540" y="200" font-size="30" fill="${C.text2}">${escape(design.kindLabel)}</text>
  <text x="540" y="276" font-size="60" font-weight="700" fill="${C.title}">${escape(design.name)}</text>
  ${lockup(text.brand)}
</svg>`;
}

/** The plain preview for a site's own pages */
export function siteSvg(text) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="IBM Plex Sans Arabic">
  <rect width="1200" height="630" fill="${C.frame}"/>
  <svg x="520" y="110" width="160" height="160" viewBox="0 0 256 256"><path fill="#FFFFFF" fill-rule="evenodd" d="${MARK}"/></svg>
  <text x="600" y="360" font-size="64" font-weight="700" fill="${C.title}" text-anchor="middle">${escape(text.title)}</text>
  <text x="600" y="430" font-size="30" fill="${C.text2}" text-anchor="middle">${escape(text.line)}</text>
</svg>`;
}

let Resvg;
/** SVG to PNG with the bundled fonts */
export async function renderPng(svg) {
  Resvg ??= (await import("@resvg/resvg-js")).Resvg;
  const resvg = new Resvg(svg, {
    font: {
      fontBuffers: fontBuffers(),
      loadSystemFonts: false,
      defaultFontFamily: "IBM Plex Sans Arabic",
    },
    fitTo: { mode: "width", value: 1200 },
  });
  return resvg.render().asPng();
}
