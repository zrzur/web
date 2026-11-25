/**
 * Zrzur's own profile frames: the drawings (ids and sizes are in
 * `frameIds.ts`, which loads no art). Each is drawn for the card's real size and
 * says how much room round the card it uses; the frame layer is placed by
 * that room. Drawings are hand-composed pixel art (frames/pixel/), added
 * after the owner has seen each on a real card.
 *
 * Crystal cave is drawn here, at any size. The set of 2026-11-25 is drawn
 * ahead of time (pixel/set/, two corners each): every one is its own file,
 * loaded the first time it is shown (`loadFrameArt`), so a frame nobody wears
 * here is never downloaded.
 *
 * Every value put into the markup is a number, a colour from our own
 * palettes or our own pre-generated art, never text from a user, so the
 * string is safe to set as markup.
 */

import type { ProfileFrameId } from "./frameIds";
import {
  type FrameRoom,
  FRAME_FACTS,
  frameRoomAt,
  pixelSize,
} from "./frameRoom";
import { crystalCave } from "./pixel/crystalCave";
import { type FramePieces, drawPieces } from "./pixel/pieces";

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

type SetId = Exclude<ProfileFrameId, "crystal">;

/** the pre-drawn frames, one file each */
const SET: Record<SetId, () => Promise<{ default: FramePieces }>> = {
  "desert-lanterns": () => import("./pixel/set/desertLanterns"),
  "damascus-jasmine": () => import("./pixel/set/damascusJasmine"),
  "autumn-maple": () => import("./pixel/set/autumnMaple"),
  "coral-reef": () => import("./pixel/set/coralReef"),
  "mushroom-forest": () => import("./pixel/set/mushroomForest"),
  "zrzur-neon": () => import("./pixel/set/zrzurNeon"),
  "zrzur-arcade": () => import("./pixel/set/zrzurArcade"),
  "zrzur-flock": () => import("./pixel/set/zrzurFlock"),
};

const loaded = new Map<ProfileFrameId, FramePieces>();

/** Fetch a frame's art if it is drawn ahead of time; at once for the others */
export async function loadFrameArt(id: ProfileFrameId) {
  if (id === "crystal" || loaded.has(id)) return;
  loaded.set(id, (await SET[id]()).default);
}

/** whether `profileFrameSvg` can draw this frame now */
export const frameArtReady = (id: ProfileFrameId) =>
  id === "crystal" || loaded.has(id);

const preDrawn = (id: SetId): Drawing => ({
  draw: (w, h, cell) => {
    const art = loaded.get(id);
    if (!art) throw new Error(`frame ${id}: call loadFrameArt first`);
    const room = frameRoomAt(id, cell);
    return { svg: drawPieces(art, w, h, cell, room), room };
  },
  room: (cell) => frameRoomAt(id, cell),
  moves: FRAME_FACTS[id].moves,
});

export const FRAME_DRAWINGS: Record<ProfileFrameId, Drawing> = {
  crystal: {
    draw: crystalCave,
    room: (cell) => frameRoomAt("crystal", cell),
    moves: FRAME_FACTS.crystal.moves,
  },
  ...(Object.fromEntries(
    (Object.keys(SET) as SetId[]).map((id) => [id, preDrawn(id)]),
  ) as Record<SetId, Drawing>),
};

let instances = 0;

/** Ids inside one drawing, made unique so many frames can share a page */
function scoped(svg: string, prefix: string) {
  return svg
    .replace(/id="([\w-]+)"/g, `id="${prefix}-$1"`)
    .replace(/url\(#([\w-]+)\)/g, `url(#${prefix}-$1)`);
}

/**
 * The SVG of a frame for a card of `w` x `h` css px, and the room it uses.
 * A frame drawn ahead of time is loaded first with `loadFrameArt`.
 */
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
