/**
 * "Crystal cave": a pixel-art profile frame. A stone shelf hugs two opposite
 * corners of the card (top start and, smaller, bottom end); amethyst and teal
 * crystals grow out of it in hand-placed clusters, with sparkles. Our own
 * drawing on a pixel grid (owner approved it on 2026-11-22).
 *
 * Drawn the way pixel art is drawn, not by rasterising rotated shapes:
 * - one pixel size (`cell` css px), crisp, five-step palettes, no gradients;
 * - crystals are upright prisms built column by column; a lean moves whole
 *   pixels; three facets (lit, middle, shadow) meet at the point, a ridge of
 *   light runs up the lit facet, and every crystal has its own outline;
 * - the shelf is one solid mass with a lit edge, blotchy stone and a dark foot;
 * - light comes from the top start, in both corners (the bottom-end corner is
 *   the drawing turned round, with its lit sides swapped back).
 *
 * The composition is in cells, so a smaller cell draws the same frame
 * smaller. Nothing reaches into the card but along its top edge, over the
 * banner, and there no more than `INSIDE` cells.
 */

/** Room the drawing uses round the card, in cells */
export const CRYSTAL_ROOM = { x: 14, top: 24, bottom: 18 } as const;
/** deepest a part may reach into the card, in cells */
const INSIDE = 2;

const PAL = {
  ink: "#110C1F",
  rock: ["#1E1830", "#2C2444", "#3E345E", "#574B80", "#7F70AC"],
  ame: ["#2C114D", "#4F2391", "#7A3CCB", "#A56FF0", "#E6D2FF"],
  teal: ["#0A3940", "#117171", "#27AA9D", "#76E4D4", "#E4FFF9"],
  spark: ["#FFE29A", "#FFFFFF"],
} as const;

type Mound = { at: number; half: number; h: number };
type Shelf = { corner: number; end: number; min: number; mounds?: Mound[] };
type Crystal = { w: number; h: number; lean: number; p: "ame" | "teal" };
type Corner = {
  shelf: Shelf;
  side: Shelf;
  /** standing on the shelf along the top edge; x from the corner */
  crystals: (Crystal & { x: number })[];
  /** pointing out of the start side; y from the corner */
  sideCrystals: (Crystal & { y: number })[];
  sparks: { x: number; y: number; big: boolean }[];
};

/** Back to front. Cells from the card's top-start corner. */
const TOP: Corner = {
  shelf: {
    corner: 8,
    end: 0.14,
    min: 2,
    mounds: [
      { at: 39, half: 10, h: 4 },
      { at: 54, half: 4, h: 2 },
    ],
  },
  side: {
    corner: 8,
    end: 0.06,
    min: 2,
    mounds: [
      { at: 19, half: 8, h: 4 },
      { at: 32, half: 3, h: 2 },
    ],
  },
  crystals: [
    { x: -9, w: 5, h: 10, lean: -0.18, p: "ame" },
    { x: 10, w: 5, h: 13, lean: 0.15, p: "ame" },
    { x: -3, w: 5, h: 13, lean: -0.06, p: "teal" },
    { x: -6, w: 7, h: 12, lean: -0.12, p: "ame" },
    { x: 7, w: 7, h: 12, lean: 0.12, p: "teal" },
    { x: 0, w: 9, h: 15, lean: -0.03, p: "ame" },
    { x: 13, w: 5, h: 9, lean: 0.22, p: "ame" },
    { x: -8, w: 5, h: 7, lean: -0.2, p: "ame" },
    { x: -4, w: 5, h: 7, lean: -0.1, p: "teal" },
    { x: 3, w: 5, h: 6, lean: 0.08, p: "ame" },
    { x: 18, w: 3, h: 5, lean: 0.25, p: "teal" },
    { x: 34, w: 5, h: 9, lean: -0.12, p: "ame" },
    { x: 39, w: 7, h: 12, lean: 0.05, p: "ame" },
    { x: 44, w: 3, h: 6, lean: 0.2, p: "teal" },
    { x: 37, w: 3, h: 4, lean: -0.2, p: "teal" },
  ],
  sideCrystals: [
    { y: 13, w: 5, h: 7, lean: 0.12, p: "ame" },
    { y: 18, w: 3, h: 5, lean: -0.15, p: "teal" },
    { y: 28, w: 3, h: 4, lean: 0.1, p: "ame" },
  ],
  sparks: [
    { x: -9, y: -27, big: true },
    { x: 24, y: -12, big: false },
    { x: 50, y: -16, big: true },
    { x: -11, y: 30, big: false },
  ],
};

/** The bottom-end corner, drawn as a top start and then turned round */
const BOTTOM: Corner = {
  shelf: { corner: 6, end: 0.07, min: 2, mounds: [{ at: 24, half: 7, h: 3 }] },
  side: { corner: 6, end: 0.05, min: 2, mounds: [{ at: 22, half: 6, h: 3 }] },
  crystals: [
    { x: -8, w: 5, h: 6, lean: -0.2, p: "ame" },
    { x: 4, w: 5, h: 8, lean: 0.1, p: "teal" },
    { x: -3, w: 7, h: 9, lean: -0.08, p: "ame" },
    { x: 9, w: 3, h: 5, lean: 0.2, p: "ame" },
    { x: 1, w: 5, h: 5, lean: 0, p: "ame" },
    { x: 22, w: 5, h: 6, lean: -0.05, p: "ame" },
    { x: 27, w: 3, h: 4, lean: 0.2, p: "teal" },
  ],
  sideCrystals: [
    { y: -4, w: 7, h: 7, lean: 0.05, p: "ame" },
    { y: 7, w: 5, h: 7, lean: 0.08, p: "teal" },
    { y: 2, w: 7, h: 8, lean: -0.04, p: "ame" },
    { y: 12, w: 5, h: 5, lean: -0.06, p: "ame" },
    { y: 21, w: 5, h: 6, lean: 0.05, p: "ame" },
    { y: 25, w: 3, h: 4, lean: -0.1, p: "teal" },
  ],
  sparks: [
    { x: -6, y: -20, big: true },
    { x: 20, y: -10, big: false },
  ],
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Put = (x: number, y: number, colour: string, layer: number) => void;
const SIDES: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * One corner, drawn as if it were the top start: x along the top edge, y up
 * out of the card is negative. `put` maps it onto the real grid.
 */
function drawCorner(
  comp: Corner,
  cardW: number,
  cardH: number,
  put: Put,
  rand: () => number,
  turned: boolean,
) {
  // turned round, "up" in the drawing is down on the screen: the lit sides
  // swap so the light still comes from the top start
  const flip = turned ? -1 : 1;
  const thick = (spec: Shelf, along: number, length: number) => {
    const end = spec.end * length;
    let run = 0;
    if (along <= end) {
      const t = Math.max(0, along) / end;
      run = Math.max(
        spec.min,
        Math.round(spec.min + (spec.corner - spec.min) * Math.pow(1 - t, 1.1)),
      );
    }
    for (const m of spec.mounds ?? []) {
      const d = Math.abs(along - m.at) / m.half;
      if (d < 1)
        run = Math.max(
          run,
          Math.max(1, Math.round(m.h * Math.sqrt(1 - d * d))),
        );
    }
    return run;
  };
  // a blocky silhouette: steps of a cell, changing every two cells
  const steps = new Map<string, number>();
  const bump = (key: string, near: boolean) => {
    if (!steps.has(key)) {
      const r = rand();
      steps.set(key, r < 0.3 ? 1 : r < 0.42 && near ? 2 : r < 0.55 ? -1 : 0);
    }
    return steps.get(key)!;
  };
  const shelfTop = (x: number) => {
    const t = thick(comp.shelf, x, cardW);
    return t ? Math.max(1, t + (x > 0 ? bump(`t${x >> 1}`, x < 14) : 0)) : 0;
  };
  const shelfSide = (y: number) => {
    const t = thick(comp.side, y, cardH);
    return t ? Math.max(1, t + (y > 0 ? bump(`s${y >> 1}`, y < 12) : 0)) : 0;
  };

  const farthest = (spec: Shelf, length: number) =>
    Math.max(
      Math.ceil(spec.end * length),
      ...(spec.mounds ?? []).map((m) => m.at + m.half),
    ) + 1;
  const rock = new Map<string, [number, number]>();
  const mark = (x: number, y: number) => rock.set(`${x},${y}`, [x, y]);
  for (let x = -comp.side.corner; x <= farthest(comp.shelf, cardW); x++) {
    const t = x < 0 ? comp.shelf.corner : shelfTop(x);
    for (let y = -t; t > 0 && y < INSIDE; y++) mark(x, y);
  }
  for (let y = -comp.shelf.corner; y <= farthest(comp.side, cardH); y++) {
    const t = y < 0 ? comp.side.corner : shelfSide(y);
    for (let x = -t; t > 0 && x < INSIDE; x++) mark(x, y);
  }
  // round off the outer corner: a boulder mass
  const R = comp.shelf.corner + 1;
  for (const [key, [x, y]] of [...rock.entries()])
    if (x < 0 && y < 0 && Math.hypot(x + 0.5, y + 0.5) > R) rock.delete(key);
  for (let y = -R; y < 0; y++)
    for (let x = -R; x < 0; x++)
      if (Math.hypot(x + 0.5, y + 0.5) <= R - 0.2) mark(x, y);
  const has = (x: number, y: number) => rock.has(`${x},${y}`);

  // blotches of lighter and darker stone, a few cells across
  const blotch = new Map<string, number>();
  const tile = (x: number, y: number) => {
    const key = `${Math.floor(x / 3)},${Math.floor(y / 2)}`;
    if (!blotch.has(key)) blotch.set(key, rand());
    return blotch.get(key)!;
  };
  const shelf: [number, number, number][] = [];
  for (const [x, y] of rock.values()) {
    const open = (dx: number, dy: number) => !has(x + dx * flip, y + dy * flip);
    let tone: number;
    if (open(0, -1) || open(-1, 0)) tone = 4;
    else if (open(0, -2) || open(-2, 0)) tone = 3;
    else if (open(0, 1) || open(1, 0)) tone = 1;
    else {
      const b = tile(x, y);
      tone = b > 0.72 ? 3 : b < 0.22 ? 1 : 2;
      if (
        tone === 2 &&
        tile(x, y - 1) > 0.72 &&
        Math.floor(y / 2) !== Math.floor((y - 1) / 2)
      )
        tone = 1;
    }
    if (tone === 2 && rand() < 0.03) tone = 0;
    shelf.push([x, y, tone]);
  }
  for (const [x, y] of rock.values())
    for (const [dx, dy] of SIDES)
      if (!has(x + dx, y + dy)) put(x + dx, y + dy, PAL.ink, 0);

  // crystals first: the shelf covers their feet
  const crystalAt = (
    c: Crystal,
    orient: (a: number, b: number, colour: string) => void,
  ) => {
    const half = (c.w - 1) / 2;
    const tipRows = half + 1;
    const cells: [number, number, number][] = [];
    for (let r = 0; r < c.h; r++) {
      const hw =
        r < tipRows ? Math.round((r * half) / (tipRows - 1 || 1)) : half;
      const shift = Math.round((c.h - r) * c.lean);
      for (let k = -hw; k <= hw; k++) {
        const third = Math.max(1, Math.round(hw / 3));
        const kk = k * flip;
        let tone = kk < -third ? 3 : kk <= third - 1 ? 2 : 1;
        if (kk === -third && r < c.h * 0.65) tone = 4;
        if (r < 2 && kk <= 0) tone = 4;
        if (r === tipRows - 1 && tone < 4) tone = Math.max(1, tone - 1);
        if (r >= c.h - 1) tone = Math.max(0, tone - 1);
        cells.push([k + shift, r - c.h, tone]);
      }
    }
    const pal = PAL[c.p];
    const set = new Set(cells.map(([a, b]) => `${a},${b}`));
    for (const [a, b] of cells)
      for (const [dx, dy] of SIDES)
        if (!set.has(`${a + dx},${b + dy}`)) orient(a + dx, b + dy, PAL.ink);
    for (const [a, b, tone] of cells) orient(a, b, pal[tone]);
  };
  for (const c of comp.crystals) {
    const base = c.x < 0 ? comp.shelf.corner : shelfTop(c.x);
    crystalAt(c, (a, b, colour) => put(c.x + a, b - base + 1, colour, 1));
  }
  for (const c of comp.sideCrystals) {
    const base = shelfSide(c.y);
    crystalAt(c, (a, b, colour) => put(b - base + 1, c.y + a, colour, 1));
  }
  for (const [x, y, tone] of shelf) put(x, y, PAL.rock[tone], 2);
  return comp.sparks;
}

/**
 * The frame for a card of `w` x `h` css px, drawn with `cell` px pixels. The
 * SVG starts `room.x` left of the card and `room.top` above it.
 */
export function crystalCave(w: number, h: number, cell: number) {
  const rand = rng(5);
  // the composition's lengths along the edges, in cells
  const cw = Math.round(w / cell);
  const ch = Math.round(h / cell);

  // Each corner is drawn on its own grid, anchored to its own corner of the
  // card, so the card's edges always fall on pixel lines (a card's width is
  // rarely a multiple of the pixel size).
  type Pixel = { x: number; y: number; colour: string; z: number };
  const pixels: Pixel[] = [];
  const sparks: [number, number, boolean][] = [];
  const corner = (comp: Corner, turned: boolean) => {
    const cells = new Map<string, Pixel>();
    // css px of a cell's top-left: from the top-start corner, or turned
    // round from the bottom-end one
    const css = (x: number, y: number): [number, number] =>
      turned ? [w - (x + 1) * cell, h - (y + 1) * cell] : [x * cell, y * cell];
    // Into the card only along its top, over the banner, and then `INSIDE`
    // cells at most. On the sides and at the bottom the card's text scrolls
    // right up to the edge, so there the frame stays wholly outside.
    const allowed = (x: number, y: number) =>
      x < 0 || y < 0 || (!turned && y < INSIDE);
    const put: Put = (x, y, colour, z) => {
      if (!allowed(x, y)) return;
      const key = `${x},${y}`;
      const old = cells.get(key);
      if (colour === PAL.ink && old && old.z > z) return;
      cells.set(key, { x, y, colour, z: Math.max(old?.z ?? -1, z) });
    };
    for (const s of drawCorner(comp, cw, ch, put, rand, turned))
      sparks.push([...css(s.x, s.y), s.big]);
    for (const p of cells.values()) {
      const [X, Y] = css(p.x, p.y);
      pixels.push({ ...p, x: X, y: Y });
    }
  };
  corner(TOP, false);
  corner(BOTTOM, true);

  // one rect per run of equal pixels on a row
  pixels.sort((a, b) => a.y - b.y || a.x - b.x);
  const rects: string[] = [];
  for (let i = 0; i < pixels.length; ) {
    const start = pixels[i];
    let end = i + 1;
    while (
      end < pixels.length &&
      pixels[end].y === start.y &&
      pixels[end].colour === start.colour &&
      pixels[end].x === start.x + (end - i) * cell
    )
      end++;
    rects.push(
      `<rect x="${start.x}" y="${start.y}" width="${(end - i) * cell}" height="${cell}" fill="${start.colour}"/>`,
    );
    i = end;
  }
  const c = cell;
  const sparkSvg = sparks
    .map(([X, Y, big], i) => {
      const arm = big ? 2 : 1;
      return (
        `<g style="animation-delay:${(i * 0.45).toFixed(2)}s">` +
        `<rect x="${X}" y="${Y - arm * c}" width="${c}" height="${(2 * arm + 1) * c}" fill="${PAL.spark[0]}"/>` +
        `<rect x="${X - arm * c}" y="${Y}" width="${(2 * arm + 1) * c}" height="${c}" fill="${PAL.spark[0]}"/>` +
        `<rect x="${X}" y="${Y}" width="${c}" height="${c}" fill="${PAL.spark[1]}"/></g>`
      );
    })
    .join("");

  const room = {
    x: CRYSTAL_ROOM.x * cell,
    top: CRYSTAL_ROOM.top * cell,
    bottom: CRYSTAL_ROOM.bottom * cell,
  };
  const W = w + 2 * room.x;
  const H = h + room.top + room.bottom;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${-room.x} ${-room.top} ${W} ${H}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects.join("")}<g class="z-frame-twinkle">${sparkSvg}</g></svg>`;
  return { svg, room };
}
