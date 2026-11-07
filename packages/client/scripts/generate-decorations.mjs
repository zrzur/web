// Original Zrzur avatar decorations (our own artwork, no third-party
// assets). Each SVG is 120x120 with the avatar circle at (60,60) r=40, so
// the client draws it at 1.5x the avatar size, centred on it.
// Run: node scripts/generate-decorations.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const out = "public/decorations";
mkdirSync(out, { recursive: true });

const svg = (defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${defs ? `<defs>${defs}</defs>` : ""}${body}</svg>\n`;

const gold = (id) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="#ffd23f"/><stop offset="1" stop-color="#d98e04"/></linearGradient>`;

/** a five-point star path centred at x,y */
const star = (x, y, r, inner = 0.45) => {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const rad = (Math.PI / 5) * i - Math.PI / 2;
    const len = i % 2 ? r * inner : r;
    points.push(
      `${(x + Math.cos(rad) * len).toFixed(1)},${(y + Math.sin(rad) * len).toFixed(1)}`,
    );
  }
  return `M${points.join("L")}Z`;
};

/** a four-point sparkle centred at x,y */
const sparkle = (x, y, r) =>
  `M${x} ${y - r}Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`;

/** a heart centred at x,y */
const heart = (x, y, s) =>
  `M${x} ${y + s * 0.9}C${x - s * 1.6} ${y - s * 0.1} ${x - s * 0.9} ${y - s * 1.3} ${x} ${y - s * 0.45}C${x + s * 0.9} ${y - s * 1.3} ${x + s * 1.6} ${y - s * 0.1} ${x} ${y + s * 0.9}Z`;

/** a six-arm snowflake */
const flake = (x, y, r) => {
  let d = "";
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const ex = x + Math.cos(a) * r;
    const ey = y + Math.sin(a) * r;
    d += `M${x} ${y}L${ex.toFixed(1)} ${ey.toFixed(1)}`;
    const bx = x + Math.cos(a) * r * 0.6;
    const by = y + Math.sin(a) * r * 0.6;
    for (const side of [-1, 1]) {
      const b = a + side * 0.6;
      d += `M${bx.toFixed(1)} ${by.toFixed(1)}L${(bx + Math.cos(b) * r * 0.32).toFixed(1)} ${(by + Math.sin(b) * r * 0.32).toFixed(1)}`;
    }
  }
  return d;
};

const decorations = {





  headphones: svg(
    `<linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7b6cff"/><stop offset="1" stop-color="#3f2fd6"/></linearGradient>`,
    `<path d="M20 62C20 30 36 12 60 12s40 18 40 50" fill="none" stroke="#2b2f3a" stroke-width="7" stroke-linecap="round"/>
     <path d="M20 62C20 30 36 12 60 12s40 18 40 50" fill="none" stroke="#5c6375" stroke-width="3" stroke-linecap="round"/>
     <rect x="8" y="52" width="18" height="30" rx="8" fill="url(#p)" stroke="#221a8a" stroke-width="1.5"/>
     <rect x="94" y="52" width="18" height="30" rx="8" fill="url(#p)" stroke="#221a8a" stroke-width="1.5"/>
     <rect x="12" y="57" width="4" height="20" rx="2" fill="#b3aaff" opacity=".7"/>
     <rect x="98" y="57" width="4" height="20" rx="2" fill="#b3aaff" opacity=".7"/>`,
  ),

  laurel: (() => {
    let leaves = "";
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.62 + i * 0.075);
      const x = 60 + Math.cos(a) * 46;
      const y = 60 + Math.sin(a) * 46;
      const deg = (a * 180) / Math.PI + 60;
      leaves += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="8" ry="3.6" transform="rotate(${deg.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="url(#l)" stroke="#8a5a00" stroke-width=".8"/>`;
    }
    return svg(
      `<linearGradient id="l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset="1" stop-color="#d98e04"/></linearGradient>`,
      `<g>${leaves}</g><g transform="translate(120 0) scale(-1 1)">${leaves}</g>
       <path d="M60 110l-6-4h12Z" fill="#d98e04"/>`,
    );
  })(),

  flames: (() => {
    // flame tongues standing on the rim of the avatar, pointing outwards
    let tongues = "";
    const count = 11;
    for (let i = 0; i < count; i++) {
      const deg = 180 + (180 / (count - 1)) * i; // left, over the top, right
      const tall = i % 2 ? 15 : 21;
      tongues += `<g transform="rotate(${deg + 90} 60 60)"><path d="M60 22c-6-4-6-10-2-${tall - 8}c0 6 4 6 6 10 2-4 1-8-1-12 6 6 7 14 2 ${tall - 12}Z" transform="translate(-2 -4)" fill="url(#t)"/></g>`;
    }
    return svg(
      `<linearGradient id="t" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff3d00"/><stop offset=".55" stop-color="#ff9100"/><stop offset="1" stop-color="#ffe066"/></linearGradient>
       <radialGradient id="r" cx="50%" cy="50%" r="50%"><stop offset=".62" stop-color="#ff6d00" stop-opacity="0"/><stop offset=".7" stop-color="#ff6d00" stop-opacity=".85"/><stop offset=".82" stop-color="#ffb300" stop-opacity=".35"/><stop offset="1" stop-color="#ffb300" stop-opacity="0"/></radialGradient>`,
      `<circle cx="60" cy="60" r="58" fill="url(#r)"/>${tongues}`,
    );
  })(),

  snow: svg(
    "",
    `<g fill="none" stroke="#dff4ff" stroke-width="2.2" stroke-linecap="round">
      <path d="${flake(16, 22, 9)}"/><path d="${flake(104, 30, 7)}"/><path d="${flake(100, 100, 8)}"/><path d="${flake(18, 98, 6)}"/><path d="${flake(60, 6, 5)}"/>
    </g>
    <g fill="#ffffff"><circle cx="34" cy="10" r="1.8"/><circle cx="88" cy="12" r="1.6"/><circle cx="112" cy="62" r="1.6"/><circle cx="8" cy="64" r="1.8"/><circle cx="60" cy="114" r="1.6"/></g>`,
  ),

  hearts: svg(
    `<linearGradient id="k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8fab"/><stop offset="1" stop-color="#e5174d"/></linearGradient>`,
    `<g fill="url(#k)" stroke="#9e0b33" stroke-width="1">
      <path d="${heart(18, 20, 9)}" transform="rotate(-18 18 20)"/>
      <path d="${heart(104, 26, 7)}" transform="rotate(16 104 26)"/>
      <path d="${heart(102, 98, 8)}" transform="rotate(10 102 98)"/>
      <path d="${heart(14, 92, 6)}" transform="rotate(-12 14 92)"/>
    </g>
    <g fill="#ffc2d4"><circle cx="60" cy="6" r="2"/><circle cx="114" cy="62" r="1.8"/><circle cx="6" cy="56" r="1.6"/></g>`,
  ),

  stars: svg(
    gold("g"),
    `<g fill="url(#g)" stroke="#b87400" stroke-width="1">
      <path d="${star(16, 22, 10)}"/><path d="${star(106, 96, 8)}"/><path d="${star(100, 18, 6)}"/>
    </g>
    <g fill="#fffbe6"><path d="${sparkle(18, 96, 7)}"/><path d="${sparkle(110, 54, 5)}"/><path d="${sparkle(60, 6, 5)}"/></g>`,
  ),

  lightning: svg(
    `<linearGradient id="z" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0fbff"/><stop offset="1" stop-color="#2bd9fe"/></linearGradient>
     <filter id="f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>`,
    `<g>
      <path d="M22 6 8 32h11l-6 22 20-30H22l8-18Z" fill="#2bd9fe" filter="url(#f)" opacity=".7"/>
      <path d="M22 6 8 32h11l-6 22 20-30H22l8-18Z" fill="url(#z)" stroke="#0a8fb0" stroke-width="1"/>
      <path d="M100 64l-14 26h11l-6 22 20-30H100l8-18Z" fill="#2bd9fe" filter="url(#f)" opacity=".7"/>
      <path d="M100 64l-14 26h11l-6 22 20-30H100l8-18Z" fill="url(#z)" stroke="#0a8fb0" stroke-width="1"/>
    </g>`,
  ),
};

for (const [id, content] of Object.entries(decorations)) {
  writeFileSync(`${out}/${id}.svg`, content.replace(/\n\s+/g, " "));
}
console.log(`wrote ${Object.keys(decorations).length} decorations to ${out}`);
