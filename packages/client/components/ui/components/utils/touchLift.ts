import { css } from "styled-system/css";

/**
 * Put on a list (the server rail, a channel list): the element in it marked
 * data-lifted, which a finger (or a pen on a touch screen) has rested on
 * long enough to move, rises a little. One look for every list. The shadow
 * (--z-elev-raised) stays within 8 px, inside the 12 px the rail's rows may
 * paint beyond their box, and it takes the lifted element's own corners.
 */
export const liftScope = css({
  "& [data-lifted]": {
    transform: "scale(1.04)",
    boxShadow: "var(--z-elev-raised)",
    transition:
      "transform var(--z-motion-fast) var(--z-ease-standard), box-shadow var(--z-motion-fast) var(--z-ease-standard)",
    _motionReduce: { transition: "none" },
  },
});

/**
 * Lift or settle an element
 * @param el Row
 * @param on Lifted
 */
export function setLifted(el: Element | undefined, on: boolean) {
  if (on) el?.setAttribute("data-lifted", "");
  else el?.removeAttribute("data-lifted");
}
