/**
 * Phones: a bottom sheet closes by a pull of the hand, top to bottom, from
 * anywhere on it (owner, 2026-11-17: no X and no bar on the sheets, "as on an
 * iPhone"). The sheet follows the finger; let go past the threshold, or after
 * a quick flick, and it closes; otherwise it settles back.
 *
 * A pull that starts on content scrolled away from its top scrolls that
 * content and does not move the sheet, so a long sheet closes only from the
 * top of what it shows. A sideways drag (a slider, a row of chips) is left
 * alone. A tap outside the sheet, Escape and Back still close it: a sheet is
 * never closed by the pull alone.
 */

/** how far down (px) the sheet has to be let go to close */
export const CLOSE_DISTANCE = 90;
/** a shorter pull closes too when it was this fast (px per ms) */
export const FLICK_SPEED = 0.6;
const FLICK_DISTANCE = 36;
/** movement (px) before a touch counts as a pull */
const SLOP = 8;
/**
 * ...and on a button or a link: a finger pressing a button slides a little,
 * and a sheet that starts to follow it takes the press away
 */
const SLOP_ON_CONTROL = 24;

/**
 * Is the touched element inside content that is scrolled down?
 * @param target Where the finger landed
 * @param sheet The sheet
 */
export function scrolledAway(target: Element, sheet: Element): boolean {
  for (
    let el: Element | null = target;
    el;
    el = el === sheet ? null : el.parentElement
  ) {
    if (el.scrollTop > 0) return true;
  }
  return false;
}

/**
 * Touch handlers for a sheet that closes by a pull down
 * @param sheet The element that moves
 * @param onClose Close the sheet
 * @param enabled False while the pull must do nothing (wide screens, a
 *   sheet that cannot be dismissed)
 */
export function sheetSwipe(
  sheet: () => HTMLElement | undefined,
  onClose: () => void,
  enabled: () => boolean = () => true,
) {
  let startY: number | undefined;
  let startX = 0;
  let startTime = 0;
  let pulling = false;
  let slop = SLOP;

  const settle = () => {
    const el = sheet();
    if (el) {
      el.style.transition = "transform 0.18s ease-out";
      el.style.transform = "";
    }
    startY = undefined;
    pulling = false;
  };

  return {
    onTouchStart(event: TouchEvent) {
      startY = undefined;
      pulling = false;
      const el = sheet();
      if (!el || !enabled() || event.touches.length !== 1) return;
      const target = event.target as Element;
      if (target.closest("input[type='range'], [data-no-sheet-swipe]")) return;
      if (scrolledAway(target, el)) return;
      startY = event.touches[0].clientY;
      startX = event.touches[0].clientX;
      startTime = event.timeStamp;
      slop = target.closest("button, a, [role='button'], [role='tab']")
        ? SLOP_ON_CONTROL
        : SLOP;
    },
    onTouchMove(event: TouchEvent) {
      const el = sheet();
      if (startY === undefined || !el) return;
      const dy = event.touches[0].clientY - startY;
      const dx = event.touches[0].clientX - startX;
      if (!pulling) {
        // upward, or sideways first: this touch is not a pull
        if (dy < -slop || Math.abs(dx) > Math.max(slop, dy)) {
          startY = undefined;
          return;
        }
        if (dy < slop) return;
        pulling = true;
        el.style.transition = "none";
      }
      el.style.transform = `translateY(${Math.max(0, dy)}px)`;
    },
    onTouchEnd(event: TouchEvent) {
      if (startY === undefined) return;
      // a plain tap: touch nothing. Writing the sheet's style while a finger
      // lifts off a button in it is a change under the finger, and a phone's
      // browser may then not deliver the press (owner, 2026-11-18, iPhone:
      // "Join call" in the room's sheet did nothing)
      if (!pulling) {
        startY = undefined;
        return;
      }
      const dy = event.changedTouches[0].clientY - startY;
      const speed = dy / Math.max(1, event.timeStamp - startTime);
      const close =
        pulling &&
        (dy > CLOSE_DISTANCE || (dy > FLICK_DISTANCE && speed > FLICK_SPEED));
      settle();
      if (close) onClose();
    },
    onTouchCancel() {
      if (startY !== undefined && pulling) settle();
      startY = undefined;
    },
  };
}
