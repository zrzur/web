/**
 * What every screen may need to know about the effects. The drawings live in
 * `effects.ts` and `shapes.ts`, which load the first time an effect is shown.
 */

/** Longest time an effect may play: one play, then it is removed */
export const EFFECT_DURATION_MS = 4000;

import { PACK_EFFECT_IDS } from "./packIds.generated";

/** Zrzur's first effects, each drawn by hand in `shapes.ts` */
export const BUILT_IN_EFFECT_IDS = [
  "snow",
  "rain",
  "confetti",
  "sparks",
  "petals",
  "bubbles",
  "leaves",
  "fireflies",
  "ripples",
  "kites",
  "aurora",
  "starfall",
  "lanterns",
  "sakura",
  "embers",
  "planes",
  "butterflies",
  "ink",
  "shards",
  "comet",
  "glass-rain",
  "dust",
  "sunrays",
  "moons",
  "bloom",
  "waves",
  "burst",
  "feathers",
  "dandelions",
  "hearts",
] as const;

/** Every effect: the first ones, then the design pack's */
export const EFFECT_IDS = [...BUILT_IN_EFFECT_IDS, ...PACK_EFFECT_IDS] as const;

export type BuiltInEffectId = (typeof BUILT_IN_EFFECT_IDS)[number];

export type EffectId = (typeof EFFECT_IDS)[number];

/** Whether a stored value is one of Zrzur's own effects */
export const isEffectId = (value: unknown): value is EffectId =>
  (EFFECT_IDS as readonly unknown[]).includes(value);
