/* eslint-disable solid/reactivity */
import { useFloating } from "solid-floating-ui";
import {
  For,
  Match,
  Show,
  Suspense,
  Switch,
  createSignal,
  lazy,
  onCleanup,
  onMount,
} from "solid-js";
import { Portal } from "solid-js/web";
import { Motion } from "solid-motionone";

import { autoUpdate, flip, offset, shift } from "@floating-ui/dom";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { Keybind, KeybindAction } from "@revolt/keybinds";
import { MotionPresence, useMotion } from "@revolt/ui/motion";

import Breakpoint from "../../../common/Breakpoint";

import { FloatingElement, floatingElements } from "../../directives";

import { dismissFloatingElements } from ".";
import { takesEscape } from "./takesEscape";
import { TooltipBase } from "./Tooltip";

// profile cards and the autocomplete load the first time they open
const UserCard = lazy(() =>
  import("./UserCard").then((m) => ({ default: m.UserCard })),
);
const AutoComplete = lazy(() =>
  import("./AutoComplete").then((m) => ({ default: m.AutoComplete })),
);

/**
 * Render the actual floating elements
 */
export function FloatingManager() {
  let mouseX = 0,
    mouseY = 0;

  /**
   * Keep track of last mouse position at all times
   */
  function onMouseMove({ clientX, clientY }: PointerEvent) {
    mouseX = clientX;
    mouseY = clientY;
  }

  onMount(() => {
    document.addEventListener("pointermove", onMouseMove);
    document.addEventListener("pointerdown", onMouseMove);
  });
  onCleanup(() => {
    document.removeEventListener("pointermove", onMouseMove);
    document.removeEventListener("pointerdown", onMouseMove);
  });

  /**
   * Whether something is open that Esc closes (a hover tooltip is not)
   */
  function anyTakesEscape() {
    return floatingElements().some((el) =>
      takesEscape(el.show() as Record<string, unknown> | undefined),
    );
  }

  return (
    <Portal mount={document.getElementById("floating")!}>
      <For each={floatingElements()}>
        {(element) => (
          <MotionPresence
            when={element.show()}
            area={() => floatingArea(element.show())}
          >
            {(shown) => (
              <Floating
                {...element}
                show={shown}
                mouseX={mouseX}
                mouseY={mouseY}
              />
            )}
          </MotionPresence>
        )}
      </For>

      <Show when={anyTakesEscape()}>
        <Keybind
          keybind={KeybindAction.CLOSE_FLOATING}
          onPressed={dismissFloatingElements}
        />
      </Show>
    </Portal>
  );
}

const phoneQuery = () => window.matchMedia(Breakpoint.phone).matches;

/**
 * Which animation settings a floating element uses. Phone sheets keep their
 * own rise from the bottom edge.
 */
function floatingArea(shown: ReturnType<FloatingElement["show"]>) {
  if (!shown) return;
  if (shown.tooltip) return "tooltips";
  if (shown.contextMenu) return phoneQuery() ? undefined : "contextMenus";
  if (shown.userCard) return phoneQuery() ? undefined : "popouts";
  return "popouts";
}

/**
 * Render a floating element
 */
function Floating(props: FloatingElement & { mouseX: number; mouseY: number }) {
  const [floating, setFloating] = createSignal<HTMLDivElement>();

  /**
   * Figure out placement of the floating element
   */
  const placement = () => {
    const current = props.show();
    if (!current) return;

    if (current.tooltip) {
      return current.tooltip.placement;
    } else if (current.userCard) {
      return "right-start";
    } else if (current.contextMenu) {
      return props.config().contextMenuPlacement ?? "right-start";
    } else if (current.autoComplete) {
      return "top-start";
    }
  };

  /**
   * Determine element to provide
   */
  const element = () => {
    const current = props.show();

    if (current?.contextMenu && !props.config().contextMenuPlacement) {
      // where the click was: the menu stays there when it's placed again
      const x = props.mouseX;
      const y = props.mouseY;
      return {
        /**
         * Determine client rectangle for virtual element
         */
        getBoundingClientRect() {
          return {
            width: 0,
            height: 0,
            x,
            y,
            left: x,
            right: x,
            top: y,
            bottom: y,
          };
        },
      };
    } else {
      return props.element;
    }
  };

  // the content is often not there at the first measure (profile cards load
  // the first time, menus fill in), so a popup is placed again whenever its
  // size changes; that keeps it inside the window
  const position = useFloating(element, floating, {
    placement: placement(),
    strategy: "fixed",
    middleware: [
      offset(5),
      flip({ padding: 8 }),
      shift({ padding: 8, crossAxis: true }),
    ],
    whileElementsMounted: autoUpdate,
  });

  /**
   * Dismiss floating element when clicking elsewhere
   */
  function onMouseDown(e: PointerEvent) {
    if (!e.defaultPrevented) {
      const currentlyShown = props.show();
      if (!currentlyShown?.contextMenu && !currentlyShown?.userCard) return;
      // pressing inside a profile card (its banner, message box...) is not
      // "elsewhere"
      if (
        (currentlyShown.userCard ||
          floating()?.querySelector("[data-persistent-context-menu]")) &&
        floating()?.contains(e.target as Node | null)
      ) {
        return;
      }

      props.hide();
    }
  }

  /**
   * Dismiss menus and cards with Escape
   */
  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    const currentlyShown = props.show();
    if (!currentlyShown?.contextMenu && !currentlyShown?.userCard) return;

    e.stopPropagation();
    props.hide();
    props.element.focus({ preventScroll: true });
  }

  if (props.config().contextMenu || props.config().userCard) {
    onMount(() => {
      document.addEventListener("pointerdown", onMouseDown);
      document.addEventListener("keydown", onKeyDown, true);
    });
    onCleanup(() => {
      document.removeEventListener("pointerdown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown, true);
    });
  }

  /**
   * Always dismiss context menu on click
   */
  function onClick(event: MouseEvent) {
    const currentlyShown = props.show();
    if (!currentlyShown?.contextMenu) return;
    if (
      floating()?.querySelector("[data-persistent-context-menu]") &&
      floating()?.contains(event.target as Node)
    )
      return;

    props.hide();
  }

  if (props.config().contextMenu) {
    onMount(() => document.addEventListener("click", onClick));
    onCleanup(() => document.removeEventListener("click", onClick));
  }

  const content = () => (
    <Suspense>
      <Switch>
        <Match when={props.show()?.tooltip}>
          <TooltipBase>
            {typeof props.show()!.tooltip!.content === "function"
              ? (props.show()!.tooltip!.content as (arg1: object) => void)({})
              : props.show()!.tooltip!.content}
          </TooltipBase>
        </Match>
        <Match when={props.show()?.userCard}>
          <UserCard
            user={props.show()!.userCard!.user}
            member={props.show()!.userCard!.member}
            bot={props.show()!.userCard!.bot}
            onClose={props.hide}
          />
        </Match>
        <Match when={props.show()?.contextMenu}>
          {props.show()!.contextMenu!({})}
        </Match>
        <Match when={props.show()?.autoComplete}>
          <AutoComplete {...props.show()!.autoComplete!} />
        </Match>
      </Switch>
    </Suspense>
  );

  // phones: menus and profile cards rise from the bottom edge as a sheet
  // with large touch rows; tapping the dimmed page closes them
  const phone = phoneQuery();
  const motion = useMotion();
  const sheetSeconds = () =>
    motion.duration(
      props.show()?.userCard ? "popouts" : "contextMenus",
      "enter",
    ) / 1000;
  const sheet = () =>
    phone && !!(props.show()?.contextMenu || props.show()?.userCard);

  const sheetView = () => (
    <Motion
      style={{ position: "fixed", inset: 0, "z-index": "999" }}
      initial={sheetSeconds() ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{
        duration: Math.min(sheetSeconds(), 0.16),
        easing: "ease-out",
      }}
    >
      <SheetScrim />
      {/* the moving box is the fixed one, so the panel can sit on the edge */}
      <Motion
        style={{ position: "fixed", "inset-inline": 0, bottom: 0 }}
        initial={sheetSeconds() ? { y: 60 } : false}
        animate={{ y: 0 }}
        transition={{ duration: sheetSeconds(), easing: [0.2, 0.8, 0.2, 1] }}
      >
        <SheetPanel ref={setFloating}>
          <SheetGrabber aria-hidden="true" />
          {content()}
        </SheetPanel>
      </Motion>
    </Motion>
  );

  return (
    <Show when={sheet()} fallback={floatingView()}>
      {sheetView()}
    </Show>
  );

  function floatingView() {
    return (
      <div
        ref={setFloating}
        // a tooltip is only for reading: the box around it must not catch
        // clicks meant for what is under it (phones: the server menu)
        class={
          props.show()?.tooltip ? css({ pointerEvents: "none" }) : undefined
        }
        style={{
          position: position.strategy,
          top: `${position.y ?? 0}px`,
          left: `${position.x ?? 0}px`,
          "z-index": props.show()?.userCard ? "99" : "999",
        }}
      >
        {content()}
      </div>
    );
  }
}

const SheetScrim = styled("div", {
  base: {
    position: "fixed",
    inset: 0,
    background: "var(--z-scrim, rgba(6, 8, 12, 0.6))",
  },
});

const SheetPanel = styled("div", {
  base: {
    position: "relative",
    maxHeight: "78dvh",
    overflowY: "auto",
    overscrollBehavior: "contain",
    padding: "22px 8px calc(12px + var(--z-safe-bottom))",
    borderRadius: "22px 22px 0 0",
    background: "var(--z-bg-modal, var(--z-bg-raised))",
    borderTop: "1px solid var(--z-border-strong)",
    boxShadow: "0 -18px 48px -12px rgba(0, 0, 0, 0.55)",

    // the menu fills the sheet: no second card inside it
    "& [role='menu']": {
      width: "100%",
      minWidth: 0,
      maxWidth: "none",
      padding: 0,
      border: "none",
      background: "none",
      boxShadow: "none",
      outline: "none !important",
    },
    "& [role='menuitem']": {
      minHeight: "48px",
      paddingInline: "12px",
      fontSize: "16px",
      gap: "14px",
    },
    // profile cards use the sheet's width
    "& > :not([aria-hidden])": { width: "100% !important", maxWidth: "none" },
  },
});

const SheetGrabber = styled("div", {
  base: {
    position: "absolute",
    top: "9px",
    left: "50%",
    translate: "-50% 0",
    width: "40px",
    height: "5px",
    borderRadius: "999px",
    background: "color-mix(in srgb, var(--z-fg-primary) 22%, transparent)",
  },
});
