/**
 * Zrzur's own profile frames. Each is drawn for the card's real size and
 * says how much room round the card it uses; the frame layer is placed by
 * that room. Drawings are hand-composed pixel art (frames/pixel/), added one
 * at a time after the owner has seen each on a real card.
 *
 * Every value put into the markup is a number or a colour from our own
 * palettes, never text from a user, so the string is safe to set as markup.
 */

import { crystalCave } from "./pixel/crystalCave";

export const PROFILE_FRAME_IDS = ["crystal"] as const;

export type ProfileFrameId = (typeof PROFILE_FRAME_IDS)[number];

export const isProfileFrameId = (
  id: string | undefined,
): id is ProfileFrameId =>
  !!id && (PROFILE_FRAME_IDS as readonly string[]).includes(id);

/** Room round the card a drawing uses, in css px */
export type FrameRoom = { x: number; top: number; bottom: number };

type Drawing = {
  draw: (
    w: number,
    h: number,
    cell: number,
  ) => { svg: string; room: FrameRoom };
  /** whether something in it moves (stopped under reduced motion) */
  moves?: boolean;
};

export const FRAME_DRAWINGS: Record<ProfileFrameId, Drawing> = {
  crystal: { draw: crystalCave, moves: true },
};

/**
 * The pixel size for a box this wide: 4 px on a card or a full profile,
 * 3 px on a phone, smaller on the little preview cards, so the drawing keeps
 * its proportions everywhere.
 */
export function pixelSize(width: number, phone = false) {
  const cell = Math.min(4, Math.max(2, Math.round(width / 90)));
  return phone ? Math.min(cell, 3) : cell;
}

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
  options: { phone?: boolean; prefix?: string } = {},
) {
  const { svg, room } = FRAME_DRAWINGS[id].draw(
    w,
    h,
    pixelSize(w, options.phone),
  );
  return { svg: scoped(svg, options.prefix ?? `zf${++instances}`), room };
}
