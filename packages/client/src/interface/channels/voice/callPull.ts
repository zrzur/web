/**
 * Phones, in a voice channel's call: drag the call down to put it aside.
 * The rule of the gesture (nextCallPull) is separate from the listeners, so
 * it can be tested without a page.
 */

/** Drag the call down this far (px) and it is put aside */
export const CALL_PULL_DOWN = 90;
/** The drag starts after this much downward movement (px) */
export const CALL_PULL_START = 14;

/** What a touch on the call screen has become */
export type CallPull = "idle" | "pull" | "other";

/**
 * A finger going down, more down than sideways, starts the pull; sideways
 * first belongs to the menu's slide, and it stays so for that touch.
 */
export function nextCallPull(
  phase: CallPull,
  dx: number,
  dy: number,
): CallPull {
  if (phase !== "idle") return phase;
  if (Math.abs(dx) > 12 && Math.abs(dx) > dy) return "other";
  if (dy < -CALL_PULL_START) return "other";
  if (dy > CALL_PULL_START && dy > Math.abs(dx) * 1.5) return "pull";
  return "idle";
}

/**
 * Phones, in the call: a drag down anywhere on the call (its top row, a
 * person's tile, the space around them) puts the call aside. Not on a
 * button, and not while the list of people is scrolled down: there the
 * same drag scrolls the list back up first.
 * @returns the function that stops listening
 */
export function pullCallDown(putAside: () => void) {
  let startX = 0;
  let startY = 0;
  let phase: CallPull = "other";
  let top: HTMLElement | null = null;

  const settle = () => {
    phase = "other";
    if (!top) return;
    top.style.transition = "transform 160ms ease-out";
    top.style.transform = "";
    top = null;
  };

  const onStart = (event: TouchEvent) => {
    phase = "other";
    if (event.touches.length !== 1) return;
    const target = event.target as Element | null;
    if (!target?.closest("[data-call-top], [data-voice-stage], .vc_tile"))
      return;
    if (target.closest("button, a, input, [data-voice-controls]")) return;
    for (let el: Element | null = target; el; el = el.parentElement) {
      const overflow = getComputedStyle(el).overflowY;
      if (
        (overflow === "auto" || overflow === "scroll") &&
        el.scrollHeight > el.clientHeight + 1 &&
        el.scrollTop > 0
      )
        return;
    }
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
    phase = "idle";
    top = document.querySelector<HTMLElement>("[data-call-top]");
    if (top) top.style.transition = "";
  };

  const onMove = (event: TouchEvent) => {
    if (phase === "other") return;
    const touch = event.touches[0];
    const dy = touch.clientY - startY;
    phase = nextCallPull(phase, touch.clientX - startX, dy);
    if (phase !== "pull") return;
    // ours: the list of people must not rubber-band under the finger
    if (event.cancelable) event.preventDefault();
    if (top)
      top.style.transform = `translate3d(0, ${Math.min(36, dy * 0.3)}px, 0)`;
  };

  const onEnd = (event: TouchEvent) => {
    const far =
      phase === "pull" &&
      event.changedTouches[0].clientY - startY >= CALL_PULL_DOWN;
    settle();
    if (far) putAside();
  };

  document.addEventListener("touchstart", onStart, { passive: true });
  document.addEventListener("touchmove", onMove, { passive: false });
  document.addEventListener("touchend", onEnd);
  document.addEventListener("touchcancel", settle);
  return () => {
    settle();
    document.removeEventListener("touchstart", onStart);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onEnd);
    document.removeEventListener("touchcancel", settle);
  };
}
