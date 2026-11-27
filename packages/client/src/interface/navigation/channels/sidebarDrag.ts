import { css } from "styled-system/css";

import {
  createTouchHold,
  isTouchLike,
} from "@revolt/ui/components/utils/touchHold";

/**
 * Moving channels and categories in a server's channel list, by hand.
 *
 * One controller for the whole list, for a mouse, a finger and a pen alike:
 *
 * - a mouse drags as soon as it moves a few pixels; a finger (or a pen on a
 *   touch screen) rests on a row first (touchHold), so a quick swipe still
 *   scrolls the list and resting longer still opens the row's menu;
 * - a lifted copy of the row follows the hand, its place in the list stays
 *   open as a slot, and the rows around it glide aside (FLIP) instead of
 *   jumping;
 * - a channel goes anywhere: up or down, into another category, or out of
 *   every category (the server's own Text and Voice groups);
 * - a category's name moves the whole category; while it moves, the lists
 *   fold away so only the names are left to sort;
 * - near the top or bottom edge the list scrolls by itself; Escape puts the
 *   row back where it was.
 *
 * The list is plain DOM marked with data attributes (see `DRAG_ATTRS`): the
 * controller moves the dragged node itself while the hand moves, and puts it
 * back where it was before the new order is handed over, so the renderer
 * never meets a node it did not place.
 */
export const DRAG_ATTRS = {
  /** a category's section (the server's own groups too) */
  section: "data-drag-section",
  /** the section's channel list; its value is the category id */
  list: "data-drag-list",
  /** what a list takes: "text", "voice" or "any" */
  accepts: "data-drag-accepts",
  /** a channel's row (with what hangs under it); its value is the id */
  channel: "data-drag-channel",
  /** "voice" or "text", for lists that take only one kind */
  kind: "data-drag-kind",
  /** where a press may start a drag: a channel row, a category name */
  grip: "data-drag-grip",
  /** the part of a row or section that the lifted copy shows */
  face: "data-drag-face",
  /** the element holding the movable categories */
  sections: "data-drag-sections",
} as const;

export type SidebarDrop =
  | {
      type: "channel";
      id: string;
      /** the category it now belongs to ("default": no category) */
      to: string;
      /** the channel it now sits right before, if any */
      before?: string;
      /** the channel it now sits right after, if any */
      after?: string;
    }
  | { type: "categories"; ids: string[] };

type Kind = "channel" | "category";

/** A mouse moves this far before a press becomes a drag */
const MOUSE_DRAG_PX = 4;
/** How long rows take to glide to their new place */
const GLIDE_MS = 180;
/** How long the lifted copy takes to settle into its slot */
const SETTLE_MS = 170;
/** The band along the top and bottom edge that scrolls the list */
const EDGE_PX = 56;
/** Fastest edge scroll, in pixels per frame */
const EDGE_SPEED = 16;

const EASE = "cubic-bezier(0.2, 0, 0, 1)";

const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Where an element sits in the list's own content, without any transform:
 * an element gliding to its place is hit-tested where it will be
 */
function layoutTop(el: HTMLElement, root: HTMLElement) {
  let top = 0;
  let node: HTMLElement | null = el;
  // the list is positioned while something moves, so the chain ends there
  while (node && node !== root) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top;
}

const visible = (el: HTMLElement) => el.offsetParent !== null;

export function createSidebarDrag(options: {
  /** the scrolling list */
  root: () => HTMLElement | undefined;
  /** whether anything may be moved now */
  enabled: () => boolean;
  /** a drag of this kind started or ended (the empty groups show for it) */
  onActive: (kind: Kind | undefined) => void;
  /** the hand let go somewhere new */
  onDrop: (drop: SidebarDrop) => void;
}) {
  type Drag = {
    kind: Kind;
    pointerId: number;
    /** the dragged node: a channel row, or a whole category section */
    slot: HTMLElement;
    /** where it came from, to put it back */
    home: { parent: Node; next: Node | null };
    /** the lifted copy and the box it moves in */
    ghost: HTMLElement;
    ghostBody: HTMLElement;
    host: HTMLElement;
    /** where the copy started, in the host's coordinates */
    origin: { left: number; top: number };
    /** where the pointer holds the copy */
    grab: { x: number; y: number };
    pointer: { x: number; y: number };
    frame?: number;
    dirty: boolean;
  };

  let drag: Drag | undefined;

  /** A drop still settling: finished at once when a new drag starts */
  let settling: (() => void) | undefined;

  /** A mouse press that has not moved far enough yet */
  let press:
    | {
        pointerId: number;
        x: number;
        y: number;
        grip: HTMLElement;
      }
    | undefined;

  // ── what can be dragged ───────────────────────────────────────────────

  /** The node a press on this grip would move, and of what kind */
  function movable(
    grip: HTMLElement,
  ): { kind: Kind; node: HTMLElement } | undefined {
    const row = grip.closest<HTMLElement>(`[${DRAG_ATTRS.channel}]`);
    if (row) return { kind: "channel", node: row };
    const section = grip.closest<HTMLElement>(`[${DRAG_ATTRS.section}]`);
    if (section?.parentElement?.hasAttribute(DRAG_ATTRS.sections))
      return { kind: "category", node: section };
    return undefined;
  }

  /** The grip a press landed on, unless it landed on a button in the row */
  function gripOf(target: EventTarget | null) {
    const el = target as Element | null;
    if (!el?.closest) return undefined;
    const grip = el.closest<HTMLElement>(`[${DRAG_ATTRS.grip}]`);
    if (!grip) return undefined;
    // the row's own small buttons (invite, settings, add) stay buttons
    const button = el.closest(
      "button, input, textarea, select, [draggable='true']",
    );
    if (button && button !== grip && grip.contains(button)) return undefined;
    return grip;
  }

  // ── a finger ──────────────────────────────────────────────────────────

  let fingerGrip: HTMLElement | undefined;
  let fingerTarget: EventTarget | undefined;

  const hold = createTouchHold({
    menuTarget: () => fingerTarget,
    onLift: () => fingerGrip && lift(fingerGrip, true),
    onDragStart: (from, e) => {
      const grip = fingerGrip;
      if (!grip) return;
      lift(grip, false);
      begin(grip, e.pointerId, from.x, from.y);
      move(e.clientX, e.clientY);
    },
    onEnd: (_how, dragged) => {
      if (fingerGrip) lift(fingerGrip, false);
      fingerGrip = fingerTarget = undefined;
      // released, or the browser took the finger mid-drag: drop where it is
      if (dragged && drag) finish(true);
    },
  });

  /** A resting finger: the row rises a little */
  function lift(grip: HTMLElement, on: boolean) {
    const node = movable(grip)?.node;
    const face = faceOf(node) ?? grip;
    if (on) face.setAttribute("data-drag-lifted", "");
    else face.removeAttribute("data-drag-lifted");
  }

  // ── pointer input ─────────────────────────────────────────────────────

  function onPointerDown(e: PointerEvent) {
    if (drag || !options.enabled()) return;
    const grip = gripOf(e.target);
    if (!grip || !movable(grip)) return;

    if (isTouchLike(e)) {
      if (hold.press(e)) {
        fingerGrip = grip;
        fingerTarget = e.target ?? undefined;
      }
      return;
    }

    // a mouse (or a pen on a desktop tablet): the main button only
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)
      return;
    press = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, grip };
  }

  function onPointerMove(e: PointerEvent) {
    if (press && e.pointerId === press.pointerId && !drag) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < MOUSE_DRAG_PX)
        return;
      const { grip, x, y } = press;
      press = undefined;
      begin(grip, e.pointerId, x, y);
    }
    if (drag && e.pointerId === drag.pointerId) move(e.clientX, e.clientY);
  }

  function onPointerUp(e: PointerEvent) {
    if (press?.pointerId === e.pointerId) press = undefined;
    // a finger's drag ends through the hold (onEnd)
    if (drag && e.pointerId === drag.pointerId && e.pointerType !== "touch")
      finish(true);
  }

  function onPointerCancel(e: PointerEvent) {
    if (press?.pointerId === e.pointerId) press = undefined;
    if (drag && e.pointerId === drag.pointerId && e.pointerType !== "touch")
      finish(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (drag && e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    }
  }

  /** A link or picture in a row must not start the browser's own drag */
  function onDragStart(e: DragEvent) {
    if (!press && !drag && !fingerGrip) return;
    const el = e.target as Element | null;
    if (el?.closest?.("[draggable='true']") && !el.closest("a, img")) return;
    e.preventDefault();
  }

  // ── the drag ──────────────────────────────────────────────────────────

  function faceOf(node: HTMLElement | undefined) {
    return (
      node?.querySelector<HTMLElement>(`[${DRAG_ATTRS.face}]`) ?? undefined
    );
  }

  function begin(grip: HTMLElement, pointerId: number, x: number, y: number) {
    settling?.();
    const root = options.root();
    const found = movable(grip);
    if (!root || !found || !options.enabled()) return;
    const { kind, node } = found;

    const host = root.parentElement ?? root;
    const face = faceOf(node) ?? node;
    const faceRect = face.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();

    // the copy that follows the hand: the row's face, lifted
    const ghost = document.createElement("div");
    ghost.className = ghostClass;
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.width = `${faceRect.width}px`;
    ghost.style.height = `${faceRect.height}px`;
    ghost.style.left = `${faceRect.left - hostRect.left}px`;
    ghost.style.top = `${faceRect.top - hostRect.top}px`;
    const ghostBody = document.createElement("div");
    ghostBody.className = ghostBodyClass;
    const copy = face.cloneNode(true) as HTMLElement;
    copy.removeAttribute("id");
    copy.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
    copy.removeAttribute("data-drag-lifted");
    copy.style.margin = "0";
    copy.style.width = "100%";
    ghostBody.appendChild(copy);
    ghost.appendChild(ghostBody);
    host.appendChild(ghost);

    drag = {
      kind,
      pointerId,
      slot: node,
      home: { parent: node.parentNode!, next: node.nextSibling },
      ghost,
      ghostBody,
      host,
      origin: {
        left: faceRect.left - hostRect.left,
        top: faceRect.top - hostRect.top,
      },
      grab: { x: x - faceRect.left, y: y - faceRect.top },
      pointer: { x, y },
      dirty: true,
    };

    if (!reducedMotion())
      ghostBody.animate(
        [
          { transform: "scale(1)", boxShadow: "none" },
          { transform: "scale(1.03)" },
        ],
        { duration: 140, easing: EASE, fill: "forwards" },
      );

    // the list underneath: no hover, no text selection, a grabbing hand;
    // the hidden empty groups show, or the category lists fold away, and
    // whatever showed or folded above it, the dragged row stays under the
    // hand (inside the glide, so the rest glides from where it was seen)
    const before = node.getBoundingClientRect().top;
    // the list scrolls smoothly on its own; the drag's corrections and edge
    // scrolling must land at once
    root.style.scrollBehavior = "auto";
    glide(() => {
      root.setAttribute("data-dragging", kind);
      node.setAttribute("data-drag-slot", "");
      options.onActive(kind);
      keepInPlace(root, node, before);
    });

    getSelection()?.removeAllRanges();
    try {
      navigator.vibrate?.(8);
    } catch {
      // not there: the lift is the feedback
    }
    tick();
  }

  /**
   * Scroll so an element that moved is back where it was on screen; where
   * the list cannot scroll that far, room is added at its top or bottom
   * (for as long as the drag lasts)
   */
  function keepInPlace(
    root: HTMLElement,
    el: Element,
    wasTop: number,
    addRoom = true,
  ) {
    const delta = el.getBoundingClientRect().top - wasTop;
    if (Math.abs(delta) < 0.5) return;
    let want = root.scrollTop + delta;
    if (!addRoom) {
      root.scrollTop = want;
      return;
    }
    if (want < 0) {
      root.style.paddingTop = `${-want}px`;
      want = 0;
    }
    const max = root.scrollHeight - root.clientHeight;
    if (want > max) root.style.paddingBottom = `${want - max}px`;
    root.scrollTop = want;
  }

  function move(x: number, y: number) {
    if (!drag) return;
    drag.pointer = { x, y };
    drag.dirty = true;
  }

  /** One frame: the copy follows, the edges scroll, the slot finds its place */
  function tick() {
    if (!drag) return;
    const current = drag;
    current.frame = requestAnimationFrame(tick);

    const root = options.root();
    if (!root) return;
    const rootRect = root.getBoundingClientRect();

    // near an edge the list scrolls by itself, faster the closer it gets
    const { y } = current.pointer;
    let speed = 0;
    if (y < rootRect.top + EDGE_PX)
      speed = -EDGE_SPEED * Math.min(1, (rootRect.top + EDGE_PX - y) / EDGE_PX);
    else if (y > rootRect.bottom - EDGE_PX)
      speed =
        EDGE_SPEED * Math.min(1, (y - (rootRect.bottom - EDGE_PX)) / EDGE_PX);
    if (speed) {
      const was = root.scrollTop;
      root.scrollTop = was + speed;
      if (root.scrollTop !== was) current.dirty = true;
    }

    if (!current.dirty) return;
    current.dirty = false;

    // the copy: up and down with the hand, sideways only a little
    const hostRect = current.host.getBoundingClientRect();
    const top = current.pointer.y - current.grab.y - hostRect.top;
    const sideways = current.pointer.x - current.grab.x - hostRect.left;
    const drift = Math.max(
      -10,
      Math.min(10, (sideways - current.origin.left) * 0.2),
    );
    current.ghost.style.transform = `translate3d(${drift}px, ${
      top - current.origin.top
    }px, 0)`;

    const at = current.pointer.y - rootRect.top + root.scrollTop;
    if (current.kind === "channel") placeChannel(root, current, at);
    else placeCategory(root, current, at);
  }

  /** Where a channel would land with the pointer at this height */
  function placeChannel(root: HTMLElement, current: Drag, at: number) {
    const kind = current.slot.getAttribute(DRAG_ATTRS.kind);
    const sections = [
      ...root.querySelectorAll<HTMLElement>(`[${DRAG_ATTRS.section}]`),
    ].filter((section) => {
      if (!visible(section)) return false;
      const list = section.querySelector<HTMLElement>(`[${DRAG_ATTRS.list}]`);
      const accepts = list?.getAttribute(DRAG_ATTRS.accepts) ?? "any";
      return !!list && (accepts === "any" || accepts === kind);
    });
    if (!sections.length) return;

    // the section under the pointer, or the nearest one
    let section = sections[0];
    for (const candidate of sections) {
      if (layoutTop(candidate, root) <= at) section = candidate;
      else break;
    }
    const list = section.querySelector<HTMLElement>(`[${DRAG_ATTRS.list}]`)!;

    // the first row whose middle is below the pointer
    let before: HTMLElement | null = null;
    for (const row of list.children) {
      const el = row as HTMLElement;
      if (el === current.slot || !el.hasAttribute(DRAG_ATTRS.channel)) continue;
      if (!visible(el)) continue;
      if (layoutTop(el, root) + el.offsetHeight / 2 > at) {
        before = el;
        break;
      }
    }

    if (current.slot.parentElement === list) {
      // already there: the next row after the slot is the same one
      let next = current.slot.nextElementSibling as HTMLElement | null;
      while (next && !next.hasAttribute(DRAG_ATTRS.channel))
        next = next.nextElementSibling as HTMLElement | null;
      if (next === before) return;
    }

    glide(() => list.insertBefore(current.slot, before));
  }

  /** Where a category would land with the pointer at this height */
  function placeCategory(root: HTMLElement, current: Drag, at: number) {
    const holder = current.slot.parentElement;
    if (!holder) return;
    let before: HTMLElement | null = null;
    for (const child of holder.children) {
      const el = child as HTMLElement;
      if (el === current.slot || !el.hasAttribute(DRAG_ATTRS.section)) continue;
      if (layoutTop(el, root) + el.offsetHeight / 2 > at) {
        before = el;
        break;
      }
    }
    let next = current.slot.nextElementSibling as HTMLElement | null;
    while (next && !next.hasAttribute(DRAG_ATTRS.section))
      next = next.nextElementSibling as HTMLElement | null;
    if (next === before) return;
    glide(() => holder.insertBefore(current.slot, before));
  }

  /**
   * Change the list's layout and let everything that moved glide from where
   * it was to where it is now
   */
  function glide(change: () => void) {
    const root = options.root();
    if (!root) return change();

    const kind = drag?.kind;
    const selector =
      kind === "category"
        ? `[${DRAG_ATTRS.sections}] > [${DRAG_ATTRS.section}]`
        : `[${DRAG_ATTRS.channel}], [${DRAG_ATTRS.section}] > [${DRAG_ATTRS.face}]`;

    const rootRect = root.getBoundingClientRect();
    const near = (rect: DOMRect) =>
      rect.bottom > rootRect.top - 200 && rect.top < rootRect.bottom + 200;

    const first = new Map<HTMLElement, number>();
    for (const el of root.querySelectorAll<HTMLElement>(selector)) {
      const rect = el.getBoundingClientRect();
      if (rect.height && near(rect)) first.set(el, rect.top);
    }
    for (const el of first.keys())
      for (const animation of el.getAnimations())
        if ((animation as Animation & { id: string }).id === "glide")
          animation.cancel();

    change();

    if (reducedMotion()) return;
    for (const [el, was] of first) {
      if (!el.isConnected) continue;
      const delta = was - el.getBoundingClientRect().top;
      if (Math.abs(delta) < 0.5) continue;
      const animation = el.animate(
        [{ transform: `translateY(${delta}px)` }, { transform: "none" }],
        { duration: GLIDE_MS, easing: EASE },
      );
      animation.id = "glide";
    }
  }

  /** Let go: drop it where its slot is (or put it back) */
  function finish(keep: boolean) {
    const current = drag;
    if (!current) return;
    drag = undefined;
    if (current.frame) cancelAnimationFrame(current.frame);
    const root = options.root();

    if (!keep) {
      glide(() =>
        current.home.parent.insertBefore(
          current.slot,
          current.home.next?.parentNode === current.home.parent
            ? current.home.next
            : null,
        ),
      );
    }

    // the copy settles into the slot, then the slot becomes the row again
    const face = faceOf(current.slot) ?? current.slot;
    const target = face.getBoundingClientRect();
    const hostRect = current.host.getBoundingClientRect();
    let done = false;
    const settle = () => {
      if (done) return;
      done = true;
      clearTimeout(fallback);
      if (settling === settle) settling = undefined;
      current.ghost.remove();
      cleanUp(current, root, keep);
    };
    // animations do not run in a hidden tab: the drop must not wait for one
    const fallback = setTimeout(settle, SETTLE_MS + 80);
    settling = settle;
    if (reducedMotion() || !target.height) return settle();

    const to = `translate3d(0, ${target.top - hostRect.top - current.origin.top}px, 0)`;
    current.ghostBody.getAnimations().forEach((a) => a.cancel());
    const animation = current.ghost.animate(
      [
        { transform: current.ghost.style.transform || "none" },
        { transform: to },
      ],
      { duration: SETTLE_MS, easing: EASE, fill: "forwards" },
    );
    current.ghostBody.animate(
      [{ transform: "scale(1.03)" }, { transform: "scale(1)" }],
      { duration: SETTLE_MS, easing: EASE, fill: "forwards" },
    );
    animation.onfinish = settle;
    animation.oncancel = settle;
  }

  function cleanUp(
    current: Drag,
    root: HTMLElement | undefined,
    keep: boolean,
  ) {
    // what the drop says, read before the node goes back home
    const drop = keep ? readDrop(current) : undefined;
    // where the dropped row is on screen, to keep it there once the list is
    // drawn in its new order
    const anchor =
      current.kind === "channel" ? DRAG_ATTRS.channel : DRAG_ATTRS.section;
    const anchorId = current.slot.getAttribute(anchor);
    const anchorTop = (
      faceOf(current.slot) ?? current.slot
    ).getBoundingClientRect().top;

    // put the node back where the renderer left it; the new order comes
    // from the data, in the same task, so nothing paints in between
    const { parent, next } = current.home;
    try {
      parent.insertBefore(
        current.slot,
        next?.parentNode === parent ? next : null,
      );
    } catch {
      // the list changed under the drag: the data redraws it anyway
    }
    current.slot.removeAttribute("data-drag-slot");
    root?.removeAttribute("data-dragging");
    if (root) root.style.paddingTop = root.style.paddingBottom = "";

    swallowClick();
    options.onActive(undefined);
    if (drop) options.onDrop(drop);

    // the lists unfold and the new order is drawn (in this same task): the
    // row the hand let go of stays where it was let go
    const landed =
      root && anchorId
        ? root.querySelector(`[${anchor}="${CSS.escape(anchorId)}"]`)
        : null;
    const face = landed?.querySelector(`[${DRAG_ATTRS.face}]`) ?? landed;
    if (root && face) keepInPlace(root, face, anchorTop, false);
    if (root) root.style.scrollBehavior = "";
  }

  /** The new place of the dragged node, or nothing when it did not move */
  function readDrop(current: Drag): SidebarDrop | undefined {
    const { slot, home } = current;
    const stayed =
      slot.parentNode === home.parent &&
      (slot.nextSibling === home.next ||
        // only non-rows (text nodes, markers) between it and its old next
        (() => {
          let node = slot.nextSibling;
          while (node && node !== home.next) {
            if (node instanceof HTMLElement) return false;
            node = node.nextSibling;
          }
          return node === home.next;
        })());
    if (stayed) return undefined;

    if (current.kind === "category") {
      const holder = slot.parentElement!;
      return {
        type: "categories",
        ids: [...holder.children]
          .map((el) => el.getAttribute(DRAG_ATTRS.section))
          .filter((id): id is string => !!id),
      };
    }

    const list = slot.parentElement!;
    const neighbour = (step: "next" | "previous") => {
      let el = (
        step === "next" ? slot.nextElementSibling : slot.previousElementSibling
      ) as HTMLElement | null;
      while (el && !el.hasAttribute(DRAG_ATTRS.channel))
        el = (
          step === "next" ? el.nextElementSibling : el.previousElementSibling
        ) as HTMLElement | null;
      return el?.getAttribute(DRAG_ATTRS.channel) ?? undefined;
    };
    return {
      type: "channel",
      id: slot.getAttribute(DRAG_ATTRS.channel)!,
      to: list.getAttribute(DRAG_ATTRS.list)!,
      before: neighbour("next"),
      after: neighbour("previous"),
    };
  }

  /** The click that ends a mouse drag must not open the row under it */
  function swallowClick() {
    const swallow = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      stop();
    };
    const stop = () => {
      clearTimeout(timer);
      window.removeEventListener("click", swallow, { capture: true });
    };
    window.addEventListener("click", swallow, { capture: true });
    const timer = setTimeout(stop, 300);
  }

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  window.addEventListener("keydown", onKeyDown, { capture: true });

  return {
    /** Put on the list: where presses start */
    listen(root: HTMLElement) {
      root.addEventListener("pointerdown", onPointerDown);
      root.addEventListener("dragstart", onDragStart);
      // a lifted row holds the finger: the list must not scroll under it
      const unwatch = hold.watch(root);
      return () => {
        root.removeEventListener("pointerdown", onPointerDown);
        root.removeEventListener("dragstart", onDragStart);
        unwatch?.();
      };
    },
    /** Whether a drag is running */
    active: () => !!drag,
    dispose() {
      if (drag) finish(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      hold.dispose();
    },
  };
}

/** The lifted copy's frame: it only moves */
const ghostClass = css({
  position: "absolute",
  zIndex: 30,
  pointerEvents: "none",
  willChange: "transform",
});

/** The lifted copy itself: raised, a soft shadow, the row's own corners */
const ghostBodyClass = css({
  width: "100%",
  height: "100%",
  borderRadius: "8px",
  overflow: "hidden",
  background: "var(--z-bg-raised, var(--md-sys-color-surface-container-high))",
  boxShadow:
    "0 10px 28px rgba(0, 0, 0, 0.32), 0 0 0 1px color-mix(in srgb, var(--z-accent) 45%, transparent)",
  cursor: "grabbing",
  "& *": { cursor: "grabbing !important" },
});

/**
 * Put on the scrolling list: the slot, the folded lists while a category
 * moves, and a list that does not react to the hand while something moves
 */
export const sidebarDragStyles = css({
  // offsets are counted from here while something moves
  "&[data-dragging]": {
    position: "relative",
    cursor: "grabbing",
    userSelect: "none",
    WebkitUserSelect: "none",
  },
  "&[data-dragging] *": { pointerEvents: "none" },

  // the dragged row's place: an open slot in the accent colour
  "& [data-drag-slot]": {
    position: "relative",
  },
  "& [data-drag-slot] > *": { visibility: "hidden" },
  "& [data-drag-slot]::after": {
    content: '""',
    position: "absolute",
    inset: "1px 0",
    borderRadius: "8px",
    background: "color-mix(in srgb, var(--z-accent) 12%, transparent)",
    boxShadow:
      "inset 0 0 0 1.5px color-mix(in srgb, var(--z-accent) 55%, transparent)",
  },
  // a category's slot is only as tall as its name
  "&[data-dragging='category'] [data-drag-slot]::after": {
    inset: "auto 0 0 0",
    height: "34px",
  },

  // a category moves: every category folds to its name
  "&[data-dragging='category'] [data-drag-sections] [data-drag-list]": {
    display: "none",
  },

  // a finger rests on a row: it rises a little, ready to move
  "& [data-drag-lifted]": {
    transform: "scale(1.03)",
    boxShadow: "var(--z-elev-raised)",
    borderRadius: "8px",
    background: "var(--z-bg-raised, transparent)",
    transition:
      "transform var(--z-motion-fast, 120ms) var(--z-ease-standard, ease), box-shadow var(--z-motion-fast, 120ms) var(--z-ease-standard, ease)",
    _motionReduce: { transition: "none" },
  },

  // a long press belongs to the list, never to the browser
  "@media (pointer: coarse)": {
    "& [data-drag-grip]": {
      WebkitTouchCallout: "none",
      WebkitUserSelect: "none",
      userSelect: "none",
    },
    "& [data-drag-grip] a, & [data-drag-grip] img": {
      WebkitTouchCallout: "none",
      // @ts-expect-error WebKit-only property Panda has no type for
      WebkitUserDrag: "none",
    },
  },
});
