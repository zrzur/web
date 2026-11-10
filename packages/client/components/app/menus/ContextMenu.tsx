import { useFloating } from "solid-floating-ui";
import {
  Component,
  ComponentProps,
  createSignal,
  JSX,
  Show,
  splitProps,
} from "solid-js";
import { Portal } from "solid-js/web";
import { Motion, Presence } from "solid-motionone";

import { autoUpdate, flip, offset, shift } from "@floating-ui/dom";
import { styled } from "styled-system/jsx";

import { iconSize, symbolSize, Text } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import Breakpoint from "../../common/Breakpoint";

const Base = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    padding: "6px",
    minWidth: "220px",
    maxWidth: "280px",
    overflow: "hidden",
    borderRadius: "12px",
    // the same layered surface as dialogs and buttons: a soft two-shade
    // fill, a light top edge, a fine border and a deep, soft shadow
    border:
      "1px solid var(--z-popover-border, color-mix(in srgb, var(--z-fg-primary) 11%, transparent))",
    background:
      "var(--z-popover-bg, var(--z-bg-raised, var(--md-sys-color-surface-container)))",
    boxShadow:
      "inset 0 1px 0 rgb(255 255 255 / 0.05), 0 18px 40px -12px rgb(0 0 0 / 0.6), 0 2px 6px rgb(0 0 0 / 0.25)",
    color: "var(--z-fg-primary, var(--md-sys-color-on-surface))",
    fill: "var(--z-fg-primary, var(--md-sys-color-on-surface))",
    outline: "none",

    userSelect: "none",
  },
});

/**
 * Move focus between menu items (arrows, Home/End), wrapping around
 */
function onMenuKeyDown(e: KeyboardEvent) {
  const menu = e.currentTarget as HTMLElement;
  const items = [
    ...menu.querySelectorAll<HTMLElement>(
      "[role='menuitem']:not([aria-disabled='true']), input, select",
    ),
  ];
  if (!items.length) return;

  const index = items.indexOf(document.activeElement as HTMLElement);
  let next: number | undefined;
  if (e.key === "ArrowDown") next = (index + 1) % items.length;
  else if (e.key === "ArrowUp")
    next = (index - 1 + items.length) % items.length;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = items.length - 1;

  if (next !== undefined) {
    e.preventDefault();
    items[next].focus();
  }
}

export function ContextMenu(props: ComponentProps<typeof Base>) {
  return (
    <Base
      role="menu"
      tabIndex={-1}
      // take focus on open so arrows and Escape work right away
      ref={(el: HTMLDivElement) =>
        queueMicrotask(() => el.focus({ preventScroll: true }))
      }
      onKeyDown={onMenuKeyDown}
      // prevent context menu closing itself before click event
      onpointerdown={(e) => e.stopImmediatePropagation()}
      {...props}
    />
  );
}

export const ContextMenuDivider = styled("div", {
  base: {
    height: "1px",
    margin: "4px 8px",
    background: "var(--z-float-divider, var(--z-border-subtle))",
  },
});

export const ContextMenuItem = styled("a", {
  base: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    minHeight: "36px",
    padding: "0 8px",
    borderRadius: "6px",
    fontSize: "15px",
    fontWeight: 500,
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "var(--z-icon-muted)",
    // the row answers at once; no fade to wait for
    _phone: { minHeight: "48px", gap: "12px", paddingInline: "12px" },
    _active: { background: "var(--z-float-button-hover)" },

    // fixed icon column keeps every label on one vertical line
    "& > .z-icon:first-child": {
      width: "20px !important",
      justifyContent: "center",
    },

    "&:hover, &:focus-visible": {
      outline: "none",
      color: "var(--z-fg-primary)",
      "--z-icon-color": "var(--z-icon-hover)",
      // one solid step within the floating family (owner palette 2026-11-01)
      background:
        "var(--z-float-hover, color-mix(in srgb, var(--z-fg-primary) 7%, transparent))",
    },
    "&:focus-visible": {
      boxShadow: "inset 0 0 0 1px var(--z-focus)",
    },

    // let the label fill the row, but not <Symbol> icons (also spans)
    "& span:not([aria-hidden='true'])": {
      flexGrow: 1,
    },
  },
  variants: {
    selected: {
      true: {
        color: "var(--z-fg-primary)",
        background: "var(--z-nav-selected)",
      },
      false: {},
    },
    action: {
      true: {
        cursor: "pointer",
      },
    },
    button: {
      true: {
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        "& span": {
          marginTop: "1px",
        },
      },
    },
    _titleCase: {
      true: {},
      false: {},
    },
    destructive: {
      true: {
        fill: "var(--z-danger, var(--md-sys-color-error))",
        color: "var(--z-danger, var(--md-sys-color-error))",
        "--z-icon-color": "var(--z-icon-danger)",
        "&:hover, &:focus-visible": {
          color: "var(--z-danger, var(--md-sys-color-error))",
          "--z-icon-color": "var(--z-icon-danger)",
          background: "color-mix(in srgb, var(--z-danger) 14%, transparent)",
        },
      },
    },
  },
  defaultVariants: {
    _titleCase: true,
    selected: false,
  },
});

type ButtonProps = ComponentProps<typeof ContextMenuItem> & {
  icon?: JSX.Element | Component<JSX.SvgSVGAttributes<SVGSVGElement>>;
  symbol?: JSX.Element | Component<JSX.SvgSVGAttributes<SVGSVGElement>>;
  destructive?: boolean;
  actionIcon?: JSX.Element | Component<JSX.SvgSVGAttributes<SVGSVGElement>>;
  actionSymbol?: JSX.Element | Component<JSX.SvgSVGAttributes<SVGSVGElement>>;
};

export function ContextMenuButton(props: ButtonProps) {
  const [local, remote] = splitProps(props, [
    "icon",
    "symbol",
    "actionIcon",
    "actionSymbol",
    "children",
  ]);

  return (
    <ContextMenuItem
      button
      role="menuitem"
      tabIndex={0}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          (e.currentTarget as HTMLElement).click();
        }
      }}
      {...remote}
    >
      {typeof local.icon === "function"
        ? local.icon?.(iconSize(18))
        : local.icon}
      {typeof local.symbol === "function"
        ? local.symbol(symbolSize(18))
        : local.symbol}
      <Text>{local.children}</Text>
      {typeof local.actionIcon === "function"
        ? local.actionIcon?.(iconSize(16))
        : local.actionIcon}
      {typeof local.actionSymbol === "function"
        ? local.actionSymbol(symbolSize(16))
        : local.actionSymbol}
    </ContextMenuItem>
  );
}

export function ContextMenuSubMenu(
  props: Omit<
    ButtonProps,
    "ref" | "onClick" | "onMouseEnter" | "onMouseLeave"
  > & {
    buttonContent: JSX.Element;
    onClick?: () => void;
  },
) {
  const [anchor, setAnchor] = createSignal<HTMLDivElement>();
  const [ref, setRef] = createSignal<HTMLDivElement>();

  const [show, setShow] = createSignal<"hide" | "show" | boolean>(false);
  const [local, buttonProps] = splitProps(props, [
    "children",
    "buttonContent",
    "onClick",
  ]);

  function isShowing() {
    return show() === true || show() === "show";
  }

  // opens on the reading side (left in Arabic), flips to the other side when
  // there is no room, and always stays inside the window; fixed, so a
  // submenu near the edge never makes the page scroll sideways
  const rtl = () => document.documentElement.dir === "rtl";
  const position = useFloating(anchor, ref, {
    placement: rtl() ? "left-start" : "right-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(5),
      flip({ fallbackPlacements: [rtl() ? "right-start" : "left-start"] }),
      shift({ padding: 8, crossAxis: true }),
    ],
  });
  // the submenu ended up on the left of its button
  const onLeft = () => (position.placement ?? "").startsWith("left");

  // phones show menus as a bottom sheet (FloatingManager, same query): there
  // a submenu opens in place under its row, by tap only; a floating submenu
  // beside the sheet had nowhere to go and the tap closed the whole sheet
  const inSheet =
    typeof window !== "undefined" &&
    !!window.matchMedia?.(Breakpoint.phone).matches;

  if (inSheet) {
    const [open, setOpen] = createSignal(false);
    return (
      <>
        <ContextMenuButton
          aria-haspopup="menu"
          aria-expanded={open()}
          selected={open()}
          actionIcon={
            <Icon name={open() ? "caret-up" : "caret-down"} size={16} />
          }
          onpointerdown={(e) => e.stopImmediatePropagation()}
          onClick={(e) => {
            // the choices come first; the row's shortcut (e.g. mute until
            // turned back on) is one of them
            e.stopImmediatePropagation();
            setOpen(!open());
          }}
          {...buttonProps}
        >
          {local.buttonContent}
        </ContextMenuButton>
        <Show when={open()}>
          <SheetSubMenu role="group">{local.children}</SheetSubMenu>
        </Show>
      </>
    );
  }

  return (
    <>
      <ContextMenuButton
        ref={setAnchor}
        selected={isShowing()}
        aria-haspopup="menu"
        aria-expanded={isShowing()}
        actionIcon={<Icon name="caret-right" size={16} />}
        onpointerdown={(e) => {
          e.stopImmediatePropagation();
        }}
        onClick={(e) => {
          if (local.onClick) {
            local.onClick();
          } else {
            e.stopImmediatePropagation();
            // a click keeps a hover-opened submenu open; a second click closes it
            setShow(show() === "show" ? false : "show");
          }
        }}
        onMouseEnter={() => setShow((show) => (show === "hide" ? show : true))}
        {...buttonProps}
      >
        {local.buttonContent}
      </ContextMenuButton>
      <Portal mount={document.getElementById("floating")!}>
        <Presence>
          <Show when={isShowing()}>
            <Motion
              ref={setRef}
              style={{
                position: position.strategy,
                top: `${position.y ?? 0}px`,
                left: `${position.x ?? 0}px`,
                "z-index": 1000,
              }}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, easing: "ease-out" }}
              onMouseLeave={() =>
                setShow((show) => (show === true ? false : show))
              }
              // stop submenu from closing context menu
              onpointerdown={(e) => e.stopImmediatePropagation()}
            >
              <div
                onClick={(e) => {
                  if (local.onClick) {
                    local.onClick();
                  } else {
                    // prevent submenu trigger from closing context menu
                    e.stopImmediatePropagation();
                    setShow((show) => (show ? "hide" : true));
                  }
                }}
                // float a virtual element to ensure the mouseLeave event covers
                // both the anchor/button we attached to and the newly created context menu
                style={{
                  position: "absolute",
                  top: 0,
                  left: onLeft()
                    ? "100%"
                    : `-${(anchor()?.clientWidth ?? 0) + 5}px`,
                  width: `${(anchor()?.clientWidth ?? 0) + 5}px`,
                  height: `${anchor()?.clientHeight ?? 0}px`,
                  cursor: "pointer",
                }}
              />
              <ContextMenu>{local.children}</ContextMenu>
            </Motion>
          </Show>
        </Presence>
      </Portal>
    </>
  );
}

/** A submenu opened in place in the phone sheet: indented under its row */
const SheetSubMenu = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    marginInlineStart: "var(--z-space-4)",
    paddingInlineStart: "var(--z-space-2)",
    borderInlineStart: "2px solid var(--z-border-subtle)",
  },
});
