/**
 * Phones: pull a message sideways to reply to it.
 *
 * The pull goes away from the menu side (to the left in English, to the
 * right in Arabic): the other direction slides the menu in (SlideDrawer),
 * and that one moves nothing in a conversation, so the two never fight.
 *
 *   start  .......  12 px: the row follows the finger
 *          .......  64 px: armed (the arrow fills, one short buzz)
 *   let go .......  armed: reply; otherwise the row goes back
 *
 * One set of listeners on the list (not one per message): the row is found
 * from the finger.
 */

/** The row starts following the finger */
export const PULL_START = 12;
/** Let go past this and the reply starts */
export const PULL_ARMED = 64;
/** The row never travels further than this */
export const PULL_MAX = 88;
/** More up-or-down movement than this before the pull starts: it is a scroll */
export const SCROLL_SLOP = 10;

export type PullPhase = "idle" | "scroll" | "pull";

/** How far the finger went in the reply direction (px, never negative) */
export function pullDistance(startX: number, x: number, rtl: boolean) {
  return Math.max(0, rtl ? x - startX : startX - x);
}

/** How far the row is drawn for that pull: 1:1, then harder and harder */
export function rowOffset(pull: number) {
  if (pull <= PULL_ARMED) return pull;
  return Math.min(PULL_MAX, PULL_ARMED + (pull - PULL_ARMED) * 0.35);
}

/**
 * What a touch has become, given where it was: a pull only starts while the
 * finger has stayed on its line; once it is a scroll it stays one.
 */
export function nextPhase(
  phase: PullPhase,
  pull: number,
  dy: number,
): PullPhase {
  if (phase !== "idle") return phase;
  if (Math.abs(dy) > SCROLL_SLOP) return "scroll";
  if (pull > PULL_START && pull > Math.abs(dy) * 1.5) return "pull";
  return "idle";
}

const MESSAGE_ID = /^[0-9A-Z]{26}$/;

/** Things with their own sideways movement, or that a pull must not start on */
const OWN_GESTURE =
  "input, textarea, [contenteditable='true'], video, audio, pre, code, [data-no-swipe]";

function sidewaysScroller(from: Element, stop: Element) {
  for (let el: Element | null = from; el && el !== stop; el = el.parentElement)
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflow = getComputedStyle(el).overflowX;
      if (overflow === "auto" || overflow === "scroll") return true;
    }
  return false;
}

export interface SwipeToReply {
  /** Whether a message can be replied to (same rule as the menu's Reply) */
  canReply: (id: string) => boolean;
  onReply: (id: string) => void;
  /** Off while messages are being selected, edited, …  */
  enabled: () => boolean;
  /** The inside of the arrow's <svg> (the app's own reply icon) */
  icon: string;
}

/** Listen on the list of messages; returns the function that stops it */
export function attachSwipeToReply(list: HTMLElement, options: SwipeToReply) {
  let row: HTMLElement | undefined;
  let id = "";
  let startX = 0;
  let startY = 0;
  let phase: PullPhase = "idle";
  let rtl = false;
  let armed = false;
  let mark: HTMLElement | undefined;

  const reduced = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function showMark(target: HTMLElement) {
    const box = target.getBoundingClientRect();
    mark = document.createElement("div");
    mark.setAttribute("data-swipe-reply-mark", "");
    mark.setAttribute("aria-hidden", "true");
    mark.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" width="20" height="20" viewBox="0 0 24 24">${options.icon}</svg>`;
    Object.assign(mark.style, {
      position: "fixed",
      zIndex: "5",
      top: `${Math.max(box.top, 0) + Math.min(box.height, 56) / 2 - 18}px`,
      // the space the row leaves: the end side
      [rtl ? "left" : "right"]: "14px",
      width: "36px",
      height: "36px",
      display: "grid",
      placeItems: "center",
      borderRadius: "50%",
      color: "var(--z-fg-primary)",
      background: "var(--z-bg-raised)",
      opacity: "0",
      pointerEvents: "none",
    } as Partial<CSSStyleDeclaration>);
    document.body.append(mark);
  }

  function settle() {
    const moved = row;
    const shown = mark;
    row = mark = undefined;
    phase = "idle";
    armed = false;
    if (moved) {
      moved.style.transition = reduced() ? "" : "transform 160ms ease-out";
      moved.style.transform = "";
      const clear = () => {
        moved.style.transition = "";
        moved.style.willChange = "";
        moved.removeAttribute("data-swiping");
      };
      if (reduced()) clear();
      else setTimeout(clear, 180);
    }
    shown?.remove();
  }

  function onStart(event: TouchEvent) {
    if (row) settle();
    if (event.touches.length !== 1 || !options.enabled()) return;
    if ((window.visualViewport?.scale ?? 1) > 1.01) return;
    const target = event.target as Element | null;
    const found = target?.closest<HTMLElement>("[id]");
    if (!target || !found || !list.contains(found)) return;
    if (!MESSAGE_ID.test(found.id) || !options.canReply(found.id)) return;
    if (target.closest(OWN_GESTURE) || sidewaysScroller(target, found)) return;

    row = found;
    id = found.id;
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
    phase = "idle";
    armed = false;
    rtl = getComputedStyle(list).direction === "rtl";
  }

  function onMove(event: TouchEvent) {
    if (!row || phase === "scroll") return;
    if (event.touches.length !== 1) return settle();
    const touch = event.touches[0];
    const pull = pullDistance(startX, touch.clientX, rtl);
    const was = phase;
    phase = nextPhase(phase, pull, touch.clientY - startY);
    if (phase === "scroll") {
      row = undefined;
      return;
    }
    if (phase !== "pull") return;

    // ours from here: the list must not scroll and the menu must not slide
    event.preventDefault();
    event.stopPropagation();
    if (was !== "pull") {
      row.style.transition = "";
      row.style.willChange = "transform";
      row.setAttribute("data-swiping", "");
      showMark(row);
    }

    const offset = rowOffset(pull);
    row.style.transform = `translate3d(${rtl ? offset : -offset}px, 0, 0)`;
    const nowArmed = pull >= PULL_ARMED;
    if (mark) {
      const grow = Math.min(1, offset / PULL_ARMED);
      mark.style.opacity = String(grow);
      mark.style.transform = `scale(${0.6 + 0.4 * grow})`;
      mark.style.background = nowArmed
        ? "var(--z-accent-fill, var(--z-accent))"
        : "var(--z-bg-raised)";
      mark.style.color = nowArmed
        ? "var(--z-on-accent, #fff)"
        : "var(--z-fg-primary)";
    }
    if (nowArmed && !armed) navigator.vibrate?.(8);
    armed = nowArmed;
  }

  function onEnd() {
    if (!row) return;
    const reply = phase === "pull" && armed ? id : "";
    settle();
    if (reply) options.onReply(reply);
  }

  list.addEventListener("touchstart", onStart, { passive: true });
  list.addEventListener("touchmove", onMove, { passive: false });
  list.addEventListener("touchend", onEnd);
  list.addEventListener("touchcancel", settle);

  return () => {
    settle();
    list.removeEventListener("touchstart", onStart);
    list.removeEventListener("touchmove", onMove);
    list.removeEventListener("touchend", onEnd);
    list.removeEventListener("touchcancel", settle);
  };
}
