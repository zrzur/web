/**
 * What is known about each built-in frame without its drawing: the room it
 * takes round the card and whether it moves.
 */
import type { ProfileFrameId } from "./frameIds";

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
