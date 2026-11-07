import type { DiscoverKind } from "./api";

/**
 * A community's portrait, made of its own flock. Empty perches draw the shape
 * of what it is about (a pad for gaming, a note for music); birds settle on
 * them as it grows, on a log scale, so ten members and ten thousand both read;
 * the birds in the online colour are the people here now. A server of twelve
 * is a small flock still gathering, not an empty card. Every number comes from
 * the listing; nothing is made up.
 *
 * Original drawings. All dots land in three path strings of zero-length lines
 * with round caps, so a card costs three SVG paths and the colours stay in CSS.
 */

export const ART_WIDTH = 320;
export const ART_HEIGHT = 180;

/** How many perches a drawing has */
export const PERCHES = 120;

export type ListingArtPaths = {
  /** The shape: empty places */
  perch: string;
  /** Members */
  birds: string;
  /** Members online now */
  lit: string;
};

type Point = [number, number];
type Stroke = Point[];

const n = (value: number) => Math.round(value * 10) / 10;

/** The same id always gives the same number */
export function hashId(id: string) {
  let hash = 2166136261;
  for (const ch of id) {
    hash ^= ch.codePointAt(0)!;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A small seeded generator (mulberry32) */
export function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CX = ART_WIDTH / 2;
const CY = ART_HEIGHT / 2;

/** Part of a circle or ellipse, as a stroke; angles in turns */
function arc(
  x: number,
  y: number,
  rx: number,
  ry = rx,
  from = 0,
  to = 1,
  tilt = 0,
): Stroke {
  const points: Stroke = [];
  const steps = Math.max(8, Math.round(48 * Math.abs(to - from)));
  for (let i = 0; i <= steps; i++) {
    const a = (from + ((to - from) * i) / steps) * Math.PI * 2;
    const px = Math.cos(a) * rx;
    const py = Math.sin(a) * ry;
    points.push([
      x + px * Math.cos(tilt) - py * Math.sin(tilt),
      y + px * Math.sin(tilt) + py * Math.cos(tilt),
    ]);
  }
  return points;
}

const closed = (points: Stroke): Stroke => [...points, points[0]];

const box = (x: number, y: number, w: number, h: number): Stroke =>
  closed([
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]);

const plus = (x: number, y: number, arm: number, w: number): Stroke =>
  closed([
    [x - w, y - arm],
    [x + w, y - arm],
    [x + w, y - w],
    [x + arm, y - w],
    [x + arm, y + w],
    [x + w, y + w],
    [x + w, y + arm],
    [x - w, y + arm],
    [x - w, y + w],
    [x - arm, y + w],
    [x - arm, y - w],
    [x - w, y - w],
  ]);

/** Two lips of a speech bubble around a box, the tail at one corner */
const bubble = (x: number, y: number, w: number, h: number): Stroke =>
  closed([
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x + w * 0.34, y + h],
    [x + w * 0.16, y + h + 16],
    [x + w * 0.18, y + h],
    [x, y + h],
  ]);

const SHAPES: Record<string, () => Stroke[]> = {
  gaming: () => [
    plus(CX - 58, CY, 38, 13),
    arc(CX + 58, CY - 26, 11),
    arc(CX + 58, CY + 26, 11),
    arc(CX + 32, CY, 11),
    arc(CX + 84, CY, 11),
  ],
  community: () => [
    arc(CX, CY - 28, 22),
    arc(CX, CY + 54, 42, 40, 0.5, 1),
    arc(CX - 74, CY - 14, 16),
    arc(CX - 74, CY + 48, 30, 30, 0.5, 1),
    arc(CX + 74, CY - 14, 16),
    arc(CX + 74, CY + 48, 30, 30, 0.5, 1),
  ],
  education: () => [
    [
      [CX, CY - 40],
      [CX, CY + 54],
    ],
    arc(CX - 50, CY - 16, 50, 24, 0.5, 1),
    arc(CX + 50, CY - 16, 50, 24, 0.5, 1),
    [
      [CX - 100, CY - 16],
      [CX - 100, CY + 54],
    ],
    [
      [CX + 100, CY - 16],
      [CX + 100, CY + 54],
    ],
    arc(CX - 50, CY + 54, 50, 20, 0.5, 1),
    arc(CX + 50, CY + 54, 50, 20, 0.5, 1),
  ],
  technology: () => [
    [
      [CX - 54, CY - 46],
      [CX - 104, CY],
      [CX - 54, CY + 46],
    ],
    [
      [CX + 54, CY - 46],
      [CX + 104, CY],
      [CX + 54, CY + 46],
    ],
    [
      [CX + 24, CY - 60],
      [CX - 24, CY + 60],
    ],
  ],
  art: () => [
    arc(CX, CY, 92, 62),
    arc(CX + 52, CY + 24, 15),
    arc(CX - 44, CY - 28, 10),
    arc(CX + 6, CY - 40, 10),
    arc(CX - 56, CY + 16, 10),
    arc(CX - 10, CY + 36, 10),
  ],
  music: () => [
    arc(CX - 52, CY + 44, 24, 18),
    arc(CX + 58, CY + 30, 24, 18),
    [
      [CX - 29, CY + 42],
      [CX - 29, CY - 52],
      [CX + 81, CY - 66],
      [CX + 81, CY + 28],
    ],
    [
      [CX - 29, CY - 26],
      [CX + 81, CY - 40],
    ],
  ],
  entertainment: () => [
    arc(CX, CY, 72),
    closed([
      [CX - 22, CY - 36],
      [CX + 40, CY],
      [CX - 22, CY + 36],
    ]),
  ],
  anime: () => [
    arc(CX, CY - 56, 112, 92, 0.13, 0.37),
    arc(CX, CY + 56, 112, 92, 0.63, 0.87),
    arc(CX, CY, 32),
    arc(CX + 10, CY - 10, 9),
  ],
  sports: () => [
    arc(CX, CY, 72),
    arc(CX - 96, CY, 72, 72, -0.13, 0.13),
    arc(CX + 96, CY, 72, 72, 0.37, 0.63),
    [
      [CX - 72, CY],
      [CX + 72, CY],
    ],
  ],
  science: () => [
    arc(CX, CY, 92, 30),
    arc(CX, CY, 92, 30, 0, 1, Math.PI / 3),
    arc(CX, CY, 92, 30, 0, 1, -Math.PI / 3),
    arc(CX, CY, 11),
  ],
  languages: () => [
    bubble(CX - 104, CY - 58, 118, 66),
    bubble(CX - 8, CY - 18, 112, 62),
  ],
  other: () => {
    const wave: Stroke = [];
    for (let x = 18; x <= ART_WIDTH - 18; x += 6)
      wave.push([x, CY + Math.sin((x / ART_WIDTH) * Math.PI * 3.2) * 46]);
    return [wave];
  },

  // bots
  moderation: () => [
    [
      [CX, CY - 68],
      [CX + 62, CY - 44],
      [CX + 62, CY + 2],
      [CX + 36, CY + 44],
      [CX, CY + 70],
      [CX - 36, CY + 44],
      [CX - 62, CY + 2],
      [CX - 62, CY - 44],
      [CX, CY - 68],
    ],
    [
      [CX - 26, CY],
      [CX - 6, CY + 22],
      [CX + 30, CY - 22],
    ],
  ],
  utility: () => {
    const teeth: Stroke = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const r = i % 12 < 6 ? 72 : 56;
      teeth.push([CX + Math.cos(a) * r, CY + Math.sin(a) * r]);
    }
    return [teeth, arc(CX, CY, 24)];
  },
  fun: () => [
    arc(CX, CY, 74),
    arc(CX - 26, CY - 22, 8),
    arc(CX + 26, CY - 22, 8),
    arc(CX, CY + 6, 42, 38, 0.06, 0.44),
  ],
  games: () => [
    box(CX - 66, CY - 66, 132, 132),
    arc(CX - 34, CY - 34, 9),
    arc(CX + 34, CY - 34, 9),
    arc(CX, CY, 9),
    arc(CX - 34, CY + 34, 9),
    arc(CX + 34, CY + 34, 9),
  ],
  social: () => [
    bubble(CX - 92, CY - 56, 184, 96),
    arc(CX - 38, CY - 8, 9),
    arc(CX, CY - 8, 9),
    arc(CX + 38, CY - 8, 9),
  ],
};

/** Evenly spaced places along the strokes, a little loose, like birds */
function perches(strokes: Stroke[], count: number, random: () => number) {
  const segments: { a: Point; b: Point; length: number }[] = [];
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i++) {
      const [a, b] = [stroke[i - 1], stroke[i]];
      segments.push({ a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1]) });
    }
  }
  const total = segments.reduce((sum, item) => sum + item.length, 0);
  const step = total / count;
  const points: Point[] = [];
  let walked = 0;
  let next = 0;
  for (const { a, b, length } of segments) {
    while (next <= walked + length && points.length < count) {
      const t = length ? (next - walked) / length : 0;
      points.push([
        a[0] + (b[0] - a[0]) * t + (random() - 0.5) * 3,
        a[1] + (b[1] - a[1]) * t + (random() - 0.5) * 3,
      ]);
      next += step;
    }
    walked += length;
  }
  return points;
}

const dots = (points: Point[]) =>
  points.map(([x, y]) => `M${n(x)} ${n(y)}h0`).join("");

/** How much of the shape is filled: 10 members a quarter, 10,000 all of it */
export function fillShare(count: number) {
  return Math.min(1, Math.max(0.06, Math.log10(Math.max(count, 0) + 1) / 4));
}

/** The portrait of a listing or a category; unknown categories get a wave */
export function listingArt(
  kind: DiscoverKind,
  category: string | undefined,
  id: string,
  count = 0,
  online = 0,
): ListingArtPaths {
  const random = seeded(hashId(`${kind}:${category ?? ""}:${id}`));
  const shape = SHAPES[category ?? "other"] ?? SHAPES.other;
  const places = perches(shape(), PERCHES, random);

  // birds settle in a different order on every listing
  const order = places.map((point) => ({ point, key: random() }));
  order.sort((a, b) => a.key - b.key);
  const shuffled = order.map((entry) => entry.point);

  const birds = Math.max(1, Math.round(shuffled.length * fillShare(count)));
  const lit =
    online > 0
      ? Math.min(
          birds,
          Math.max(1, Math.round((birds * online) / Math.max(count, 1))),
        )
      : 0;

  return {
    perch: dots(shuffled.slice(birds)),
    birds: dots(shuffled.slice(lit, birds)),
    lit: dots(shuffled.slice(0, lit)),
  };
}

export const ART_MOTIFS = Object.keys(SHAPES);
