import { useLingui } from "@lingui/solid/macro";
import { dndzone } from "solid-dnd-directive";
import {
  Accessor,
  For,
  JSX,
  Setter,
  createEffect,
  createSignal,
  on,
  onCleanup,
  onMount,
  untrack,
} from "solid-js";

import { css, cx } from "styled-system/css";

import { createTouchHold, isTouchLike } from "./touchHold";
import { liftScope, setLifted } from "./touchLift";

interface Props<T> {
  type?: string;
  items: Item<T>[];
  disabled?: boolean;
  dragHandles?: boolean;
  children: (item: {
    item: T;
    dragDisabled: Accessor<boolean>;
    setDragDisabled: Setter<boolean>;
  }) => JSX.Element;
  onChange: (ids: string[]) => void;
  minimumDropAreaHeight?: string;
  /**
   * Phones and tablets: a finger rests on a row to lift it, then drags it;
   * resting still opens the row's menu and a quick swipe scrolls (touchHold)
   */
  touchHold?: boolean;
  dropIndicator?: boolean;
  /** Told when a drag out of this list starts and ends */
  onDragChange?: (active: boolean) => void;
}

type Item<T> = { id: string } & T;

/**
 * The dnd zone library requires you to have an id key
 */
interface ContainerItem<T> {
  id: string;
  item: T;
}

interface DragHandleEvent<T> {
  detail: {
    items: ContainerItem<T>[];
  };
  type: "consider" | "finalize";
}

/**
 * Typescript removes dndzone because it thinks that it is not being used.
 * This trick prevents that from happening.
 * https://github.com/solidjs/solid/issues/1005#issuecomment-1134778606
 */
void dndzone;

/**
 * Draggable list container
 */
export function Draggable<T>(props: Props<T>) {
  const [dragDisabled, setDragDisabled] = createSignal(
    // eslint-disable-next-line solid/reactivity
    props.dragHandles || false,
  );

  // one wrapper per item: <For> keeps a row for as long as it gets the same
  // object, so a new list of the same items must not mean new wrappers
  const wrappers = new Map<string, ContainerItem<T>>();

  function wrap(items: Item<T>[]) {
    const next = items.map((item) => {
      const known = wrappers.get(item.id);
      return known?.item === item ? known : { id: item.id, item };
    });

    wrappers.clear();
    for (const wrapper of next) wrappers.set(wrapper.id, wrapper);
    return next;
  }

  // start off with the items we were given; filling this in from the effect
  // below leaves the list empty for a frame, which loses the scroll position
  const [containerItems, setContainerItems] = createSignal<ContainerItem<T>[]>(
    // eslint-disable-next-line solid/reactivity
    wrap(props.items),
  );

  createEffect(() => setDragDisabled(props.dragHandles || false));

  // force re-render when items change
  // fixes inability to re-order channels after opening category
  const [renderSignal, forceRender] = createSignal(0);

  createEffect(() => {
    const next = wrap(props.items);
    const current = untrack(containerItems);

    // nothing to do, and telling the drag zone would make it measure every row
    if (
      next.length !== current.length ||
      next.some((wrapper, index) => wrapper !== current[index])
    ) {
      setContainerItems(next);
    }
  });

  createEffect(
    on(containerItems, () => forceRender((revision) => revision + 1)),
  );

  /**
   * Handle DND event from solid-dnd-directive
   * @param e
   */
  function handleDndEvent(e: DragHandleEvent<T>) {
    setLifted(pressRow, false);
    setDragDisabled(props.dragHandles || false);
    props.onDragChange?.(e.type === "consider");

    const { items: newContainerItems } = e.detail;
    setContainerItems(newContainerItems);

    if (e.type === "finalize") {
      if (zone) {
        zone.style.minHeight = "";
        zone.style.minWidth = "";
      }

      props.onChange(
        newContainerItems.map((containerItems) => containerItems.id),
      );
    }
  }

  function isDisabled() {
    renderSignal();

    return props.disabled || dragDisabled() || fingerDown();
  }

  let zone: HTMLDivElement | undefined;

  // a finger's press: the row it landed on and the node under it
  let pressRow: HTMLElement | undefined;
  let pressTarget: EventTarget | undefined;

  /**
   * A finger (or pen) is down on this list. The drag zone is switched off
   * meanwhile, so the finger's own touch start never reaches it (it would
   * start a drag at once and stop the scroll); the touch start still goes on
   * to everything else, the phone drawer's swipe included. The hold turns it
   * back on when it hands the press over.
   */
  const [fingerDown, setFingerDown] = createSignal(false);
  let fingerId = -1;

  const hold = untrack(() => props.touchHold)
    ? createTouchHold({
        menuTarget: () => pressTarget,
        onLift: () => setLifted(pressRow, true),
        onDragStart: (from, e) => {
          const row = pressRow;
          if (!row) return;
          // the row stays lifted until the drag zone takes it (Chrome lets
          // it see the finger only past its touch slop, about 15 px)
          setFingerDown(false);
          if (props.dragHandles) setDragDisabled(false);
          // hand the finger to the drag zone, as if it had just landed here;
          // the zone stops this touch start, so nothing else sees it
          queueMicrotask(() => {
            const start = new Event("touchstart", {
              bubbles: true,
              cancelable: true,
            });
            const touch = {
              identifier: e.pointerId,
              target: row,
              clientX: from.x,
              clientY: from.y,
              pageX: from.x + window.scrollX,
              pageY: from.y + window.scrollY,
              screenX: from.screenX,
              screenY: from.screenY,
            };
            Object.defineProperty(start, "touches", { value: [touch] });
            Object.defineProperty(start, "changedTouches", { value: [touch] });
            row.dispatchEvent(start);
          });
        },
        onEnd: (how, dragged) => {
          setLifted(pressRow, false);
          // the browser took the finger mid-drag: drop where it is
          if (dragged && how === "cancel") {
            window.dispatchEvent(new Event("touchend"));
          } else if (!dragged && props.dragHandles) {
            setDragDisabled(true);
          }
          setFingerDown(false);
          pressRow = pressTarget = undefined;
        },
      })
    : undefined;

  /** The finger that switched the drag zone off has gone */
  function onFingerUp(e: PointerEvent) {
    if (e.pointerId === fingerId) setFingerDown(false);
  }

  /** The window lost the finger (another app, a call, the tab hidden) */
  function onLeave() {
    if (document.visibilityState === "hidden" || !document.hasFocus())
      setFingerDown(false);
  }

  onMount(() => {
    if (!hold || !zone) return;
    window.addEventListener("pointerup", onFingerUp);
    window.addEventListener("pointercancel", onFingerUp);
    window.addEventListener("blur", onLeave);
    document.addEventListener("visibilitychange", onLeave);
    // One non-passive touch move listener per stack of finger lists: the
    // outermost one (the category list) holds it, and the channel lists
    // inside it add none. It sits on that list, not on the scroll container
    // around it. It lets a lifted row stop the scroll; the price is that a
    // gesture starting on the list waits for the page's script to answer
    // its first touch move before the browser scrolls.
    const outer = !zone.parentElement?.closest("[data-touch-hold]");
    const unwatch = outer ? hold.watch(zone) : undefined;
    onCleanup(() => {
      window.removeEventListener("pointerup", onFingerUp);
      window.removeEventListener("pointercancel", onFingerUp);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("visibilitychange", onLeave);
      unwatch?.();
    });
  });

  onCleanup(() => hold?.dispose());

  // keep track of where elements are grabbed to offset cursor to corner
  let grabbedAt = { x: 0, y: 0 };

  function onPointerDown(e: PointerEvent) {
    // a new press: whatever an earlier one left behind is over
    if (hold) setFingerDown(false);

    const row = [...(zone?.children ?? [])].find((child) =>
      child.contains(e.target as Node),
    );

    if (!row) return;

    if (hold && isTouchLike(e) && e.isPrimary) {
      fingerId = e.pointerId;
      setFingerDown(true);
    }

    // a finger: the innermost list that can move the row watches the press
    if (hold && !props.disabled && !pressedHere.has(e)) {
      const target = e.target as Element | null;
      const handle =
        !props.dragHandles || !!target?.closest?.("[data-drag-handle]");
      if (handle && hold.press(e)) {
        pressedHere.add(e);
        pressRow = row as HTMLElement;
        pressTarget = e.target ?? undefined;
      }
    }

    const { left, top } = row.getBoundingClientRect();
    grabbedAt = { x: e.clientX - left, y: e.clientY - top };
  }

  function styleDraggedElement(element?: HTMLElement) {
    if (!element || element.dataset.dragged) return;

    element.dataset.dragged = "true";
    element.style.transition = "none";

    element.style.marginLeft = `${grabbedAt.x - 3}px`;
    element.style.marginTop = `${grabbedAt.y - 3}px`;

    if (props.dropIndicator) {
      element
        .querySelectorAll("[data-drop-zone]")
        .forEach((zone) => zone.remove());

      element.style.height = "auto";
    }
  }

  const transformDraggedElement = () => styleDraggedElement;

  return (
    <div
      ref={zone}
      data-drop-zone
      data-touch-hold={props.touchHold ? "" : undefined}
      class={cx(
        props.dropIndicator && dropIndicatorStyles,
        props.touchHold && touchRowStyles,
        props.touchHold && liftScope,
      )}
      onPointerDown={onPointerDown}
      use:dndzone={{
        type: props.type,
        items: containerItems,
        dragDisabled: isDisabled,
        flipDurationMs: 0,
        morphDisabled: props.dropIndicator,
        useCursorForDetection: true,
        dropAnimationDisabled: true,
        transformDraggedElement,
        dropTargetStyle: {
          minHeight: props.minimumDropAreaHeight ?? "24px",
          ...(props.dropIndicator
            ? {}
            : {
                outline:
                  "2px solid color-mix(in srgb, 40% var(--z-accent), transparent)",
                borderRadius: "4px",
                outlineOffset: "-2px",
              }),
        },
      }}
      // @ts-expect-error missing jsx typing
      on:consider={handleDndEvent}
      on:finalize={handleDndEvent}
    >
      <For each={containerItems()}>
        {(containerItem) =>
          props.children({
            item: containerItem.item,
            dragDisabled,
            setDragDisabled,
          })
        }
      </For>
    </div>
  );
}

/** Presses a list's finger hold has taken (the inner list of two wins) */
const pressedHere = new WeakSet<Event>();

/**
 * A long press belongs to the list (drag or the row's menu), never to the
 * browser: no link preview, text selection or dragging a link out
 */
const touchRowStyles = css({
  "@media (pointer: coarse)": {
    "& > *": {
      WebkitTouchCallout: "none",
      WebkitUserSelect: "none",
      userSelect: "none",
    },
    "& a, & img": {
      WebkitTouchCallout: "none",
      // @ts-expect-error WebKit-only property Panda has no type for
      WebkitUserDrag: "none",
    },
  },
});

const dropIndicatorStyles = css({
  "& > [data-is-dnd-shadow-item-internal]": {
    visibility: "visible !important",
    outline: "2px solid var(--z-accent)",
    outlineOffset: "-2px",
    borderRadius: "var(--borderRadius-md)",
    background: "var(--md-sys-color-surface-container-high)",
  },

  "& > [data-is-dnd-shadow-item-internal] > *": {
    opacity: 0.4,
  },
});

export function createDragHandle(
  dragDisabled: Accessor<boolean>,
  setDragDisabled: (value: boolean) => void,
) {
  const { t } = useLingui();
  function startDrag(e: Event) {
    e.preventDefault();
    setDragDisabled(false);
  }

  function endDrag() {
    setDragDisabled(true);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if ((e.key === "Enter" || e.key === " ") && dragDisabled())
      setDragDisabled(false);
  }

  return {
    // focusable and worked with Enter or Space: a button to assistive tech
    // too (a plain span with only an aria-label has no name to read)
    role: "button" as const,
    tabindex: dragDisabled() ? 0 : -1,
    onmouseenter: startDrag,
    ontouchstart: startDrag,
    onmouseleave: endDrag,
    onkeydown: handleKeyDown,
    // what the handle shows stays its name; a handle with only an icon passes
    // its own aria-label
    "aria-description": t`Drag to reorder`,
    // a finger's long press starts a drag only on the handle
    "data-drag-handle": "",
  };
}
