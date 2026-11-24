/**
 * Zrzur's own profile frames: the drawings (ids and sizes are in
 * `frameIds.ts`, which loads no art). Each is drawn for the card's real size and
 * says how much room round the card it uses; the frame layer is placed by
 * that room. Drawings are hand-composed pixel art (frames/pixel/), added one
 * at a time after the owner has seen each on a real card.
 *
 * Every value put into the markup is a number or a colour from our own
 * palettes, never text from a user, so the string is safe to set as markup.
 */

import type { ProfileFrameId } from "./frameIds";
import {
  type FrameRoom,
  FRAME_FACTS,
  frameRoomAt,
  pixelSize,
} from "./frameRoom";
import { crystalCave } from "./pixel/crystalCave";

type Drawing = {
  draw: (
    w: number,
    h: number,
    cell: number,
  ) => { svg: string; room: FrameRoom };
  /** the room it uses at a pixel size, without drawing it */
  room: (cell: number) => FrameRoom;
  /** whether something in it moves (stopped under reduced motion) */
  moves?: boolean;
};

export const FRAME_DRAWINGS: Record<ProfileFrameId, Drawing> = {
  crystal: {
    draw: crystalCave,
    room: (cell) => frameRoomAt("crystal", cell),
    moves: FRAME_FACTS.crystal.moves,
  },
};

let instances = 0;

/** Ids inside one drawing, made unique so many frames can share a page */
function scoped(svg: string, prefix: string) {
  return svg
    .replace(/id="([\w-]+)"/g, `id="${prefix}-$1"`)
    .replace(/url\(#([\w-]+)\)/g, `url(#${prefix}-$1)`);
}

/** The SVG of a frame for a card of `w` x `h` css px, and the room it uses */
export function profileFrameSvg(
  id: ProfileFrameId,
  w: number,
  h: number,
  options: { phone?: boolean; prefix?: string; cell?: number } = {},
) {
  const { svg, room } = FRAME_DRAWINGS[id].draw(
    w,
    h,
    options.cell ?? pixelSize(w, options.phone),
  );
  return { svg: scoped(svg, options.prefix ?? `zf${++instances}`), room };
}
