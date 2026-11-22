import { css } from "styled-system/css";

/**
 * Phones and tablets (coarse pointers): the area a finger can hit grows to
 * 44 px around a smaller row or button. Nothing moves and nothing looks
 * different; mouse and pen sizes are untouched.
 *
 * The growth is an invisible box behind the control's own content (its own
 * stacking context keeps it there), so buttons inside a row still get their
 * taps; neighbours that sit closer than 44 px share the space between them.
 */
export const touchHitArea = css({
  "@media (pointer: coarse)": {
    position: "relative",
    isolation: "isolate",
    "&::after": {
      content: '""',
      position: "absolute",
      zIndex: -1,
      insetBlock: "min(0px, calc((100% - var(--z-control-xl)) / 2))",
      insetInline: "min(0px, calc((100% - var(--z-control-xl)) / 2))",
    },
  },
});
