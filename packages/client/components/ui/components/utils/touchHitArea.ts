import { css } from "styled-system/css";

/**
 * Phones and tablets (coarse pointers): the area a finger can hit grows to
 * 44 px tall around a smaller row or button. Nothing moves and nothing looks
 * different; mouse and pen-less desktop sizes are untouched.
 *
 * The growth is an invisible box behind the control's own content (its own
 * stacking context keeps it there), so buttons inside a row still get their
 * taps. It grows along the block axis only: controls side by side in a row
 * (Mute and Deafen, a category's gear and +) never take taps meant for the
 * next one. Rows above and below sit at least 10 px apart where it is used.
 */
export const touchHitArea = css({
  "@media (pointer: coarse)": {
    position: "relative",
    isolation: "isolate",
    "&::after": {
      content: '""',
      position: "absolute",
      zIndex: -1,
      insetInline: 0,
      insetBlock: "min(0px, calc((100% - var(--z-control-xl)) / 2))",
    },
  },
});

/**
 * The same, growing sideways too, for a control with no other control
 * within 4 px beside it (it grows at most 4 px each side, or less when it is
 * wider than 36 px)
 */
export const touchHitAreaSolo = css({
  "@media (pointer: coarse)": {
    position: "relative",
    isolation: "isolate",
    "&::after": {
      content: '""',
      position: "absolute",
      zIndex: -1,
      insetInline:
        "max(-4px, min(0px, calc((100% - var(--z-control-xl)) / 2)))",
      insetBlock: "min(0px, calc((100% - var(--z-control-xl)) / 2))",
    },
  },
});
