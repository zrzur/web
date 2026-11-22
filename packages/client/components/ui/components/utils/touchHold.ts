import { claimLongPress } from "../../directives/longPress";

/**
 * A finger has to rest this long on a row before it lifts and can be
 * dragged; moving earlier is a scroll of the list
 */
export const TOUCH_HOLD_MS = 350;

/**
 * A finger that keeps resting this long, still without moving, opens the
 * row's menu, as a long press does everywhere else in the app
 */
export const TOUCH_MENU_MS = 500;

/**
 * How far a finger may wander while it rests before the press counts as a
 * scroll
 */
export const TOUCH_SLOP_PX = 8;

/**
 * How far a lifted finger has to move before the drag starts
 */
export const TOUCH_DRAG_PX = 5;

/**
 * Sent (bubbling) from the touched node when a row lifts: a swipe that
 * follows belongs to the drag, so the phone drawer lets go of this touch
 */
export const TOUCH_HOLD_EVENT = "touchhold";

/** A finger or a pen (an Apple Pencil on iPad); never a mouse */
export function isTouchLike(e: PointerEvent) {
  return e.pointerType === "touch" || e.pointerType === "pen";
}

/** How long to wait for the click that follows a finger's press */
const CLICK_AFTER_TOUCH_MS = 400;

/** Menu events sent by a touch hold, let through by every hold */
let openingMenu = 0;

/**
 * Open (or, once open, close) a row's menu through the same event a
 * right-click sends, so the row's own menu shows as it does with a mouse
 * @param el Element inside the row; the event bubbles up to its menu
 */
export function toggleMenuAt(el: EventTarget) {
  openingMenu++;
  try {
    el.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
  } finally {
    openingMenu--;
  }
}

/** Keep the next click (within a short time) from doing anything */
function swallowNextClick(ms: number) {
  function swallow(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    stop();
  }

  function stop() {
    clearTimeout(timer);
    window.removeEventListener("click", swallow, { capture: true });
  }

  window.addEventListener("click", swallow, { capture: true });
  const timer = setTimeout(stop, ms);
}

export type TouchHoldOptions = {
  /** Where the press came from: the menu event is sent there */
  menuTarget: () => EventTarget | undefined;

  /** The finger rested long enough: show that the row can move now */
  onLift?: () => void;

  /**
   * A lifted finger moved: the drag starts
   * @param from Where the finger first landed
   * @param e The move that started it
   */
  onDragStart: (
    from: { x: number; y: number; screenX: number; screenY: number },
    e: PointerEvent,
  ) => void;

  /**
   * The press is over
   * @param how Released, or taken by the browser (a scroll, a gesture)
   * @param dragged Whether a drag ran
   */
  onEnd?: (how: "release" | "cancel", dragged: boolean) => void;
};

/**
 * Long press to drag, for a finger. Mouse and pen are left alone.
 *
 * - resting TOUCH_HOLD_MS lifts the row (moving earlier is a scroll);
 * - a lifted finger that moves TOUCH_DRAG_PX starts the drag;
 * - resting until TOUCH_MENU_MS opens the row's own menu, and releasing a
 *   lifted row without moving does too; a drag that starts after the menu
 *   opened closes it again;
 * - the browser's own long-press menu, the shared iOS long-press menu, the
 *   page scrolling under a lifted row and the click after it stay away.
 */
export function createTouchHold(options: TouchHoldOptions) {
  type State = "idle" | "pending" | "lifted" | "dragging";
  let state: State = "idle";
  let start = { x: 0, y: 0, screenX: 0, screenY: 0 };
  let pointerId = -1;
  let menuOpen = false;
  let target: EventTarget | undefined;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let menuTimer: ReturnType<typeof setTimeout> | undefined;

  function clearTimers() {
    clearTimeout(holdTimer);
    clearTimeout(menuTimer);
    holdTimer = menuTimer = undefined;
  }

  function finish(how: "release" | "cancel") {
    const dragged = state === "dragging";
    const was = state;
    clearTimers();
    target?.removeEventListener("touchmove", onTouchMove as EventListener);
    target = undefined;
    state = "idle";
    menuOpen = false;
    if (was !== "idle") options.onEnd?.(how, dragged);
  }

  function lift() {
    holdTimer = undefined;
    if (state !== "pending") return;

    state = "lifted";
    options.onLift?.();
    target?.dispatchEvent(new Event(TOUCH_HOLD_EVENT, { bubbles: true }));
    try {
      navigator.vibrate?.(10);
    } catch {
      // not allowed or not there: the lift itself is the feedback
    }

    menuTimer = setTimeout(() => {
      menuTimer = undefined;
      if (state !== "lifted") return;
      const at = options.menuTarget();
      if (!at) return;
      menuOpen = true;
      toggleMenuAt(at);
    }, TOUCH_MENU_MS - TOUCH_HOLD_MS);
  }

  function onPointerMove(e: PointerEvent) {
    if (state === "idle" || e.pointerId !== pointerId) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);

    if (state === "pending") {
      // still resting: a finger that moves now is scrolling the list
      if (moved >= TOUCH_SLOP_PX) finish("cancel");
      return;
    }

    if (state === "lifted" && moved >= TOUCH_DRAG_PX) {
      clearTimers();
      // the menu opened while the finger rested: the drag takes over
      if (menuOpen) {
        menuOpen = false;
        const at = options.menuTarget();
        if (at) toggleMenuAt(at);
      }
      state = "dragging";
      options.onDragStart({ ...start }, e);
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (state === "idle" || e.pointerId !== pointerId) return;

    if (state === "dragging") {
      swallowNextClick(CLICK_AFTER_TOUCH_MS);
    } else if (state === "lifted") {
      // a long press that never moved is the menu, never the link
      if (!menuOpen) {
        const at = options.menuTarget();
        if (at) toggleMenuAt(at);
      }
      swallowNextClick(CLICK_AFTER_TOUCH_MS);
    }

    finish("release");
  }

  function onPointerCancel(e: PointerEvent) {
    if (state === "idle" || e.pointerId !== pointerId) return;
    finish("cancel");
  }

  /** The browser's own long-press menu (Android) while a finger is down */
  function onContextMenu(e: Event) {
    if (openingMenu || state === "idle") return;
    e.preventDefault();
    e.stopPropagation();
  }

  /** A lifted or dragged row holds the finger: the page must not scroll */
  function onTouchMove(e: TouchEvent) {
    if (state !== "lifted" && state !== "dragging") return;
    if (e.cancelable) e.preventDefault();
  }

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  window.addEventListener("contextmenu", onContextMenu, { capture: true });

  return {
    /**
     * Watch a finger that lands on a row
     * @param e Pointer down
     * @returns Whether the press is a finger's and is now watched
     */
    press(e: PointerEvent) {
      if (!isTouchLike(e) || !e.isPrimary) return false;

      finish("cancel");
      state = "pending";
      start = {
        x: e.clientX,
        y: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY,
      };
      pointerId = e.pointerId;
      // this press decides between a drag and the menu itself
      claimLongPress(e);
      // touch events keep going to this node even when it is redrawn and
      // leaves the page (then they no longer reach the row): its own listener
      target = e.target ?? undefined;
      target?.addEventListener("touchmove", onTouchMove as EventListener, {
        passive: false,
      });
      holdTimer = setTimeout(lift, TOUCH_HOLD_MS);
      return true;
    },

    /**
     * Stop the page scrolling under a lifted row that is touched here. Not
     * passive: only a listener on the touched element is in time for that.
     * @param el Row or list
     * @returns Stop watching
     */
    watch(el: HTMLElement) {
      el.addEventListener("touchmove", onTouchMove, { passive: false });
      return () => el.removeEventListener("touchmove", onTouchMove);
    },

    /** A finger is down on a row (resting, lifted or dragging) */
    active: () => state !== "idle",

    /** The row is lifted or being dragged by a finger */
    holding: () => state === "lifted" || state === "dragging",

    /** Forget the press without a drop */
    cancel: () => finish("cancel"),

    /** Stop listening */
    dispose() {
      finish("cancel");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("contextmenu", onContextMenu, {
        capture: true,
      });
    },
  };
}

export type TouchHold = ReturnType<typeof createTouchHold>;
