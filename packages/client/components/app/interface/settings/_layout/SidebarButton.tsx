import { JSX, splitProps } from "solid-js";
import { styled } from "styled-system/jsx";

import { useState } from "@revolt/state";

/**
 * Sidebar button
 */
export function SidebarButton(
  props: JSX.HTMLAttributes<HTMLAnchorElement> & {
    "aria-selected"?: boolean;
    noDrawer?: boolean;
    /**
     * Selected without the filled box (the entry shows its own selected
     * state, e.g. the account card's avatar ring)
     */
    flat?: boolean;
  },
) {
  const { diagDrawer } = useState();
  const [local, other] = splitProps(props, [
    "onClick",
    "noDrawer",
    "class",
    "flat",
  ]);

  function onClick(e: Event) {
    if (!local.noDrawer) diagDrawer()?.setShown(true);
    // @ts-expect-error callable listener
    if (local.onClick) local.onClick(e);
  }

  return (
    <SidebarButtonBase
      {...other}
      role="link"
      tabIndex={0}
      aria-current={props["aria-selected"] ? "page" : undefined}
      data-flat={local.flat || undefined}
      class={"button" + (local.class ? " " + local.class : "")}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(e);
        }
      }}
    >
      {props.children}
    </SidebarButtonBase>
  );
}

const SidebarButtonBase = styled("a", {
  base: {
    // phones: a full touch row (phone rules)
    _phone: { minHeight: "48px", marginInlineEnd: 0 },
    position: "relative",
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    // same row height as the channel list
    minHeight: "var(--z-row-height, 34px)",
    padding: "0 10px",
    borderRadius: "6px",
    fontWeight: 500,
    marginInlineEnd: "12px",
    fontSize: "15px",
    cursor: "pointer",
    userSelect: "none",
    transition: "background-color 0.1s ease, color 0.1s ease",
    color: "var(--z-fg-secondary, var(--md-sys-color-on-surface))",
    fill: "currentColor",
    background: "unset",
    "--z-icon-color": "var(--z-icon-muted)",

    "& svg": {
      flexShrink: 0,
    },

    _hover: {
      background: "var(--z-nav-hover)",
      color: "var(--z-fg-primary)",
      "--z-icon-color": "var(--z-icon-hover)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },
    // the ring already marks this row; a bar beside it reads as two outlines
    "&[aria-current='page']:focus-visible::before": { display: "none" },
    // the open page stays marked under the pointer (hover used to replace
    // the selected background with its lighter wash)
    "&[aria-current='page']:hover": {
      background: "var(--z-nav-selected)",
    },
    // the open page also has an accent bar and heavier text, so it never
    // looks like a page that is only under the pointer
    "&[aria-current='page']": {
      fontWeight: 600,
    },
    "&[aria-current='page']::before": {
      content: '""',
      position: "absolute",
      insetInlineStart: 0,
      top: "8px",
      bottom: "8px",
      width: "3px",
      borderRadius: "2px",
      background: "var(--z-accent, #E0195F)",
    },
    // attribute + class outranks the selected variant below
    "&[data-flat='true'][aria-current='page']": {
      background: "transparent",
    },
    "&[data-flat='true'][aria-current='page']:hover": {
      background: "var(--z-nav-hover)",
    },
  },
  variants: {
    "aria-selected": {
      true: {
        background: "var(--z-nav-selected)",
        color: "var(--z-fg-primary)",
        "--z-icon-color": "var(--z-icon-active)",
      },
    },
  },
});

export const SidebarButtonTitle = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexGrow: 1,
    minWidth: 0,
    paddingInlineEnd: "8px",
  },
});

export const SidebarButtonContent = styled("div", {
  base: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
});

export const SidebarButtonIcon = styled("div", {
  base: {
    display: "flex",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flexShrink: 0,
    gap: "2px",
  },
});
