import { createSignal, onCleanup } from "solid-js";

import { useLingui } from "@lingui/solid/macro";

import { claimLongPress } from "@revolt/ui/directives/longPress";

/**
 * How far the pointer must travel before a press turns into a drag, so that
 * clicking a server still navigates to it
 */
const DRAG_THRESHOLD_PX = 5;

/**
 * A finger has to rest this long on an entry before it lifts and can be
 * dragged; moving earlier is a scroll of the rail
 */
export const TOUCH_HOLD_MS = 350;

/**
 * A finger that keeps resting this long, still without moving, opens the
 * entry's menu, as a long press does everywhere else in the app
 */
export const TOUCH_MENU_MS = 500;

/**
 * How far a finger may wander while it rests before the press counts as a
 * scroll
 */
const TOUCH_SLOP_PX = 8;

/**
 * Band at the top and bottom of the rail where a drag scrolls it
 */
const EDGE_SCROLL_PX = 48;

/**
 * Fastest edge scroll, in pixels per frame
 */
const EDGE_SCROLL_MAX = 14;

/**
 * How many pixels to scroll the rail by in one frame while dragging
 * @param y Pointer position
 * @param top Top of the scrolling area
 * @param bottom Bottom of the scrolling area
 * @returns Negative to scroll up, positive to scroll down, zero to stay
 */
export function edgeScrollStep(y: number, top: number, bottom: number) {
  const band = Math.min(EDGE_SCROLL_PX, (bottom - top) / 4);
  if (band <= 0) return 0;

  if (y < top + band) {
    return -Math.ceil(EDGE_SCROLL_MAX * Math.min(1, (top + band - y) / band));
  }

  if (y > bottom - band) {
    return Math.ceil(
      EDGE_SCROLL_MAX * Math.min(1, (y - (bottom - band)) / band),
    );
  }

  return 0;
}

/**
 * Portion of an entry, measured from its middle, which folds rather than
 * reorders when you drop on it
 */
const FOLD_BAND = 0.5;

export type RailEntry = {
  id: string;

  /**
   * Folders can be reordered but not folded into one another
   */
  kind: "server" | "folder";

  /**
   * Folder this entry sits inside, when it is a member of an expanded one
   */
  parent?: string;
};

/**
 * How far to the side of the rail the pointer has to go before a drop is
 * treated as "somewhere else" and abandoned
 */
const CANCEL_MARGIN_PX = 80;

export type RailIntent =
  | { type: "fold"; target: string }
  | {
      type: "move";

      /**
       * Entry the dragged one would land in front of, or the end of the list
       */
      before: string | undefined;

      /**
       * Folder it would land inside, if any
       */
      parent: string | undefined;
    };

/**
 * Drag handling for the server rail
 *
 * The rail deliberately does not rearrange itself while you drag: entries stay
 * where they are and an indicator shows where the drop will land. That is what
 * makes dropping *onto* an entry possible at all, since an entry which steps
 * out of the way as you approach can never be a target.
 */
export function createRailDrag(options: {
  entries: () => RailEntry[];
  container: () => HTMLElement | undefined;
  disabled?: () => boolean;
  /**
   * Name to read out when announcing what is being moved
   */
  label?: (id: string) => string | undefined;
  onFold: (target: string, incoming: string) => void;
  onMove: (
    moved: string,
    before: string | undefined,
    parent: string | undefined,
  ) => void;
}) {
  const { t } = useLingui();

  const elements = new Map<string, HTMLElement>();

  const [dragging, setDragging] = createSignal<string>();
  const [carrying, setCarrying] = createSignal<string>();
  const [status, setStatus] = createSignal("");
  const [intent, setIntent] = createSignal<RailIntent>();
  const [pointer, setPointer] = createSignal<{ x: number; y: number }>();

  const [lifted, setLifted] = createSignal<string>();

  let armed:
    | {
        id: string;
        x: number;
        y: number;
        pointerId: number;
        touch: boolean;
        /** the entry's menu was opened by this press */
        menu: boolean;
      }
    | undefined;

  /**
   * Node the finger landed on. Touch events keep going to it even when it
   * is redrawn and leaves the page (then they no longer reach the entry), so
   * it gets its own listener for as long as the press lasts
   */
  let pressTarget: EventTarget | undefined;

  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let menuTimer: ReturnType<typeof setTimeout> | undefined;

  /** our own menu event is on its way, let it through */
  let openingMenu = false;

  function clearTimers() {
    clearTimeout(holdTimer);
    clearTimeout(menuTimer);
    holdTimer = menuTimer = undefined;
  }

  /**
   * Open (or, once open, close) an entry's menu through the same event a
   * right-click sends, so the entry's own menu shows as it does today
   */
  function toggleMenu(id: string) {
    const el = elements.get(id);
    if (!el) return;

    openingMenu = true;
    try {
      el.dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
      );
    } finally {
      openingMenu = false;
    }
  }

  /**
   * The finger has rested long enough: lift the entry so it can be dragged
   */
  function lift() {
    holdTimer = undefined;
    if (!armed || dragging()) return;

    setLifted(armed.id);
    try {
      navigator.vibrate?.(10);
    } catch {
      // not allowed or not there: the lift itself is the feedback
    }

    menuTimer = setTimeout(() => {
      menuTimer = undefined;
      if (!armed || dragging()) return;
      armed.menu = true;
      toggleMenu(armed.id);
    }, TOUCH_MENU_MS - TOUCH_HOLD_MS);
  }

  let scroller: HTMLElement | undefined;
  let scrollFrame: number | undefined;

  /**
   * Nearest scrolling box around the rail
   */
  function findScroller() {
    let el = options.container()?.parentElement ?? undefined;
    while (el) {
      const { overflowY } = getComputedStyle(el);
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight
      )
        return el;
      el = el.parentElement ?? undefined;
    }
  }

  /**
   * Scroll the rail while a dragged entry is held near its top or bottom
   */
  function edgeScroll() {
    scrollFrame = undefined;
    const pos = pointer();
    if (!dragging() || !pos) return;

    scroller ??= findScroller();
    if (!scroller) return;

    const { top, bottom } = scroller.getBoundingClientRect();
    const step = edgeScrollStep(pos.y, top, bottom);
    if (!step) return;

    const before = scroller.scrollTop;
    scroller.scrollTop += step;
    if (scroller.scrollTop !== before) {
      scrollFrame = requestAnimationFrame(edgeScroll);
    }
  }

  function startEdgeScroll() {
    if (
      scrollFrame === undefined &&
      typeof requestAnimationFrame === "function"
    )
      scrollFrame = requestAnimationFrame(edgeScroll);
  }

  /**
   * Work out what dropping at the given position would do
   *
   * Boxes are measured fresh each time so that scrolling the rail mid-drag
   * doesn't leave us aiming at where things used to be.
   * @param y Pointer position
   * @param held Entry being dragged
   */
  function intentAt(
    x: number,
    y: number,
    held: string,
  ): RailIntent | undefined {
    const rail = options.container()?.getBoundingClientRect();
    if (
      rail &&
      (x < rail.left - CANCEL_MARGIN_PX || x > rail.right + CANCEL_MARGIN_PX)
    ) {
      return undefined;
    }

    const source = options.entries().find((entry) => entry.id === held);

    const boxes = options
      .entries()
      .map((entry) => ({ entry, el: elements.get(entry.id) }))
      .filter((row): row is { entry: RailEntry; el: HTMLElement } => !!row.el)
      .map((row) => ({ ...row, rect: row.el.getBoundingClientRect() }));

    if (!boxes.length)
      return { type: "move", before: undefined, parent: undefined };

    // a folder can be moved around the list but never into anything
    const canFold = source?.kind === "server";
    const canNest = source?.kind === "server";

    /**
     * Work out what landing in front of the given position means
     * @param index Position within the visible list
     */
    const insertAt = (index: number): RailIntent => {
      let neighbour = boxes[index];

      // a folder dropped among another folder's servers belongs after them
      while (neighbour && !canNest && neighbour.entry.parent) {
        neighbour = boxes[boxes.indexOf(neighbour) + 1];
      }

      return {
        type: "move",
        before: neighbour?.entry.id,
        parent: neighbour?.entry.parent,
      };
    };

    for (const [index, { entry, rect }] of boxes.entries()) {
      if (y < rect.top || y > rect.bottom) continue;

      const offset = (y - rect.top) / rect.height;

      // the middle of an entry folds, the edges insert either side of it;
      // servers already inside a folder are only ever reordered
      if (
        entry.id !== held &&
        canFold &&
        !entry.parent &&
        Math.abs(offset - 0.5) < FOLD_BAND / 2
      ) {
        return { type: "fold", target: entry.id };
      }

      return insertAt(offset >= 0.5 ? index + 1 : index);
    }

    // above the first entry, or below the last
    return y < boxes[0].rect.top
      ? insertAt(0)
      : { type: "move", before: undefined, parent: undefined };
  }

  function drop() {
    const held = dragging();
    const landed = intent();

    reset();

    if (!held || !landed) return;

    if (landed.type === "fold") {
      if (landed.target !== held) options.onFold(landed.target, held);
      return;
    }

    const source = options.entries().find((entry) => entry.id === held);

    if (
      landed.parent === source?.parent &&
      (landed.before === held || sitsBefore(held, landed.before))
    ) {
      return;
    }

    options.onMove(held, landed.before, landed.parent);
  }

  function sitsBefore(id: string, before: string | undefined) {
    const entries = options.entries();
    const at = entries.findIndex((entry) => entry.id === id);
    if (at === -1) return false;

    let next = at + 1;
    while (next < entries.length && entries[next].parent === id) {
      next++;
    }

    return before === undefined
      ? next === entries.length
      : entries[next]?.id === before;
  }

  function siblings(parent: string | undefined) {
    return options.entries().filter((entry) => entry.parent === parent);
  }

  function announce(message: string) {
    setStatus(message);
  }

  function name(id: string) {
    return options.label?.(id) ?? t`Server`;
  }

  function refocus(id: string) {
    requestAnimationFrame(() => {
      const el = elements.get(id);
      const focusable = el?.querySelector<HTMLElement>("a, button") ?? el;
      focusable?.focus();
    });
  }

  function shift(id: string, direction: -1 | 1) {
    const parent = options.entries().find((entry) => entry.id === id)?.parent;
    const list = siblings(parent);
    const at = list.findIndex((entry) => entry.id === id);

    const to = at + direction;
    if (at === -1 || to < 0 || to >= list.length) {
      announce(
        direction < 0
          ? t`${name(id)} is already at the top`
          : t`${name(id)} is already at the bottom`,
      );
      return;
    }

    const before = direction < 0 ? list[to].id : list[to + 1]?.id;

    options.onMove(id, before, parent);
    announce(t`${name(id)} moved to position ${to + 1} of ${list.length}`);
    refocus(id);
  }

  function reset() {
    clearTimers();
    pressTarget?.removeEventListener("touchmove", onTouchMove as EventListener);
    pressTarget = undefined;
    if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
    scrollFrame = undefined;
    scroller = undefined;
    armed = undefined;
    setLifted(undefined);
    setDragging(undefined);
    setIntent(undefined);
    setPointer(undefined);
  }

  function onPointerMove(e: PointerEvent) {
    if (armed && e.pointerId !== armed.pointerId) return;

    if (armed && !dragging()) {
      const moved = Math.hypot(e.clientX - armed.x, e.clientY - armed.y);

      if (armed.touch && !lifted()) {
        // still resting: a finger that moves now is scrolling the rail
        if (moved >= TOUCH_SLOP_PX) reset();
        return;
      }

      if (moved < DRAG_THRESHOLD_PX) return;

      clearTimers();
      // the menu opened while the finger rested: the drag takes over
      if (armed.menu) {
        armed.menu = false;
        toggleMenu(armed.id);
      }

      setDragging(armed.id);
    }

    const held = dragging();
    if (!held) return;

    e.preventDefault();
    setPointer({ x: e.clientX, y: e.clientY });
    setIntent(intentAt(e.clientX, e.clientY, held));
    startEdgeScroll();
  }

  /**
   * Keep the click that follows a press from opening the link
   * @param ms How long to wait for it (a finger's click comes later)
   */
  function swallowNextClick(ms: number) {
    window.addEventListener("click", swallowClick, { capture: true });
    setTimeout(() => {
      window.removeEventListener("click", swallowClick, { capture: true });
    }, ms);
  }

  function onPointerUp(e: PointerEvent) {
    if (armed && e.pointerId !== armed.pointerId) return;

    if (dragging()) {
      swallowNextClick(armed?.touch ? 400 : 0);
      drop();
      return;
    }

    if (armed?.touch && lifted()) {
      // a long press that never moved is the menu, never the link
      if (!armed.menu) toggleMenu(armed.id);
      swallowNextClick(400);
    }

    reset();
  }

  /**
   * The browser took the press (a system gesture, a scroll): put it back
   */
  function onPointerCancel(e: PointerEvent) {
    if (armed && e.pointerId !== armed.pointerId) return;
    reset();
  }

  /**
   * The browser's own long-press menu (Android) and a right-click during a
   * drag stay away; the entry's menu is opened by us when it is wanted
   */
  function onContextMenu(e: Event) {
    if (openingMenu) return;
    if (!dragging() && !armed?.touch) return;

    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * A lifted or dragged entry holds the finger: the page must not scroll
   */
  function onTouchMove(e: TouchEvent) {
    if (!lifted() && !dragging()) return;
    if (e.cancelable) e.preventDefault();
  }

  function swallowClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    window.removeEventListener("click", swallowClick, { capture: true });
  }

  // Drop keyboard selection if window loses focus
  function onWindowBlur() {
    const held = carrying();
    if (!held) return;

    setCarrying(undefined);
    announce(t`${name(held)} dropped`);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && dragging()) {
      e.preventDefault();
      reset();
    }
  }

  function onScroll() {
    const held = dragging();
    const pos = pointer();
    if (!held || !pos) return;
    setIntent(intentAt(pos.x, pos.y, held));
  }

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  window.addEventListener("contextmenu", onContextMenu, { capture: true });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("blur", onWindowBlur);
  // Capture and passive are required here. Capture because scroll events don't bubble
  // and passive because the handler doesn't prevent scrolling.
  window.addEventListener("scroll", onScroll, { capture: true, passive: true });

  onCleanup(() => {
    window.removeEventListener("click", swallowClick, { capture: true });
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    window.removeEventListener("contextmenu", onContextMenu, {
      capture: true,
    });
    reset();
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("blur", onWindowBlur);
    window.removeEventListener("scroll", onScroll, { capture: true });
  });

  return {
    /**
     * Entry currently being dragged, if any
     */
    dragging,

    /**
     * Entry picked up with the keyboard, if any
     */
    carrying,

    /**
     * Entry a finger has rested on long enough to be dragged, if any
     */
    lifted,

    /**
     * Running commentary for a live region
     */
    status,

    /**
     * Handle a key press on an entry, giving keyboard users a way to reorder
     * @param id Entry id
     * @param e Keyboard event
     */
    keys(id: string, e: KeyboardEvent) {
      if (options.disabled?.()) return;

      const held = carrying();

      if (e.key === " ") {
        e.preventDefault();

        if (held === id) {
          setCarrying(undefined);
          announce(t`${name(id)} dropped`);
        } else {
          setCarrying(id);
          announce(
            t`${name(id)} picked up, use the arrow keys to move it and space to drop it`,
          );
        }

        return;
      }

      if (held !== id) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setCarrying(undefined);
        announce(t`${name(id)} dropped`);
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        shift(id, e.key === "ArrowUp" ? -1 : 1);
      }
    },

    /**
     * What dropping right now would do
     */
    intent,

    /**
     * Where the dragged entry should be drawn
     */
    pointer,

    /**
     * Track an entry's element so it can be measured
     * @param id Entry id
     * @param el Element
     */
    register(id: string, el: HTMLElement) {
      elements.set(id, el);
      // not passive: a lifted entry has to stop the page scrolling, and the
      // browser only lets a listener on the touched element do that in time
      el.addEventListener("touchmove", onTouchMove, { passive: false });
      onCleanup(() => {
        el.removeEventListener("touchmove", onTouchMove);
        elements.delete(id);
      });
    },

    /**
     * Begin watching for a drag on the given entry
     * @param id Entry id
     * @param e Pointer event
     */
    press(id: string, e: PointerEvent) {
      if (options.disabled?.() || e.button || !e.isPrimary) return;

      reset();
      const touch = e.pointerType === "touch";
      armed = {
        id,
        x: e.clientX,
        y: e.clientY,
        pointerId: e.pointerId,
        touch,
        menu: false,
      };

      if (touch) {
        // this press decides between a drag and the menu itself
        claimLongPress(e);
        pressTarget = e.target ?? undefined;
        pressTarget?.addEventListener(
          "touchmove",
          onTouchMove as EventListener,
          {
            passive: false,
          },
        );
        holdTimer = setTimeout(lift, TOUCH_HOLD_MS);
      }
    },
  };
}
