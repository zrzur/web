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
  untrack,
} from "solid-js";

import { css } from "styled-system/css";

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

    return props.disabled || dragDisabled();
  }

  let zone: HTMLDivElement | undefined;

  // keep track of where elements are grabbed to offset cursor to corner
  let grabbedAt = { x: 0, y: 0 };

  function onPointerDown(e: PointerEvent) {
    const row = [...(zone?.children ?? [])].find((child) =>
      child.contains(e.target as Node),
    );

    if (!row) return;

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
      class={props.dropIndicator ? dropIndicatorStyles : undefined}
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
                  "2px solid color-mix(in srgb, 40% var(--md-sys-color-primary), transparent)",
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

const dropIndicatorStyles = css({
  "& > [data-is-dnd-shadow-item-internal]": {
    visibility: "visible !important",
    outline: "2px solid var(--md-sys-color-primary)",
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
  };
}
