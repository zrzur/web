import { createEffect, JSX, Show, splitProps } from "solid-js";

import { MdRipple } from "@material/web/ripple/ripple";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useState } from "@revolt/state";
import { SlideState } from "../navigation/SlideDrawer";
import { Ripple } from "./Ripple";
import { Unreads } from "./Unreads";

export type Props = {
  /**
   * Button size
   * @default thin
   */
  readonly size?: "thin" | "normal";

  /**
   * Button attention
   * @default normal
   */
  readonly attention?: "muted" | "normal" | "active" | "selected";

  /**
   * Button icon
   */
  readonly icon?: JSX.Element;

  /**
   * Button content
   */
  readonly children?: JSX.Element;

  /**
   * Alert indicator
   */
  readonly alert?: number | boolean;

  /**
   * Hover actions
   */
  readonly actions?: JSX.Element;

  readonly noDrawer?: boolean;
};

/**
 * Button intended for sidebar contexts
 */
export function MenuButton(
  props: Props &
    JSX.HTMLAttributes<HTMLAnchorElement> &
    JSX.HTMLAttributes<HTMLDivElement> & { href?: string },
) {
  const { appDrawer } = useState();
  const [local, other] = splitProps(props, [
    "onClick",
    "noDrawer",
    "attention",
    "size",
    "icon",
    "children",
    "alert",
    "actions",
  ]);
  let ripple: MdRipple | undefined;

  createEffect(() => {
    const sPos = appDrawer()?.state;
    if (sPos === SlideState.SHOWN || sPos === SlideState.HIDDEN)
      //@ts-expect-error private call
      ripple?.endPressAnimation();
  });

  function onClick(e: Event) {
    if (!local.noDrawer) appDrawer()?.setShown(true);
    // @ts-expect-error callable listener
    if (local.onClick) local.onClick(e);
  }

  const cont = (
    <>
      <Ripple ref={ripple} />
      {local.icon}
      <Content>{local.children}</Content>
      <Show when={local.alert}>
        <span class="hover-hide">
          <Unreads
            count={typeof local.alert === "number" ? local.alert : 0}
            size={typeof local.alert === "number" ? "0.85rem" : "0.4rem"}
            unread
          />
        </span>
      </Show>
      {local.actions && (
        <Actions class="hover-show" onClick={(e) => e.stopPropagation()}>
          {local.actions}
        </Actions>
      )}
    </>
  );

  return (
    // TODO: port to panda-css to merge down components
    <Show
      when={other.href}
      fallback={
        <div
          {...other}
          onClick={onClick}
          classList={{
            [base({
              attention: local.attention,
              size: local.size,
            })]: true,
          }}
          // @codegen directives props=other include=floating
        >
          {cont}
        </div>
      }
    >
      <a
        {...other}
        onClick={onClick}
        classList={{
          [base({
            attention: local.attention,
            size: local.size,
          })]: true,
        }}
        // @codegen directives props=other include=floating
      >
        {cont}
      </a>
    </Show>
  );
}

/**
 * Top-level container
 */
const base = cva({
  base: {
    // phones: a full touch row (phone rules)
    _phone: { minHeight: "44px" },
    flexShrink: 0,

    fontWeight: 500,
    fontSize: "15px",
    userSelect: "none",
    cursor: "pointer",

    // for <Ripple />:
    position: "relative",

    display: "flex",
    alignItems: "center",
    margin: "0 8px",
    padding: "0 8px",
    borderRadius: "var(--z-shape-chip, var(--z-radius-sm, 6px))",
    "--z-icon-color": "var(--z-nav-icon)",
    _focusVisible: {
      outline: "2px solid var(--z-accent)",
      outlineOffset: "-2px",
    },

    color: "var(--color)",
    fill: "var(--color)",
    transition: "background-color 120ms ease, color 120ms ease",
    _motionReduce: { transition: "none" },

    "& > svg": {
      alignSelf: "center",
    },

    // swap `.hover-hide` elements w/  `.hover-show` elements on hover
    "&:hover .hover-hide, &:not(:hover) .hover-show": {
      display: "none",
    },
  },
  variants: {
    size: {
      normal: {
        height: "var(--z-row-height, 34px)",
        gap: "8px",
        fontSize: "15px",
      },
      thin: {
        height: "30px",
        gap: "6px",
        fontSize: "13px",

        // implicitly align center since we won't stack anything
        alignItems: "center",
      },
    },
    attention: {
      normal: {
        "--color": "var(--z-fg-secondary, var(--md-sys-color-outline))",
        background: "transparent",
        "&:hover": {
          background: "var(--z-nav-hover)",
          "--color": "var(--z-fg-primary)",
        },
        "&:active": { background: "var(--z-nav-selected)" },
      },
      muted: {
        "--color": "var(--z-fg-muted, var(--md-sys-color-outline-variant))",
        background: "transparent",
        "&:hover": {
          background: "var(--z-nav-hover)",
        },

        "& img": {
          opacity: "0.3",
        },
      },
      active: {
        "--color": "var(--z-fg-primary, var(--md-sys-color-on-surface))",
        background: "transparent",
        "&:hover": {
          background: "var(--z-nav-hover)",
        },
      },
      selected: {
        "--color": "var(--z-fg-primary)",
        background: "var(--z-nav-selected)",
        // a neutral surface, and the small action-colour mark that says "here"
        "--z-icon-color": "var(--z-icon-hover)",
        fontWeight: 600,
        // the ring already marks this row; a bar beside it reads as two outlines
        "&:focus-visible::before": { display: "none" },
        "&::before": {
          content: "''",
          position: "absolute",
          insetInlineStart: 0,
          top: "50%",
          width: "3px",
          height: "16px",
          translate: "0 -50%",
          borderRadius: "999px",
          background: "var(--z-accent)",
        },
      },
    },
  },
  defaultVariants: {
    size: "normal",
    attention: "normal",
  },
});

/**
 * Textual content
 */
const Content = styled("div", {
  base: {
    flexGrow: 1,
    minWidth: 0,
  },
});

/**
 * Right-side actions
 */
const Actions = styled("div", {
  base: {
    alignSelf: "center",

    display: "flex",
    alignItems: "center",
    flexDirection: "row",
    gap: "var(--gap-sm)",
  },
});
