import type { JSX } from "solid-js";

import { styled } from "styled-system/jsx";

/**
 * Menu item for FloatingSelect / context menus — native, not MDUI.
 */
export function MenuItem(
  props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
    value?: string;
  },
) {
  return (
    <Item
      type="button"
      role="menuitem"
      data-value={props.value}
      value={props.value}
      {...props}
    />
  );
}

const Item = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    minHeight: "40px",
    minWidth: 0,
    flexShrink: 0,
    boxSizing: "border-box",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    lineHeight: "20px",
    gap: "8px",
    padding: "8px 12px",
    border: "none",
    background: "transparent",
    color: "var(--z-fg-primary, #E6E1EE)",
    textAlign: "start",
    fontFamily: "inherit",
    fontSize: "13px",
    cursor: "pointer",
    _disabled: { opacity: 0.45, cursor: "not-allowed" },
    borderRadius: "6px",
    _phone: { minHeight: "48px" },

    _hover: {
      background: "var(--z-nav-hover)",
    },

    _focusVisible: {
      outline: "none",
      boxShadow: "var(--z-focus-ring)",
    },
  },
});
