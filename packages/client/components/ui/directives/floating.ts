import { useDevice } from "@revolt/common";
import {
  type Accessor,
  type JSX,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from "solid-js";

import { applyTooltipName } from "../components/floating/tooltipName";
import { addLongPressListener } from "./longPress";

type Props = JSX.Directives["floating"] & object;

export type FloatingElement = {
  config: () => Props;
  element: HTMLElement;
  hide: () => void;
  show: Accessor<Props | undefined>;
};

const [floatingElements, setFloatingElements] = createSignal<FloatingElement[]>(
  [],
);

export { floatingElements };

/**
 * Register a new floating element
 * @param element element
 */
export function registerFloatingElement(element: FloatingElement) {
  setFloatingElements((elements) => [...elements, element]);
}

/**
 * Un register floating element
 * @param element DOM Element
 */
export function unregisterFloatingElement(element: HTMLElement) {
  setFloatingElements((elements) =>
    elements.filter((entry) => entry.element !== element),
  );
}

/**
 * Add floating elements
 * @param element Element
 * @param accessor Parameters
 */
export function floating(element: HTMLElement, accessor: Accessor<Props>) {
  if (!accessor()) return;

  const { isIOSTouch } = useDevice();

  const [show, setShow] = createSignal<Props | undefined>();
  // DEBUG: createEffect(() => console.info("show:", show()));

  registerFloatingElement({
    config: accessor,
    element,
    show,
    /**
     * Hide the element
     */
    hide() {
      setShow(undefined);
    },
  });

  /**
   * Trigger a floating element
   */
  function trigger(target: keyof Props, desiredState?: boolean) {
    const current = show();
    const config = accessor();

    if (target === "userCard" && config.userCard) {
      if (current?.userCard) {
        setShow(undefined);
      } else if (!current) {
        setShow({ userCard: config.userCard });
      } else {
        setShow(undefined);
        setShow({ userCard: config.userCard });
      }
    }

    if (target === "tooltip" && config.tooltip) {
      if (current?.tooltip) {
        if (desiredState !== true) {
          setShow(undefined);
        }
      } else if (!current) {
        if (desiredState !== false) {
          setShow({ tooltip: config.tooltip });
        }
      }
    }

    if (target === "contextMenu" && config.contextMenu) {
      if (current?.contextMenu) {
        setShow(undefined);
      } else if (!current) {
        setShow({ contextMenu: config.contextMenu });
      } else {
        setShow(undefined);
        setShow({ contextMenu: config.contextMenu });
      }
    }
  }

  /**
   * Handle click events
   */
  function onClick() {
    // TODO: handle shift+click for mention
    trigger("userCard");
  }

  /**
   * Handle context menu click
   */
  function onContextMenu(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    trigger("contextMenu");
  }

  /**
   * Handle pointer entering
   *
   * Touch is ignored, iOS sends a compatibility mouseenter after a tap
   * that never gets a matching mouseleave, leaving the tooltip stuck open.
   * A pen can hover, but on many screens it only arrives by touching down:
   * a press tooltip waits for the press, so it can't flash open and shut.
   */
  function onPointerEnter(event: PointerEvent) {
    if (event.pointerType === "touch") return;
    if (event.pointerType === "pen" && accessor().tooltip?.press) return;
    trigger("tooltip", true);
  }

  /** The press under way came from a finger or a pen */
  let touching = false;

  function onPointerDown(event: PointerEvent) {
    touching = event.pointerType !== "mouse";
  }

  /** The browser took the press, for a scroll or a drag: no click follows */
  function onPointerCancel() {
    touching = false;
  }

  /**
   * Close a tooltip shown for a press when a press lands elsewhere. A press
   * on the element itself keeps the watch: it may become a drag, with no
   * click to decide what happens.
   */
  function closeOnPressAway(event: Event) {
    if (element.contains(event.target as Node | null)) return;
    document.removeEventListener("pointerdown", closeOnPressAway, true);
    trigger("tooltip", false);
  }

  /**
   * Touch screens have no hover: a press opens the tooltip instead. Enter
   * or Space on a focused control is a click too, with detail 0.
   */
  function onPress(event: MouseEvent) {
    const fromTouch = touching && event.detail !== 0;
    touching = false;
    if (!fromTouch) return;
    trigger("tooltip");
    if (show()?.tooltip) {
      document.addEventListener("pointerdown", closeOnPressAway, true);
    } else {
      document.removeEventListener("pointerdown", closeOnPressAway, true);
    }
  }

  /**
   * Show the tooltip to keyboard users too (only for keyboard focus, so a
   * dialog focusing its first button doesn't pop one open)
   */
  function onFocus() {
    if (!element.matches(":focus-visible")) return;
    trigger("tooltip", true);
    if (accessor().tooltip?.press) {
      document.addEventListener("pointerdown", closeOnPressAway, true);
    }
  }

  /**
   * Handle pointer leaving. A lifted finger or pen counts as leaving: on a
   * tooltip opened by press, the press decides what happens instead.
   * Blur is not a pointer event: it has no pointerType and always closes.
   */
  function onPointerLeave(event: Event) {
    const { pointerType } = event as PointerEvent;
    const lifted = pointerType === "touch" || pointerType === "pen";
    if (lifted && accessor().tooltip?.press) return;
    trigger("tooltip", false);
  }

  createEffect(
    on(
      () => accessor().userCard,
      (userCard) => {
        if (userCard) {
          element.style.cursor = "pointer";
          element.style.userSelect = "none";
          element.addEventListener("click", onClick);

          onCleanup(() => element.removeEventListener("click", onClick));
        }
      },
    ),
  );

  createEffect(
    on(
      () => accessor().tooltip,
      (tooltip) => {
        if (tooltip) {
          applyTooltipName(
            element,
            typeof tooltip.content === "string"
              ? tooltip.content
              : tooltip.aria,
          );

          element.addEventListener("pointerenter", onPointerEnter);
          element.addEventListener("pointerleave", onPointerLeave);
          element.addEventListener("focus", onFocus);
          element.addEventListener("blur", onPointerLeave);
          if (tooltip.press) {
            element.addEventListener("pointerdown", onPointerDown);
            element.addEventListener("pointercancel", onPointerCancel);
            element.addEventListener("click", onPress);
          }

          onCleanup(() => {
            element.removeEventListener("pointerdown", onPointerDown);
            element.removeEventListener("pointercancel", onPointerCancel);
            element.removeEventListener("click", onPress);
            document.removeEventListener("pointerdown", closeOnPressAway, true);
            element.removeEventListener("pointerenter", onPointerEnter);
            element.removeEventListener("pointerleave", onPointerLeave);
            element.removeEventListener("focus", onFocus);
            element.removeEventListener("blur", onPointerLeave);
          });
        }
      },
    ),
  );

  createEffect(
    on(
      () => accessor().contextMenu,
      (contextMenu) => {
        if (contextMenu) {
          const handler = accessor().contextMenuHandler ?? "contextmenu";

          element.addEventListener(handler, onContextMenu);
          onCleanup(() => element.removeEventListener(handler, onContextMenu));
          const onKeyboardMenu = (event: KeyboardEvent) => {
            if (
              event.key === "ContextMenu" ||
              (event.shiftKey && event.key === "F10")
            )
              onContextMenu(event);
          };
          element.addEventListener("keydown", onKeyboardMenu);
          onCleanup(() =>
            element.removeEventListener("keydown", onKeyboardMenu),
          );

          // iOS Safari never fires contextmenu for touch, so emulate it with a long press
          if (handler === "contextmenu" && isIOSTouch) {
            onCleanup(addLongPressListener(element, onContextMenu));
          }
        }
      },
    ),
  );

  // the element can leave while hovered (a Back button that navigates away
  // gets no pointerleave): close what it showed so nothing stays behind
  onCleanup(() => {
    setShow(undefined);
    unregisterFloatingElement(element);
  });
}
