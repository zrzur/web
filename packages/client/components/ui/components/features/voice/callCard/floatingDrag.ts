/**
 * The small floating call card (shown while you are in a call and look at
 * another page) can be moved by dragging it, and a tap on it opens the call.
 *
 * Bug #9 (2026-11-22): every press started a move at once, and the press that
 * ended a move was also a click on the card, so dragging it opened the call.
 * A press is now a tap until the pointer travels past a small threshold; once
 * it is a drag, the click it ends with is swallowed. Positions are worked out
 * from the visible viewport in pixels (not 100vh, which on a phone browser is
 * taller than the visible page and put the lower corners under its bar), and
 * are kept inside it.
 */

/** A corner of the screen; physical, cut-outs do not mirror in Arabic */
export type Corner = "tl" | "tr" | "bl" | "br";

/** How far (px) a press may travel and still be a tap */
export const DRAG_THRESHOLD = 5;

/** Room kept between the card and the screen edges (px) */
export const EDGE_GAP = 16;

/** Room kept above the card at the top: the channel header (px) */
export const TOP_GAP = 16 + 56;

/** Room kept below the card at the bottom: the message composer (px) */
export const BOTTOM_GAP = 16 + 56;

export type Size = { width: number; height: number };
export type Insets = { top: number; right: number; bottom: number; left: number };
export type Point = { x: number; y: number };

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

export function isCorner(value: unknown): value is Corner {
  return value === "tl" || value === "tr" || value === "bl" || value === "br";
}

/** Whether a press has moved far enough to be a drag, not a tap */
export function movedPastThreshold(
  start: Point,
  now: Point,
  threshold = DRAG_THRESHOLD,
) {
  return Math.hypot(now.x - start.x, now.y - start.y) > threshold;
}

/** The corner nearest to where the card's middle was dropped */
export function nearestCorner(topLeft: Point, card: Size, viewport: Size) {
  const left = topLeft.x + card.width / 2 < viewport.width / 2;
  const top = topLeft.y + card.height / 2 < viewport.height / 2;
  return (left ? (top ? "tl" : "bl") : top ? "tr" : "br") as Corner;
}

/** Keep a card's top-left point so the whole card stays on screen */
export function clampToViewport(
  point: Point,
  card: Size,
  viewport: Size,
  insets: Insets = NO_INSETS,
): Point {
  const minX = insets.left,
    minY = insets.top,
    maxX = Math.max(minX, viewport.width - insets.right - card.width),
    maxY = Math.max(minY, viewport.height - insets.bottom - card.height);
  return {
    x: Math.min(Math.max(point.x, minX), maxX),
    y: Math.min(Math.max(point.y, minY), maxY),
  };
}

/**
 * The part of the page the person really sees, from the top of the layout
 * viewport: smaller than it while a phone's on-screen keyboard is open
 * (`visualViewport.offsetTop` and `.height`)
 */
export type Visible = { top: number; height: number };

/**
 * Top-left point of the card in a corner, clear of the header, the composer
 * and the safe area, and never off the visible screen. The bottom corners
 * sit above the bottom of what is really visible, and the top ones below
 * its top, so an on-screen keyboard (iOS keeps the layout viewport and only
 * shrinks and moves the visual one) never covers or hides the card.
 */
export function cornerPosition(
  corner: Corner,
  card: Size,
  viewport: Size,
  insets: Insets = NO_INSETS,
  visible?: Visible,
): Point {
  const x =
    corner[1] === "l"
      ? insets.left + EDGE_GAP
      : viewport.width - insets.right - EDGE_GAP - card.width;
  const bottom = visible
    ? Math.min(viewport.height, visible.top + visible.height)
    : viewport.height;
  // what is visible may start lower than the layout viewport (a page
  // scrolled under the on-screen keyboard): the top corners follow it
  const top = visible ? Math.max(0, visible.top) : 0;
  const y =
    corner[0] === "t"
      ? top + insets.top + TOP_GAP
      : bottom - insets.bottom - BOTTOM_GAP - card.height;
  return clampToViewport({ x, y }, card, viewport, insets);
}

/**
 * The corner an arrow key moves the card to (physical directions, as the
 * corners are), or nothing when the key is not an arrow or the card is
 * already on that side
 */
export function cornerAfterKey(corner: Corner, key: string): Corner | undefined {
  const [row, side] = [corner[0], corner[1]];
  const next =
    key === "ArrowUp"
      ? `t${side}`
      : key === "ArrowDown"
        ? `b${side}`
        : key === "ArrowLeft"
          ? `${row}l`
          : key === "ArrowRight"
            ? `${row}r`
            : undefined;
  return next && next !== corner && isCorner(next) ? next : undefined;
}

/** Controls a press may not start a drag from: their own press is theirs */
const CONTROLS = "button, a, input, select, textarea, [role=button], [role=slider]";

/**
 * Whether a press on this element may move the card: anywhere on it but its
 * buttons (microphone, hang up); the big "back to the call" area may.
 */
export function isDragHandle(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (!target.closest("[data-voice-pip]")) return false;
  const control = target.closest(CONTROLS);
  return !control || control.hasAttribute("data-pip-back");
}

/** How long the click that ends a drag is waited for (ms) */
const CLICK_WINDOW = 400;

type GestureOptions = {
  /** the element that moves (its box gives the grab offset) */
  element: () => HTMLElement | undefined;
  /** whether a press on this target may start a drag */
  canStart?: (target: EventTarget | null) => boolean;
  /** the press became a drag */
  onStart: () => void;
  /** the card's top-left point under the pointer */
  onMove: (topLeft: Point) => void;
  /** the drag ended (released or cancelled) at this top-left point */
  onDrop: (topLeft: Point) => void;
};

/**
 * Tells a tap from a drag on the floating card. Mouse, touch and pen
 * (pointer events); one pointer at a time. A tap is left alone, so its click
 * opens the call as before; a drag swallows the click it ends with.
 */
export function createDragGesture(options: GestureOptions) {
  const canStart = options.canStart ?? isDragHandle;
  let listening: AbortController | undefined,
    id = 0,
    start: Point = { x: 0, y: 0 },
    offset: Point = { x: 0, y: 0 },
    last: Point = { x: 0, y: 0 },
    dragging = false,
    unswallow: ReturnType<typeof setTimeout> | undefined;

  const topLeft = (e: PointerEvent): Point => ({
    x: e.clientX - offset.x,
    y: e.clientY - offset.y,
  });

  function stop() {
    listening?.abort();
    listening = undefined;
    dragging = false;
  }

  function swallowNextClick() {
    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      clear();
    };
    const clear = () => {
      clearTimeout(unswallow);
      window.removeEventListener("click", swallow, true);
    };
    clear();
    window.addEventListener("click", swallow, true);
    unswallow = setTimeout(clear, CLICK_WINDOW);
  }

  function move(e: PointerEvent) {
    if (e.pointerId !== id) return;
    if (!dragging) {
      if (!movedPastThreshold(start, { x: e.clientX, y: e.clientY })) return;
      dragging = true;
      options.onStart();
    }
    e.preventDefault();
    last = topLeft(e);
    options.onMove(last);
  }

  function end(e: PointerEvent) {
    if (e.pointerId !== id) return;
    const wasDragging = dragging;
    if (wasDragging && e.type === "pointerup") last = topLeft(e);
    stop();
    if (!wasDragging) return;
    if (e.type === "pointerup") swallowNextClick();
    options.onDrop(last);
  }

  return {
    pointerDown(e: PointerEvent) {
      if (!e.isPrimary || e.button !== 0 || !canStart(e.target)) return;
      const element = options.element();
      if (!element) return;
      stop();
      id = e.pointerId;
      start = { x: e.clientX, y: e.clientY };
      const box = element.getBoundingClientRect();
      offset = { x: e.clientX - box.x, y: e.clientY - box.y };
      last = { x: box.x, y: box.y };
      // keep getting this pointer when it leaves the card or the window
      try {
        (e.target as Element).setPointerCapture?.(e.pointerId);
      } catch {
        /* not capturable (a pointer that is already gone): document still hears it */
      }
      listening = new AbortController();
      const opt = { passive: false, signal: listening.signal };
      document.addEventListener("pointermove", move, opt);
      document.addEventListener("pointerup", end, opt);
      document.addEventListener("pointercancel", end, opt);
    },
    /** whether a drag is going on now */
    get dragging() {
      return dragging;
    },
    /** drop a press without moving anything (the card left floating mode) */
    cancel: stop,
  };
}
