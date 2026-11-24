import { css } from "styled-system/css";

/**
 * Room around a display name inside the boxes that clip it.
 *
 * A name is cut short with an ellipsis, so the boxes around it hide what
 * runs past their edges. A halo, an edge or a lift is drawn around the
 * letters, and slanted fonts (script) reach past their own advance, so a box
 * as tall as the line cut them into a hard-edged grey block (2026-11-24).
 *
 * Put this class on every box that clips a name: it grows the box by the
 * room on each side and pulls it back by as much, so nothing moves and the
 * ellipsis stays where it was. Nested boxes nest exactly: each one is as far
 * out as the room past the one inside it. For a block, a flex item or an
 * inline-block; on an inline box it only moves the sides, which is harmless.
 *
 * `data-name-room` marks the same boxes for tests.
 */
export const nameRoom = css({
  paddingBlock: "8px !important",
  marginBlock: "-8px !important",
  paddingInline: "8px !important",
  marginInline: "-8px !important",
});

/** The room on each side, in pixels (for checks in tests) */
export const NAME_ROOM = 8;
