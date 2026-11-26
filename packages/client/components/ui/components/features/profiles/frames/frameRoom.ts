/**
 * The room a profile frame takes round the card. Every frame is a creator's
 * picture on the community template (`communityFrame.ts`): 30 px at the
 * sides, 70 above and 40 below a 340 px card, scaled with the card's width.
 */
import { FRAME_TEMPLATE } from "./communityFrame";

/** Room round the card a frame uses, in css px */
export type FrameRoom = { x: number; top: number; bottom: number };

const CARD_WIDTH = FRAME_TEMPLATE.card.right - FRAME_TEMPLATE.card.left;

/** Least room left between a framed profile and the window's edges, css px */
export const FRAME_EDGE = 12;

/**
 * The room a frame takes round a box `width` px wide: a community one
 * (`c:<id>`) by its template, none without one. A value that is not a
 * community frame (a built-in id Zrzur no longer ships) takes none.
 */
export function frameRoomOf(
  frame: string | undefined,
  width: number,
): FrameRoom {
  if (!frame?.startsWith("c:")) return { x: 0, top: 0, bottom: 0 };
  const s = width / CARD_WIDTH;
  return {
    x: FRAME_TEMPLATE.card.left * s,
    top: FRAME_TEMPLATE.card.top * s,
    bottom: (FRAME_TEMPLATE.height - FRAME_TEMPLATE.card.bottom) * s,
  };
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
