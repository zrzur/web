/**
 * Zrzur's own profile effects: layered particle systems, drawn in code, with
 * no files and no sound. Each one is a pure function of time, so the same
 * frames can be drawn on a card and checked for flashing in a unit test.
 *
 * Every particle has a light body and a deep edge, so it reads on dark and on
 * pale surfaces alike, and layers of different size and speed give it depth.
 *
 * Made for Zrzur in this repository (AGPL-3.0). No outside art, library or
 * remote file is used; `flash.ts` is the check, `effects.test.ts` runs it.
 */

import { type EffectId, EFFECT_DURATION_MS } from "./effectIds";
import { type EffectShape, drawShape, shapeReach, shapeUnit } from "./shapes";

export type { EffectShape } from "./shapes";

export {
  type EffectId,
  EFFECT_DURATION_MS,
  EFFECT_IDS,
  isEffectId,
} from "./effectIds";

/**
 * Particles never get more solid than this. Text stays readable because they
 * are small and spread out (`EFFECT_MAX_COVER`), and anything wide stays far
 * below this: at the old 0.55 small particles washed out on pale surfaces.
 */
export const EFFECT_MAX_ALPHA = 0.85;

/** Most of a card that solid particles may cover in any one frame */
export const EFFECT_MAX_COVER = 0.16;

/** One particle in one frame. Positions are 0 to 1 across the card. */
export type Particle = {
  x: number;
  y: number;
  /** Size as a part of the card's width */
  size: number;
  /** Radians */
  angle: number;
  alpha: number;
  shape: EffectShape;
  /** Index into the effect's tones */
  colour: number;
  /** Narrowing across its width: tumbling and flapping */
  squash: number;
  /** Which drawing of a shape with several: the phase of a moon */
  frame: number;
};

/** Body, deep edge and light of one colour */
export type Tone = [fill: string, deep: string, light: string];

type Place = {
  x: number;
  y: number;
  angle?: number;
  /** Size over a particle's life */
  grow?: number;
  squash?: number;
  frame?: number;
};

type Layer = {
  count: number;
  shape: EffectShape;
  /** Sizes, as a part of the card's width */
  size: [number, number];
  /** Where each particle is, `t` is its own life from 0 to 1 */
  path: (t: number, seed: number, index: number) => Place;
  /** How long one particle lives, as a part of the whole play */
  life: number;
  /** Solidness over a particle's life */
  fade: (t: number, seed: number) => number;
  /** Peak solidness of this layer, from 0 to 1 */
  alpha?: number;
  colours: number[];
  /** A fixed start, for what must come in order */
  start?: (index: number) => number;
};

type Spec = {
  tones: Tone[];
  layers: Layer[];
  /** The moment most is on screen, for a still picture */
  still: number;
};

/** Repeatable random numbers, so every play and every test is the same */
function random(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

const TAU = Math.PI * 2;

/** Gently in and gently out: nothing ever appears or vanishes at once */
const soft = (t: number) => Math.min(1, t / 0.14, (1 - t) / 0.2);
const glow = (t: number) => Math.sin(Math.PI * t);
const twinkle = (t: number, seed: number) =>
  Math.sin(Math.PI * t) * (0.65 + 0.35 * Math.sin(t * 9 + seed * 40));

/**
 * The same layer at three depths: far is small, faint and slow, near is large
 * and quick. The faint layers are what make a field look deep, and they stay
 * under the flash limit however often they pass a spot.
 */
function depth(layer: Layer, far = 1, near = 0.34): Layer[] {
  const part = (
    share: number,
    scale: number,
    alpha: number,
    slower: number,
  ): Layer => ({
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

/** Falling, with a sway; `drift` slants it with the wind */
const fall =
  (sway: number, drift = 0, tumble = 0) =>
  (t: number, seed: number): Place => ({
    x: seed + t * drift + Math.sin(t * 6 + seed * 20) * sway,
    y: -0.08 + t * 1.16,
    angle: t * 3 + seed * TAU,
    squash: tumble
      ? 0.25 + 0.75 * Math.abs(Math.cos(t * tumble + seed * 9))
      : 1,
  });

const rise =
  (sway: number, wobble = 0) =>
  (t: number, seed: number): Place => ({
    x: seed + Math.sin(t * 5 + seed * 20) * sway,
    y: 1.08 - t * 1.16,
    angle: Math.sin(t * 4 + seed * 7) * wobble,
  });

const TONES = {
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
} satisfies Record<string, Tone>;

const SPECS: Record<EffectId, Spec> = {
  snow: {
    tones: [TONES.white],
    still: 1900,
    layers: [
      ...depth({
        count: 30,
        shape: "snowball",
        size: [0.012, 0.02],
        path: fall(0.03),
        life: 0.72,
        fade: soft,
        colours: [0],
      }),
      {
        count: 7,
        shape: "flake",
        size: [0.034, 0.05],
        path: fall(0.05),
        life: 0.66,
        fade: soft,
        colours: [0],
      },
    ],
  },
  rain: {
    tones: [TONES.sky, TONES.aqua],
    still: 1700,
    layers: [
      ...depth(
        {
          count: 26,
          shape: "streak",
          size: [0.06, 0.09],
          path: (t, seed) => ({
            x: seed + 0.05 - t * 0.09,
            y: -0.08 + t * 1.2,
            angle: 1.5,
          }),
          life: 0.34,
          fade: soft,
          colours: [0, 0, 1],
        },
        1,
        0.3,
      ),
      {
        count: 10,
        shape: "ripple",
        size: [0.02, 0.05],
        path: (t, seed, index) => ({
          x: seed,
          y: 0.78 + random(index, 7) * 0.2,
          grow: 0.3 + t * 0.7,
          squash: 1,
          frame: 1,
        }),
        life: 0.22,
        alpha: 0.7,
        fade: glow,
        colours: [0],
      },
    ],
  },
  confetti: {
    tones: [TONES.pink, TONES.sky, TONES.gold, TONES.mint, TONES.violet],
    still: 1900,
    layers: depth(
      {
        count: 30,
        shape: "paper",
        size: [0.016, 0.026],
        path: fall(0.05, 0, 16),
        life: 0.62,
        fade: soft,
        colours: [0, 1, 2, 3, 4],
      },
      0.8,
      0.42,
    ),
  },
  sparks: {
    tones: [TONES.gold, TONES.amber, TONES.ember],
    still: 900,
    layers: [0, 1].flatMap((wave) =>
      depth(
        {
          count: 18,
          shape: "spark",
          size: [0.012, 0.022],
          path: (t, seed) => {
            const a = seed * TAU;
            const out = 1 - (1 - t) ** 2;
            const x = 0.5 + (wave ? 0.12 : -0.14);
            const y = wave ? 0.48 : 0.32;
            const vx = Math.cos(a) * 0.52;
            const vy = Math.sin(a) * 0.42;
            return {
              x: x + vx * out,
              y: y + vy * out + t * t * 0.3,
              angle: Math.atan2(vy + t * 0.6, vx),
            };
          },
          life: 0.38,
          start: (index) => wave * 0.36 + 0.04 + random(index, 6) * 0.16,
          fade: (t) => Math.min(1, t / 0.08, (1 - t) / 0.45),
          colours: [0, 1, 2],
        },
        0.6,
        0.3,
      ),
    ),
  },
  petals: {
    tones: [TONES.rose, TONES.pink],
    still: 1900,
    layers: depth(
      {
        count: 24,
        shape: "petal",
        size: [0.02, 0.032],
        path: fall(0.08, 0.1, 9),
        life: 0.76,
        fade: soft,
        colours: [0, 1, 0],
      },
      0.9,
      0.34,
    ),
  },
  bubbles: {
    tones: [TONES.aqua, TONES.sky],
    still: 2100,
    layers: [
      // a ring crosses a spot twice, so few bold ones and more faint ones
      ...depth(
        {
          count: 8,
          shape: "bubble",
          size: [0.022, 0.05],
          path: rise(0.04),
          life: 0.86,
          fade: soft,
          colours: [0, 1],
        },
        1.1,
        0.5,
      ),
    ],
  },
  leaves: {
    tones: [TONES.rust, TONES.gold, TONES.amber],
    still: 1900,
    layers: depth(
      {
        count: 20,
        shape: "leaf",
        size: [0.024, 0.038],
        path: fall(0.1, -0.08, 8),
        life: 0.8,
        fade: soft,
        colours: [0, 1, 2],
      },
      0.8,
      0.36,
    ),
  },
  fireflies: {
    tones: [["#F4E85A", "#6E7A10", "#FFFDE0"]],
    still: 2000,
    layers: depth(
      {
        count: 20,
        shape: "orb",
        size: [0.02, 0.034],
        path: (t, seed, index) => ({
          x:
            seed +
            Math.sin(t * 4 + seed * 30) * 0.07 +
            Math.sin(t * 9 + index) * 0.015,
          y: 0.1 + random(index, 4) * 0.82 + Math.cos(t * 3 + seed * 20) * 0.05,
        }),
        life: 0.72,
        fade: twinkle,
        colours: [0],
      },
      0.8,
      0.4,
    ),
  },
  ripples: {
    tones: [TONES.sky, TONES.aqua, TONES.violet],
    still: 1700,
    layers: [0, 1, 2].map((ring) => ({
      count: 6,
      shape: "ripple" as const,
      size: [0.14, 0.24] as [number, number],
      path: (t: number, _seed: number, index: number) => ({
        x: 0.12 + random(index, 5) * 0.76,
        y: 0.1 + random(index, 8) * 0.8,
        grow: 0.2 + t * 0.8,
      }),
      life: 0.42,
      start: (index: number) => random(index, 9) * 0.52 + ring * 0.05,
      alpha: 1 - ring * 0.28,
      fade: glow,
      colours: [0, 1, 2],
    })),
  },
  kites: {
    tones: [TONES.pink, TONES.sky, TONES.gold, TONES.mint],
    still: 2000,
    layers: depth(
      {
        count: 5,
        shape: "kite",
        size: [0.04, 0.056],
        path: (t, seed, index) => ({
          x: -0.12 + t * 1.24,
          y: 0.1 + random(index, 4) * 0.62 + Math.sin(t * 6 + seed * 9) * 0.05,
          angle: Math.sin(t * 5 + seed * 6) * 0.3 + 0.5,
        }),
        life: 0.78,
        fade: soft,
        colours: [0, 1, 2, 3],
      },
      1,
      0.6,
    ),
  },
  aurora: {
    tones: [TONES.mint, TONES.violet, TONES.sky],
    still: 2000,
    layers: [0, 1, 2].map((band) => ({
      count: 15,
      shape: "curtain" as const,
      size: [0.1, 0.14] as [number, number],
      path: (t: number, _seed: number, index: number) => {
        const x = -0.05 + index * 0.078;
        return {
          x: x + Math.sin(t * 2 + band) * 0.03,
          y:
            0.14 +
            band * 0.11 +
            Math.sin(x * 7 + t * 3.4 + band * 2) * 0.05 +
            Math.sin(x * 15 - t * 2) * 0.015,
        };
      },
      life: 0.96,
      start: () => band * 0.01,
      alpha: 0.38 - band * 0.07,
      fade: glow,
      colours: [band],
    })),
  },
  starfall: {
    tones: [TONES.gold, TONES.white, TONES.sky],
    still: 1700,
    layers: [
      {
        count: 26,
        shape: "sparkle",
        size: [0.008, 0.02],
        path: (_t, seed, index) => ({
          x: seed,
          y: random(index, 3),
          angle: index,
        }),
        life: 0.8,
        alpha: 0.7,
        fade: twinkle,
        colours: [0, 1],
      },
      {
        count: 7,
        shape: "comet",
        size: [0.04, 0.06],
        path: (t, seed) => ({
          x: seed * 1.1 + 0.32 - t * 0.7,
          y: -0.2 + t * 0.7,
          angle: Math.PI - 0.82,
        }),
        life: 0.26,
        fade: soft,
        colours: [0, 1, 2],
      },
    ],
  },
  lanterns: {
    tones: [TONES.amber, TONES.ember, TONES.gold],
    still: 2300,
    layers: depth(
      {
        count: 7,
        shape: "lantern",
        size: [0.03, 0.044],
        path: rise(0.04, 0.12),
        life: 0.9,
        fade: soft,
        colours: [0, 1, 2],
      },
      1.4,
      0.6,
    ),
  },
  sakura: {
    tones: [TONES.rose, ["#FFD1E0", "#C4487A", "#FFF1F6"]],
    still: 1900,
    layers: depth(
      {
        count: 30,
        shape: "blossom",
        size: [0.022, 0.034],
        path: (t, seed) => ({
          x: seed * 1.4 - 0.5 + t * 0.62,
          y: -0.08 + t * 1.16 + Math.sin(t * 7 + seed * 20) * 0.02,
          angle: t * 5 + seed * TAU,
          squash: 0.3 + 0.7 * Math.abs(Math.cos(t * 8 + seed * 9)),
        }),
        life: 0.66,
        fade: soft,
        colours: [0, 1],
      },
      0.9,
      0.3,
    ),
  },
  embers: {
    tones: [TONES.ember, TONES.amber, TONES.gold],
    still: 2000,
    layers: depth(
      {
        count: 28,
        shape: "spark",
        size: [0.016, 0.028],
        path: (t, seed) => {
          const curl = Math.sin(t * 7 + seed * 30) * 0.05;
          return {
            x: seed + curl + t * 0.06,
            y: 1.06 - t * 0.98,
            angle: -Math.PI / 2 + Math.cos(t * 7 + seed * 30) * 0.5,
          };
        },
        life: 0.6,
        fade: (t) => Math.min(1, t / 0.1, (1 - t) / 0.55),
        colours: [0, 1, 2],
      },
      0.9,
      0.34,
    ),
  },
  planes: {
    tones: [TONES.white, ["#FFD9A8", "#A9660A", "#FFF4E0"], TONES.rose],
    still: 2000,
    layers: depth(
      {
        count: 5,
        shape: "plane",
        size: [0.042, 0.058],
        path: (t, seed, index) => {
          const y = 0.12 + random(index, 4) * 0.7;
          const bob = Math.sin(t * 5 + seed * 9) * 0.05;
          return {
            x: -0.12 + t * 1.24,
            y: y + bob - t * 0.08,
            angle: -0.12 + Math.cos(t * 5 + seed * 9) * 0.3,
          };
        },
        life: 0.74,
        fade: soft,
        colours: [0, 1, 2],
      },
      1,
      0.6,
    ),
  },
  butterflies: {
    tones: [TONES.gold, TONES.pink, TONES.sky, TONES.violet],
    still: 2000,
    layers: depth(
      {
        count: 6,
        shape: "butterfly",
        size: [0.03, 0.044],
        path: (t, seed, index) => ({
          x:
            0.08 + random(index, 4) * 0.84 + Math.sin(t * 3 + seed * 12) * 0.12,
          y: 0.96 - t * 0.9 + Math.sin(t * 8 + seed * 7) * 0.04,
          angle: Math.sin(t * 3 + seed * 12) * 0.45,
          // about two beats a second: a flutter, not a flicker
          squash: 0.3 + 0.7 * Math.abs(Math.cos(t * 16 + seed * 6)),
        }),
        life: 0.84,
        fade: soft,
        colours: [0, 1, 2, 3],
      },
      1,
      0.6,
    ),
  },
  ink: {
    tones: [TONES.indigo, TONES.violet],
    still: 2300,
    layers: [
      {
        count: 8,
        shape: "ink",
        size: [0.06, 0.13],
        path: (t, seed, index) => ({
          x: seed,
          y: 0.08 + random(index, 4) * 0.84,
          angle: seed * TAU,
          grow: 0.25 + (1 - (1 - t) ** 3) * 0.75,
        }),
        life: 0.6,
        fade: (t) => Math.min(1, t / 0.1, (1 - t) / 0.5),
        colours: [0, 1],
      },
      {
        count: 16,
        shape: "snowball",
        size: [0.006, 0.014],
        path: (t, seed, index) => ({
          x: seed,
          y: random(index, 5) * 1.05 + t * 0.06,
        }),
        life: 0.5,
        alpha: 0.7,
        fade: soft,
        colours: [0, 1],
      },
    ],
  },
  shards: {
    tones: [TONES.aqua, TONES.violet, TONES.white],
    still: 2000,
    layers: [
      ...depth(
        {
          count: 12,
          shape: "shard",
          size: [0.022, 0.04],
          path: (t, seed) => {
            const a = seed * TAU;
            const out = 1 - (1 - t) ** 3;
            return {
              x: 0.5 + Math.cos(a) * (0.1 + out * 0.5),
              y: 0.42 + Math.sin(a) * (0.08 + out * 0.42) + t * 0.05,
              angle: a + t * 4,
              squash: 0.4 + 0.6 * Math.abs(Math.cos(t * 7 + seed * 9)),
            };
          },
          life: 0.86,
          start: (index) => random(index, 6) * 0.12,
          fade: soft,
          colours: [0, 1, 2],
        },
        0.9,
        0.5,
      ),
      {
        count: 9,
        shape: "sparkle",
        size: [0.012, 0.022],
        path: (_t, seed, index) => ({
          x: seed,
          y: random(index, 3),
          angle: index,
        }),
        life: 0.4,
        alpha: 0.9,
        fade: twinkle,
        colours: [2],
      },
    ],
  },
  comet: {
    tones: [TONES.sky, TONES.gold, TONES.white],
    still: 1900,
    layers: [
      {
        count: 40,
        shape: "sparkle",
        size: [0.007, 0.016],
        path: (t, seed, index) => {
          // left behind along the comet's way, then settling
          const along = 0.1 + random(index, 3) * 0.8;
          return {
            x: 1.06 - along * 1.2 + (seed - 0.5) * 0.08,
            y: 0.12 + along * 0.62 + (random(index, 6) - 0.5) * 0.08 + t * 0.05,
            angle: index,
          };
        },
        life: 0.5,
        start: (index) => 0.08 + random(index, 3) * 0.42,
        alpha: 0.8,
        fade: twinkle,
        colours: [0, 1, 2],
      },
      {
        count: 1,
        shape: "comet",
        size: [0.13, 0.13],
        // the head is at the end of the drawing, ahead of this point
        path: (t) => ({
          x: 1.78 - t * 1.56,
          y: -0.22 + t * 0.84,
          angle: Math.PI - 0.58,
        }),
        life: 0.76,
        start: () => 0.04,
        fade: soft,
        colours: [0],
      },
    ],
  },
  "glass-rain": {
    tones: [TONES.sky, TONES.aqua],
    still: 2300,
    layers: [
      {
        count: 44,
        shape: "bead",
        size: [0.005, 0.012],
        path: (_t, seed, index) => ({
          x: seed,
          y: random(index, 3),
        }),
        life: 0.9,
        alpha: 0.6,
        fade: soft,
        colours: [0, 1],
      },
      {
        count: 12,
        shape: "runnel",
        size: [0.05, 0.1],
        path: (t, seed, index) => {
          // catches, then runs on
          const steps = t * 3;
          const step = Math.floor(steps);
          const part = steps - step;
          const y = (step + part * part * (3 - 2 * part)) / 3;
          return {
            x: seed + Math.sin(y * 9 + index) * 0.012,
            y: -0.04 + random(index, 8) * 0.3 + y * 0.9,
            angle: Math.PI / 2,
          };
        },
        life: 0.86,
        fade: soft,
        colours: [0, 1],
      },
    ],
  },
  dust: {
    tones: [TONES.gold, TONES.rose, TONES.white],
    still: 2000,
    layers: depth(
      {
        count: 40,
        shape: "sparkle",
        size: [0.016, 0.03],
        path: (t, seed, index) => ({
          x: seed - 0.1 + t * 0.2,
          y:
            random(index, 3) * 1.04 +
            Math.sin(t * 3 + seed * 20) * 0.03 -
            t * 0.1,
          angle: t * 2 + index,
        }),
        life: 0.5,
        fade: twinkle,
        colours: [0, 1, 2],
      },
      0.9,
      0.34,
    ),
  },
  sunrays: {
    tones: [TONES.gold, TONES.amber],
    still: 2000,
    layers: [
      {
        count: 8,
        shape: "ray",
        size: [0.46, 0.6],
        path: (t, _seed, index) => {
          const a = 0.2 + index * 0.2 + Math.sin(t * 2.4 + index) * 0.03;
          const reach = 0.46 + random(index, 3) * 0.1;
          return {
            x: Math.cos(a) * reach,
            y: Math.sin(a) * reach * 0.56,
            angle: Math.atan2(Math.sin(a) * 0.56, Math.cos(a)),
          };
        },
        life: 0.96,
        start: () => 0.01,
        alpha: 0.34,
        fade: (t) => Math.sin(Math.PI * t) ** 0.7,
        colours: [0, 1],
      },
      ...depth(
        {
          count: 14,
          shape: "orb",
          size: [0.008, 0.016],
          path: (t, seed, index) => ({
            x: seed + t * 0.05,
            y: random(index, 3) * 0.9 + t * 0.06,
          }),
          life: 0.7,
          alpha: 0.8,
          fade: twinkle,
          colours: [0],
        },
        0.8,
        0.3,
      ),
    ],
  },
  moons: {
    tones: [TONES.moon, TONES.gold],
    still: 2200,
    layers: [
      {
        count: 18,
        shape: "sparkle",
        size: [0.008, 0.016],
        path: (_t, seed, index) => ({
          x: seed,
          y: random(index, 3),
          angle: index,
        }),
        life: 0.8,
        alpha: 0.7,
        fade: twinkle,
        colours: [1, 0],
      },
      {
        count: 8,
        shape: "moon",
        size: [0.05, 0.05],
        path: (t, _seed, index) => {
          const p = (index + 0.5) / 8;
          const lift = 1 - t;
          return {
            x: 0.08 + p * 0.84,
            y:
              0.3 -
              Math.sin(p * Math.PI) * 0.16 +
              (1 - (1 - lift) ** 3) * -0.04 +
              0.04,
            frame: index,
          };
        },
        life: 0.84,
        start: (index) => index * 0.018,
        alpha: 1,
        fade: soft,
        colours: [0],
      },
    ],
  },
  bloom: {
    tones: [TONES.pink, TONES.violet, TONES.gold, TONES.mint],
    still: 2100,
    layers: [
      ...[0, 1, 2].map((ring) => ({
        count: 1,
        shape: "rosette" as const,
        size: [0.18 + ring * 0.13, 0.18 + ring * 0.13] as [number, number],
        path: (t: number) => ({
          x: 0.5,
          y: 0.4,
          angle: t * (ring % 2 ? -1.2 : 1.2) + ring,
          grow: 0.2 + (1 - (1 - t) ** 3) * 0.8,
        }),
        life: 0.82,
        start: () => 0.02 + ring * 0.08,
        alpha: 1 - ring * 0.18,
        fade: soft,
        colours: [ring],
      })),
      {
        count: 8,
        shape: "rosette",
        size: [0.05, 0.08],
        path: (t, seed, index) => {
          const a = (index / 8) * TAU + 0.4;
          return {
            x: 0.5 + Math.cos(a) * 0.42,
            y: 0.4 + Math.sin(a) * 0.32,
            angle: t * 2 + seed,
            grow: 0.3 + t * 0.7,
          };
        },
        life: 0.62,
        start: (index) => 0.14 + index * 0.02,
        alpha: 0.8,
        fade: soft,
        colours: [0, 1, 2, 3],
      },
    ],
  },
  waves: {
    tones: [TONES.sky, TONES.aqua, TONES.indigo],
    still: 2000,
    layers: [
      {
        count: 9,
        shape: "wave",
        size: [0.42, 0.5],
        path: (t, _seed, index) => ({
          x: 0.5 + Math.sin(t * 3 + index) * 0.06,
          y: 0.14 + index * 0.092 + Math.sin(t * 4 + index * 0.8) * 0.012,
          angle: Math.sin(t * 2.4 + index * 1.4) * 0.04,
        }),
        life: 0.94,
        start: (index) => index * 0.004,
        alpha: 0.8,
        fade: soft,
        colours: [0, 1, 2],
      },
    ],
  },
  burst: {
    tones: [TONES.pink, TONES.sky, TONES.gold, TONES.mint, TONES.violet],
    still: 1000,
    layers: [0, 1].flatMap((side) =>
      depth(
        {
          count: 24,
          shape: "paper",
          size: [0.016, 0.026],
          path: (t, seed, index) => {
            const a = -Math.PI / 2 + (side ? -1 : 1) * (0.1 + seed * 0.8);
            const power = 0.7 + random(index, 7) * 0.6;
            const out = 1 - (1 - t) ** 2.4;
            return {
              x: (side ? 1.02 : -0.02) + Math.cos(a) * power * out * 0.7,
              y: 1.04 + Math.sin(a) * power * out * 0.95 + t * t * 0.74,
              angle: t * 9 + seed * TAU,
              squash: 0.25 + 0.75 * Math.abs(Math.cos(t * 12 + seed * 9)),
            };
          },
          life: 0.8,
          start: (index) => random(index, 5) * 0.14,
          fade: (t) => Math.min(1, t / 0.05, (1 - t) / 0.3),
          colours: [0, 1, 2, 3, 4],
        },
        0.7,
        0.38,
      ),
    ),
  },
  feathers: {
    tones: [TONES.white, TONES.rose, TONES.pink],
    still: 2000,
    layers: depth(
      {
        count: 10,
        shape: "feather",
        size: [0.04, 0.056],
        path: (t, seed) => ({
          x: seed + Math.sin(t * 5 + seed * 20) * 0.08,
          y: -0.1 + t * 1.2,
          angle: Math.sin(t * 5 + seed * 20) * 0.6 + seed,
        }),
        life: 0.84,
        fade: soft,
        colours: [0, 1, 2],
      },
      1,
      0.5,
    ),
  },
  dandelions: {
    tones: [TONES.white, ["#FFF4C8", "#8E7A2E", "#FFFFFF"]],
    still: 2000,
    layers: depth(
      {
        count: 11,
        shape: "seed",
        size: [0.03, 0.044],
        path: (t, seed, index) => ({
          x: seed * 1.2 - 0.3 + t * 0.56,
          y:
            0.96 -
            random(index, 4) * 0.3 -
            t * 0.7 +
            Math.sin(t * 6 + seed * 20) * 0.03,
          angle: 0.5 + Math.sin(t * 5 + seed * 9) * 0.3,
        }),
        life: 0.86,
        fade: soft,
        colours: [0, 1],
      },
      1,
      0.5,
    ),
  },
  hearts: {
    tones: [TONES.pink, TONES.rose, ["#FF4F6E", "#A0122F", "#FFC9D2"]],
    still: 2200,
    layers: depth(
      {
        count: 13,
        shape: "heart",
        size: [0.024, 0.036],
        path: (t, seed) => ({
          ...rise(0.05, 0.3)(t, seed),
          grow: 0.92 + 0.08 * Math.sin(t * 14 + seed * 9),
        }),
        life: 0.8,
        fade: soft,
        colours: [0, 1, 2],
      },
      1,
      0.46,
    ),
  },
};

/** Fades a whole play in and out, so it never cuts */
const envelope = (now: number) => Math.min(1, now / 0.06, (1 - now) / 0.1);

/**
 * Everything on screen `ms` after the effect started. Empty before the start
 * and after the end, so an effect can't run on by mistake.
 */
export function effectFrame(id: EffectId, ms: number): Particle[] {
  const spec = SPECS[id];
  if (!spec || ms < 0 || ms >= EFFECT_DURATION_MS) return [];
  const now = ms / EFFECT_DURATION_MS;
  const whole = envelope(now);
  const particles: Particle[] = [];

  spec.layers.forEach((layer, order) => {
    for (let index = 0; index < layer.count; index++) {
      const salt = index + order * 101;
      const seed = random(salt, 1);
      // most are already on their way when the play opens
      const start =
        layer.start?.(index) ??
        random(salt, 2) * (1 - layer.life * 0.4) - layer.life * 0.6;
      const t = (now - start) / layer.life;
      if (t <= 0 || t >= 1) continue;

      const place = layer.path(t, seed, index);
      const base =
        layer.size[0] + random(salt, 3) * (layer.size[1] - layer.size[0]);
      particles.push({
        x: place.x,
        y: place.y,
        angle: place.angle ?? 0,
        size: base * (place.grow ?? 1),
        alpha:
          Math.max(0, layer.fade(t, seed)) *
          (layer.alpha ?? 1) *
          whole *
          EFFECT_MAX_ALPHA,
        shape: layer.shape,
        colour: layer.colours[index % layer.colours.length],
        squash: place.squash ?? 1,
        frame: place.frame ?? 0,
      });
    }
  });

  return particles;
}

/** The tones an effect is drawn with */
export const effectTones = (id: EffectId) => SPECS[id].tones;

/** Small canvases, one per drawing and colour: blitted, never redrawn */
const SPRITES_KEPT = 96;

/** Wide drawings fill a tile as they are: enlarged, they would crowd it */
const WIDE = new Set<EffectShape>([
  "curtain",
  "ray",
  "comet",
  "rosette",
  "ripple",
  "wave",
  "moon",
  "runnel",
]);
const sprites = new Map<string, HTMLCanvasElement>();

function sprite(shape: EffectShape, tone: Tone, frame: number) {
  const key = `${shape}|${tone[0]}|${frame}`;
  let found = sprites.get(key);
  if (!found) {
    const [w, h] = shapeReach(shape);
    const unit = shapeUnit(shape);
    found = document.createElement("canvas");
    found.width = Math.ceil(w * 2 * unit);
    found.height = Math.ceil(h * 2 * unit);
    const context = found.getContext("2d");
    if (context) {
      context.translate(found.width / 2, found.height / 2);
      context.scale(unit, unit);
      drawShape(context, shape, tone, frame);
    }
    sprites.set(key, found);
    if (sprites.size > SPRITES_KEPT) {
      sprites.delete(sprites.keys().next().value as string);
    }
  }
  return found;
}

function paint(
  context: CanvasRenderingContext2D,
  id: EffectId,
  ms: number,
  width: number,
  height: number,
  scale: number,
  solid: number,
) {
  const tones = SPECS[id].tones;
  context.clearRect(0, 0, width, height);
  for (const particle of effectFrame(id, ms)) {
    const tone = tones[particle.colour] ?? tones[0];
    const image = sprite(particle.shape, tone, particle.frame);
    const [w, h] = shapeReach(particle.shape);
    const size = particle.size * width * (WIDE.has(particle.shape) ? 1 : scale);
    context.save();
    context.globalAlpha = Math.min(1, particle.alpha * solid);
    context.translate(particle.x * width, particle.y * height);
    context.rotate(particle.angle);
    context.scale(size * particle.squash, size);
    context.drawImage(image, -w, -h, w * 2, h * 2);
    context.restore();
  }
}

/** Draw one frame of a play */
export function drawEffect(
  context: CanvasRenderingContext2D,
  id: EffectId,
  ms: number,
  width: number,
  height: number,
) {
  paint(context, id, ms, width, height, 1, 1);
}

/**
 * A still picture for a tile. A tile is much smaller than a card and has no
 * text under it, so the picture is drawn larger and fully solid, at the moment
 * the effect looks fullest. `pixels` is how many canvas pixels to a CSS pixel.
 */
export function drawEffectStill(
  context: CanvasRenderingContext2D,
  id: EffectId,
  width: number,
  height: number,
  pixels = 2,
) {
  const scale = Math.min(2.6, Math.max(1, 300 / (width / pixels)));
  paint(context, id, SPECS[id].still, width, height, scale, 1.3);
}
