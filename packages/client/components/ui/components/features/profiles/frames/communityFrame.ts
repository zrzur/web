/**
 * A creator's profile frame is a picture on a fixed template, still or
 * moving (animated GIF, WebP or PNG; anyone who turns motion off sees a still
 * of it), laid
 * over the card with a nine-slice `border-image`: the corners keep their
 * shape, the sides stretch with the card's height, and the whole scales with
 * the card's width. The same numbers are in the backend
 * (`PROFILE_FRAME_TEMPLATE`, users.rs), which refuses a file that draws over
 * the card's content.
 *
 * Template (CSS px, the file is twice this):
 *
 *   0,0 ┌──────────────── 400 ────────────────┐
 *       │       crest room (70 above)          │
 *    70 │   ┌── card 30,70 .. 370,470 ──┐      │
 *       │   │  10 px band, crest window  │      │
 *       │   │  120..280 x 80..110        │      │
 *   470 │   └────────────────────────────┘      │
 *       │       40 below                        │
 *   510 └───────────────────────────────────────┘
 */
export const FRAME_TEMPLATE = {
  width: 400,
  height: 510,
  /** the file's pixels per template px */
  density: 2,
  card: { left: 30, top: 70, right: 370, bottom: 470 },
  /** the slices: the frame's band plus what reaches into the card */
  slice: { top: 110, side: 40, bottom: 50 },
  /**
   * Must stay transparent, it lies over the card's content: the card less
   * 10 px on every side (`safe` in the backend's template)
   */
  safe: { left: 40, top: 80, right: 360, bottom: 460 },
  /** May be drawn on although inside `safe`: over the middle of the banner */
  crest: { left: 120, top: 80, right: 280, bottom: 110 },
} as const;

/** The file's size in pixels (the backend's `PROFILE_FRAME_FILE_SIZE`) */
export const FRAME_FILE = {
  width: FRAME_TEMPLATE.width * FRAME_TEMPLATE.density,
  height: FRAME_TEMPLATE.height * FRAME_TEMPLATE.density,
} as const;

/**
 * Least alpha (of 255) that counts as drawn in the safe zone; anti-aliasing
 * at the edge of the band may spill a hair inside (backend
 * `FRAME_ALPHA_LIMIT`)
 */
export const FRAME_ALPHA_LIMIT = 16;

/**
 * Most frames a moving profile frame may have: the server's `max_frames`
 * (community settings). There is no length limit.
 */
export const FRAME_MAX_FRAMES = 240;

/** Formats a frame file may be, still or moving */
export const FRAME_TYPES = [
  "image/png",
  "image/apng",
  "image/webp",
  "image/gif",
] as const;

const T = FRAME_TEMPLATE;
const OUT_TOP = T.card.top;
const OUT_SIDE = T.card.left;
const OUT_BOTTOM = T.height - T.card.bottom;
const CARD_WIDTH = T.card.right - T.card.left;

/**
 * The `border-image` that lays a frame file over a box of `width` CSS px.
 * The scale follows the width, so a 460 px full profile shows the same frame
 * as a 340 px card, only larger.
 */
export function frameBorderImage(url: string, width: number) {
  const s = width / CARD_WIDTH;
  const px = (n: number) => `${+(n * s).toFixed(2)}px`;
  // shares of the picture, not its pixels: the still a viewer without motion
  // gets is smaller than the file, and is cut in the same places
  const pct = (n: number, of: number) => `${+((n / of) * 100).toFixed(4)}%`;
  const vertical = (n: number) => pct(n, T.height);
  const side = pct(T.slice.side, T.width);
  return {
    "border-style": "solid",
    "border-color": "transparent",
    "border-image-source": `url("${url}")`,
    "border-image-slice": `${vertical(T.slice.top)} ${side} ${vertical(T.slice.bottom)} ${side}`,
    "border-image-width": `${px(T.slice.top)} ${px(T.slice.side)} ${px(T.slice.bottom)} ${px(T.slice.side)}`,
    "border-image-outset": `${px(OUT_TOP)} ${px(OUT_SIDE)} ${px(OUT_BOTTOM)} ${px(OUT_SIDE)}`,
    "border-image-repeat": "stretch",
  } as const;
}

/** How far a community frame rises above the card at this width */
export const frameRise = (width: number) => (OUT_TOP * width) / CARD_WIDTH;
