export const SKY_WIDTH = 1200;
export const SKY_HEIGHT = 320;

export type SkyBird = { x: number; y: number; r: number; o: number };

/** A small repeatable random source, so the flock looks the same every visit */
export function seededRandom(seed: number) {
  let n = seed >>> 0;
  return () => {
    n = (n + 0x6d2b79f5) >>> 0;
    let t = n;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bell = (random: () => number) =>
  Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(Math.PI * 2 * random());

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * The flock as one long wheeling line across the sky: thick where it turns,
 * pinched between. The same seed gives the same birds in the same order, so
 * `skyScattered` can fly into it dot by dot.
 */
export function skyFlock(count: number, seed = 5): SkyBird[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => {
    const u = random();
    const phase = u * Math.PI * 2.4 + 0.5;
    const belly = 0.2 + 0.8 * Math.abs(Math.cos(phase));
    const spread = (10 + 30 * Math.sin(Math.PI * u) ** 2) * belly;
    const near = random();
    return {
      x: clamp(
        20 + (SKY_WIDTH - 40) * u + bell(random) * spread,
        8,
        SKY_WIDTH - 8,
      ),
      y: clamp(
        // the upper half: the words stand on the lower part of the sky
        SKY_HEIGHT * 0.34 +
          Math.sin(phase) * SKY_HEIGHT * 0.2 +
          bell(random) * spread * 0.7,
        8,
        SKY_HEIGHT - 8,
      ),
      r: 1.25 + near * near * 2.25,
      o: 0.3 + near * 0.6,
    };
  });
}

/** Where each bird of `skyFlock` starts: spread thinly over the whole sky */
export function skyScattered(count: number, seed = 9): SkyBird[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => ({
    x: random() * SKY_WIDTH,
    y: random() * SKY_HEIGHT,
    r: 1,
    o: 0,
  }));
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Birds as one path of small wings, the same mark the flock on zrzur.com flies
 * with: a drawing, not two hundred elements. Each faces along the line of the
 * flock, with a little of its own turn.
 */
export function skyPath(birds: Pick<SkyBird, "x" | "y" | "r">[]) {
  return birds
    .map((bird) => {
      const size = bird.r * 2.1;
      const turn = -0.45 + 0.8 * Math.sin(bird.x * 0.011 + bird.y * 0.07);
      const hx = Math.cos(turn) * size;
      const hy = Math.sin(turn) * size;
      const point = (back: number, side: number) =>
        `${round(bird.x + hx * back - hy * side)} ${round(bird.y + hy * back + hx * side)}`;
      return `M${point(0.55, 0)}L${point(-0.75, 0.85)}L${point(-0.2, 0)}L${point(-0.75, -0.85)}Z`;
    })
    .join("");
}

/** The flock at rest: one path for each of a few strengths of grey */
export function skyLayers(birds: SkyBird[], steps = 5) {
  const layers = new Map<number, SkyBird[]>();
  for (const bird of birds) {
    const opacity = Math.round(bird.o * steps) / steps;
    layers.set(opacity, [...(layers.get(opacity) ?? []), bird]);
  }
  return [...layers.entries()].map(([opacity, list]) => ({
    opacity,
    d: skyPath(list),
  }));
}
