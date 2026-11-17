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
      style={{
        position: "fixed",
        inset: 0,
        bottom: "var(--z-screen-bottom, 0px)",
        "z-index": "999",
      }}
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
        style={{
          position: "fixed",
          "inset-inline": 0,
          bottom: "var(--z-screen-bottom, 0px)",
        }}
        initial={sheetSeconds() ? { y: 60 } : false}
        animate={{ y: 0 }}
        transition={{ duration: sheetSeconds(), easing: [0.2, 0.8, 0.2, 1] }}
      >
        <SheetPanel
          ref={setFloating}
          data-card={props.show()?.userCard ? "" : undefined}
        >
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
    bottom: "var(--z-screen-bottom, 0px)",
    background: "var(--z-scrim, rgba(6, 8, 12, 0.6))",
  },
});

const SheetPanel = styled("div", {
  base: {
    position: "relative",
    maxHeight: "78dvh",
    overflowY: "auto",
    overscrollBehavior: "contain",
    padding: "24px 16px calc(16px + var(--z-safe-bottom))",
    // No line along the top: a border on one side of a rounded box thins
    // out to nothing round the corners, which reads as a drawing mistake
    // (owner, 2026-11-17). The surface against the dimmed page is the edge.
    borderRadius: "20px 20px 0 0",
    // one step above the page, the surface dialogs' sheets use: it was the
    // page's own colour, so only the line told the sheet from the page
    background: "var(--z-dialog-bg, var(--z-bg-floating, var(--z-bg-raised)))",
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
      minHeight: "50px",
      paddingInline: "16px",
      fontSize: "16px",
      gap: "14px",
    },
    // a row's name is the thing to read: full-strength text, the icon one
    // step quieter (grey text on a grey card looked washed out)
    "& [role='menuitem']:not([data-destructive]):not([data-danger])": {
      color: "var(--z-fg-primary)",
      "--z-icon-color": "var(--z-icon-neutral)",
    },
    // Groups of rows are cards (owner, 2026-11-17): the rows of a group share
    // one surface with a hairline between them, and the divider between two
    // groups is the room between two cards. Written once here, so the
    // message, server, channel and person sheets all look the same.
    "& [role='menu'][tabindex]": {
      gap: 0,
      "& > :is(a, [role='menuitem'])": {
        borderRadius: 0,
        background:
          "var(--z-sheet-group, color-mix(in srgb, var(--z-fg-primary) 5%, transparent))",
      },
      "& > :is(a, [role='menuitem']):active": {
        background: "color-mix(in srgb, var(--z-fg-primary) 10%, transparent)",
      },
      "& > :is(a, [role='menuitem']) + :is(a, [role='menuitem'])": {
        borderTop: "1px solid var(--z-float-divider, var(--z-border-subtle))",
      },
      // the first row of a group, and the last
      "& > :is(a, [role='menuitem']):not(:is(a, [role='menuitem']) + *)": {
        borderStartStartRadius: "14px",
        borderStartEndRadius: "14px",
      },
      "& > :is(a, [role='menuitem']):not(:has(+ :is(a, [role='menuitem'])))": {
        borderEndStartRadius: "14px",
        borderEndEndRadius: "14px",
      },
      "& > [data-menu-divider]": {
        height: "12px",
        margin: 0,
        background: "none",
      },
      "& > [data-menu-divider] + [data-menu-divider], & > [data-menu-divider]:last-child, & > [data-menu-divider]:first-child":
        { display: "none" },
    },
    // profile cards use the sheet's width
    "& > :not([aria-hidden])": { width: "100% !important", maxWidth: "none" },
    // A profile is the sheet itself, not a card inside it: its banner runs
    // to the sheet's edges and takes the sheet's corners, with the handle
    // drawn over it (it sat as a box in a box, 8 px in from every side).
    "&[data-card]": {
      padding: "0 0 var(--z-safe-bottom)",
      overflowX: "hidden",
      "& > :not([aria-hidden])": {
        border: "none !important",
        borderRadius: "0 !important",
        boxShadow: "none !important",
      },
      "& > [aria-hidden]": {
        zIndex: 2,
        background: "rgb(255 255 255 / 0.55)",
      },
    },
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
