import { css } from "styled-system/css";

/**
 * A row or server a finger (or pen) has rested on long enough to move: it
 * rises a little. One look for the server rail and the channel list.
 */
export const touchLift = css({
  transform: "scale(1.04)",
  boxShadow: "var(--z-shadow-md)",
  borderRadius: "var(--z-radius-md)",
  transition:
    "transform var(--z-motion-fast) var(--z-ease-standard), box-shadow var(--z-motion-fast) var(--z-ease-standard)",
  _motionReduce: { transition: "none" },
});

/**
 * Lift or settle an element (the class holds several atomic classes)
 * @param el Row
 * @param on Lifted
 */
export function setTouchLift(el: Element | undefined, on: boolean) {
  for (const name of touchLift.split(" ")) el?.classList.toggle(name, on);
}
