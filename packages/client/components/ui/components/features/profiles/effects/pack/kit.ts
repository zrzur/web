/**
 * The drawing kit the design pack's effects are written against. It is the same
 * model as `effects.ts` (layers of particles, each a pure function of time) and
 * the same helpers, so the pack's specs could move in as they were drawn.
 *
 * Made for Zrzur in this repository (AGPL-3.0). No outside art or library.
 */

export type PackTone = [fill: string, deep: string, light: string];

export type PackPlace = {
  x: number;
  y: number;
  angle?: number;
  grow?: number;
  squash?: number;
  frame?: number;
};

export type PackLayer = {
  count: number;
  shape: string;
  size: [number, number];
  path: (t: number, seed: number, index: number) => PackPlace;
  life: number;
  fade: (t: number, seed: number) => number;
  alpha?: number;
  colours: number[];
  start?: (index: number) => number;
};

export type PackSpec = {
  tones: PackTone[];
  layers: PackLayer[];
  still: number;
};

export type PackShapeDef = {
  /** Half width and height of the drawing, at size 1 */
  reach: [number, number];
  /** Share of the reach box that is solid */
  body?: number;
  /** Canvas pixels per unit of the sprite */
  unit?: number;
  /** Drawn as it is, never enlarged for a still */
  wide?: boolean;
  draw: (c: CanvasRenderingContext2D, tone: PackTone, frame: number) => void;
};

export type PackMade = {
  shapes?: Record<string, PackShapeDef>;
  effects?: Record<string, PackSpec>;
};

const TAU = Math.PI * 2;

function random(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

const soft = (t: number) => Math.min(1, t / 0.14, (1 - t) / 0.2);
const glow = (t: number) => Math.sin(Math.PI * t);
const twinkle = (t: number, seed: number) =>
  Math.sin(Math.PI * t) * (0.65 + 0.35 * Math.sin(t * 9 + seed * 40));
const pop = (t: number) => Math.min(1, t / 0.08, (1 - t) / 0.45);

function depth(layer: PackLayer, far = 1, near = 0.34): PackLayer[] {
  const part = (
    share: number,
    scale: number,
    alpha: number,
    slower: number,
  ): PackLayer => ({
    ...layer,
    count: Math.max(1, Math.round(layer.count * share)),
    size: [layer.size[0] * scale, layer.size[1] * scale],
    alpha: alpha * (layer.alpha ?? 1),
    life: Math.min(0.96, layer.life * slower),
  });
  return [
    part(far, 0.6, 0.44, 1.3),
    part(0.62, 0.92, 0.76, 1.1),
    part(near, 1.4, 1, 0.9),
  ];
}

const fall =
  (sway: number, drift = 0, tumble = 0, spin = 3) =>
  (t: number, seed: number): PackPlace => ({
    x: seed + t * drift + Math.sin(t * 6 + seed * 20) * sway,
    y: -0.08 + t * 1.16,
    angle: spin ? t * spin + seed * TAU : 0,
    squash: tumble
      ? 0.25 + 0.75 * Math.abs(Math.cos(t * tumble + seed * 9))
      : 1,
  });

const rise =
  (sway: number, wobble = 0) =>
  (t: number, seed: number): PackPlace => ({
    x: seed + Math.sin(t * 5 + seed * 20) * sway,
    y: 1.08 - t * 1.16,
    angle: Math.sin(t * 4 + seed * 7) * wobble,
  });

function radial(
  c: CanvasRenderingContext2D,
  radius: number,
  stops: [number, string][],
  x = 0,
  y = 0,
) {
  const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
  for (const [offset, colour] of stops) gradient.addColorStop(offset, colour);
  return gradient;
}

function along(
  c: CanvasRenderingContext2D,
  from: [number, number],
  to: [number, number],
  stops: [number, string][],
) {
  const gradient = c.createLinearGradient(from[0], from[1], to[0], to[1]);
  for (const [offset, colour] of stops) gradient.addColorStop(offset, colour);
  return gradient;
}

const fade = (hex: string, alpha: number) =>
  `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;

/** Fill the current path, then a deep hairline: holds on any surface */
function solid(
  c: CanvasRenderingContext2D,
  fill: string | CanvasGradient,
  deep?: string,
  width = 0.07,
) {
  c.fillStyle = fill;
  c.fill();
  if (deep) {
    c.lineWidth = width;
    c.lineJoin = "round";
    c.strokeStyle = deep;
    c.stroke();
  }
}

/** A closed path through points */
function shape(c: CanvasRenderingContext2D, points: [number, number][]) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
}

/** A soft round light */
function halo(
  c: CanvasRenderingContext2D,
  radius: number,
  colour: string,
  strength = 0.5,
) {
  c.fillStyle = radial(c, radius, [
    [0, fade(colour, strength)],
    [1, fade(colour, 0)],
  ]);
  c.beginPath();
  c.arc(0, 0, radius, 0, TAU);
  c.fill();
}

/** Pixel art from rows of characters, filling the box -1..1 */
function px(
  c: CanvasRenderingContext2D,
  rows: string[],
  palette: Record<string, string>,
) {
  const size = 2 / Math.max(rows.length, rows[0].length);
  const x0 = (-rows[0].length * size) / 2;
  const y0 = (-rows.length * size) / 2;
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === ".") continue;
      c.fillStyle = palette[row[i]];
      c.fillRect(
        x0 + i * size - 0.004,
        y0 + j * size - 0.004,
        size + 0.008,
        size + 0.008,
      );
    }
  });
}

const TONES: Record<string, PackTone> = {
  white: ["#D3E4F8", "#3F6CA6", "#FFFFFF"],
  sky: ["#6FB4F2", "#245A9C", "#D4ECFF"],
  aqua: ["#6BDCE6", "#16798C", "#E2FBFF"],
  pink: ["#FF6C9C", "#B0124F", "#FFD3E2"],
  rose: ["#FF9DB8", "#B8325F", "#FFE3EC"],
  gold: ["#FFC84A", "#A9660A", "#FFF0BE"],
  amber: ["#FF9A3C", "#B2460C", "#FFE0A8"],
  ember: ["#FF6A2B", "#A8250A", "#FFD08A"],
  mint: ["#4FD6B2", "#0F7560", "#CFFAEC"],
  green: ["#8CD36A", "#2F7A3C", "#E0F7C8"],
  violet: ["#B48CFF", "#5230B4", "#E9DEFF"],
  indigo: ["#6C5CE0", "#2A1F86", "#C9C2FF"],
  rust: ["#E2662E", "#8A2C10", "#FFD29A"],
  moon: ["#F4EFD2", "#8A7B3E", "#FFFFFF"],
  action: ["#E0195F", "#8E0E3B", "#FF7AA8"],
  ink: ["#2A2D42", "#0D0E16", "#5A5F80"],
  sand: ["#E7C58A", "#9A6B2C", "#FFF1D2"],
  red: ["#E5484D", "#8C1D22", "#FFC9CB"],
  lime: ["#C6F24E", "#5C7A0C", "#F1FFC4"],
  teal: ["#2FB8A6", "#0E5E57", "#C8F5EE"],
  bone: ["#EFEAE0", "#6E6658", "#FFFFFF"],
};

export const K = {
  TAU,
  random,
  soft,
  glow,
  twinkle,
  pop,
  depth,
  fall,
  rise,
  radial,
  along,
  fade,
  solid,
  shape,
  halo,
  px,
  TONES,
};

export type PackKit = typeof K;
