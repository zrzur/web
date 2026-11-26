/**
 * Frames drawn ahead of time (pixel/set/): each is two corners of pixel art,
 * the top start and the bottom end, which never meet. They are drawn on 4 px
 * cells by the design kit and placed here round a card of any size: the top
 * piece at the card's top-left corner, the end piece at its bottom-right one,
 * both scaled to the pixel size (4, 3 or 2 css px; every coordinate is a
 * multiple of 4, so the cells stay whole pixels).
 *
 * The markup is our own pre-generated art (paths in our palettes and the logo
 * master file), never text from a user.
 */
import type { FrameRoom } from "../frameRoom";

export type FramePieces = {
  /** cells from the card's top-left corner */
  top: string;
  /** cells from the card's bottom-right corner */
  end: string;
  /** sparkles and glows of each corner, which twinkle */
  topTwinkle: string;
  endTwinkle: string;
};

/** The SVG of a pre-drawn frame round a card of `w` x `h` css px */
export function drawPieces(
  art: FramePieces,
  w: number,
  h: number,
  cell: number,
  room: FrameRoom,
) {
  const s = cell / 4;
  const W = w + 2 * room.x;
  const H = h + room.top + room.bottom;
  const at = (x: number, y: number, body: string, twinkle?: boolean) =>
    body
      ? `<g transform="translate(${x} ${y}) scale(${s})"${twinkle ? ' class="z-frame-twinkle"' : ""}>${body}</g>`
      : "";
  // on a short card a corner's long side may reach past the room: it is cut
  // at the room's edge, where the frame layer ends
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${-room.x} ${-room.top} ${W} ${H}" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><defs><clipPath id="room"><rect x="${-room.x}" y="${-room.top}" width="${W}" height="${H}"/></clipPath></defs><g clip-path="url(#room)">${at(0, 0, art.top)}${at(w, h, art.end)}${at(0, 0, art.topTwinkle, true)}${at(w, h, art.endTwinkle, true)}</g></svg>`;
}
