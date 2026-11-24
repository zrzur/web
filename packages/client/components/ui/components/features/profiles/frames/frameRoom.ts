/**
 * What is known about each built-in frame without its drawing: the room it
 * takes round the card and whether it moves.
 */
import { type ProfileFrameId, isProfileFrameId } from "./frameIds";

/** Room round the card a drawing uses, in css px */
export type FrameRoom = { x: number; top: number; bottom: number };

/** What each frame's drawing needs round the card, in cells, and its motion */
export const FRAME_FACTS: Record<
  ProfileFrameId,
  { room: FrameRoom; moves: boolean }
> = {
  // pixel/crystalCave.ts CRYSTAL_ROOM (a test keeps them equal)
  crystal: { room: { x: 14, top: 24, bottom: 18 }, moves: true },
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

/** The room a built-in frame uses at a pixel size, without drawing it */
export function frameRoomAt(id: ProfileFrameId, cell: number): FrameRoom {
  const room = FRAME_FACTS[id].room;
  return { x: room.x * cell, top: room.top * cell, bottom: room.bottom * cell };
}

/** Least room left between a framed profile and the window's edges, css px */
export const FRAME_EDGE = 12;

/**
 * The pixel size of a frame round a profile shown in the window (the card
 * beside a name, the full profile), so the profile and its whole frame fit:
 * 4 px on a tall window, 3 px below 1080 px, 2 px below 640 px and on a
 * phone, where the profile takes the screen's width. Whole pixels only, so
 * the pixel art stays crisp.
 */
export function fitCell(
  width: number,
  options: { phone?: boolean; windowHeight?: number } = {},
) {
  const cell = pixelSize(width, options.phone);
  if (options.phone) return Math.min(cell, 2);
  const tall = options.windowHeight ?? Infinity;
  if (tall < 640) return Math.min(cell, 2);
  if (tall < 1080) return Math.min(cell, 3);
  return cell;
}

/**
 * The room any frame takes round a box `width` px wide: a built-in one at
 * pixel size `cell`, a community one by its template (30 px at the sides,
 * 70 above, 40 below a 340 px card, `communityFrame.ts`), none without one.
 */
export function frameRoomOf(
  frame: string | undefined,
  width: number,
  cell: number,
): FrameRoom {
  if (isProfileFrameId(frame)) return frameRoomAt(frame, cell);
  if (frame?.startsWith("c:")) {
    const s = width / 340;
    return { x: 30 * s, top: 70 * s, bottom: 40 * s };
  }
  return { x: 0, top: 0, bottom: 0 };
}

/**
 * The room a framed profile box says its frame takes (`FramedCard` writes it
 * on the box as `data-frame-room="x top bottom"`), or none.
 */
export function readFrameRoom(box: Element | null | undefined): FrameRoom {
  const host = box?.matches?.("[data-frame-room]")
    ? box
    : box?.querySelector?.("[data-frame-room]");
  const [x, top, bottom] = (host?.getAttribute("data-frame-room") ?? "")
    .split(" ")
    .map(Number);
  if (![x, top, bottom].every((n) => Number.isFinite(n) && n >= 0))
    return { x: 0, top: 0, bottom: 0 };
  return { x, top, bottom };
}

/**
 * How far from the window's edges a popup must stay so its frame shows whole
 * with `FRAME_EDGE` to spare (`padding` of floating-ui's `flip` and `shift`);
 * `edge` when it has no frame.
 */
export function framePadding(room: FrameRoom, edge = 8) {
  if (!room.x && !room.top && !room.bottom)
    return { top: edge, bottom: edge, left: edge, right: edge };
  return {
    top: room.top + FRAME_EDGE,
    bottom: room.bottom + FRAME_EDGE,
    left: room.x + FRAME_EDGE,
    right: room.x + FRAME_EDGE,
  };
}
