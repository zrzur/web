/**
 * A creator's profile frame is one still picture on a fixed template, laid
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
} as const;

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
  const d = T.density;
  return {
    "border-style": "solid",
    "border-color": "transparent",
    "border-image-source": `url("${url}")`,
    "border-image-slice": `${T.slice.top * d} ${T.slice.side * d} ${T.slice.bottom * d} ${T.slice.side * d}`,
    "border-image-width": `${px(T.slice.top)} ${px(T.slice.side)} ${px(T.slice.bottom)} ${px(T.slice.side)}`,
    "border-image-outset": `${px(OUT_TOP)} ${px(OUT_SIDE)} ${px(OUT_BOTTOM)} ${px(OUT_SIDE)}`,
    "border-image-repeat": "stretch",
  } as const;
}

/** How far a community frame rises above the card at this width */
export const frameRise = (width: number) => (OUT_TOP * width) / CARD_WIDTH;
