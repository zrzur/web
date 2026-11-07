import { JSXElement } from "solid-js";

import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

/**
 * Lists — Zrzur native (replaces MDUI list).
 */
export function List(props: { children: JSXElement }) {
  return <Root role="list">{props.children}</Root>;
}

const Root = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    width: "100%",
  },
});

/**
 * A subheader used in a list
 */
function ListSubheader(props: { children: JSXElement }) {
  return <Subheader class={subheader()}>{props.children}</Subheader>;
}

List.Subheader = ListSubheader;

const Subheader = styled("div", {
  base: {
    padding: "10px 14px 6px",
    fontSize: "11px",
    fontWeight: 650,
    color: "var(--z-fg-muted)",
  },
});

const subheader = cva({
  base: {
    paddingInline: "var(--gap-lg)",
  },
});

/**
 * An item that appears in a list
 */
function ListItem(props: {
  children: JSXElement;
  rounded?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Item
      role="listitem"
      class={listitem()}
      data-rounded={props.rounded ? "true" : "false"}
      disabled={props.disabled}
      onClick={props.onClick}
      type="button"
    >
      {props.children}
    </Item>
  );
}

List.Item = ListItem;

const Item = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "100%",
    minHeight: "40px",
    padding: "8px 12px",
    border: "none",
    borderRadius: "8px",
    background: "transparent",
    color: "var(--z-fg-primary)",
    textAlign: "start",
    cursor: "pointer",

    _hover: {
      background: "color-mix(in srgb, var(--z-fg-primary) 8%, transparent)",
    },

    _disabled: {
      opacity: 0.45,
      cursor: "not-allowed",
    },

    '&[data-rounded="true"]': {
      borderRadius: "var(--z-radius, 10px)",
    },
  },
});

const listitem = cva({
  base: {
    minHeight: 0,
  },
});
