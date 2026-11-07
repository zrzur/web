import {
  Accessor,
  JSXElement,
  Setter,
  createContext,
  useContext,
} from "solid-js";

import { styled } from "styled-system/jsx";

interface Props {
  children: JSXElement;
  contained: boolean;
  value: Accessor<string>;
  onValue: Setter<string>;
}

const RailCtx = createContext<{
  value: Accessor<string>;
  onValue: Setter<string>;
}>();

/**
 * Vertical nav rail — Zrzur native (replaces MDUI NavigationRail).
 */
export function NavigationRail(props: Props) {
  return (
    <RailCtx.Provider value={{ value: props.value, onValue: props.onValue }}>
      <Rail
        role="tablist"
        aria-orientation="vertical"
        data-contained={props.contained ? "true" : "false"}
      >
        {props.children}
      </Rail>
    </RailCtx.Provider>
  );
}

const Rail = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    background: "transparent",
    paddingBlock: "8px",
    width: "56px",
    flexShrink: 0,
  },
});

interface ItemProps {
  value: string;
  icon: JSXElement;
  children: JSXElement;
}

/**
 * An item used in the navigation rail
 */
function NavigationRailItem(props: ItemProps) {
  const ctx = useContext(RailCtx);
  const selected = () => ctx?.value() === props.value;

  return (
    <Item
      type="button"
      role="tab"
      aria-selected={selected()}
      data-selected={selected() ? "true" : "false"}
      onClick={() => ctx?.onValue(props.value)}
    >
      <IconSlot>{props.icon}</IconSlot>
      <Label>{props.children}</Label>
    </Item>
  );
}

NavigationRail.Item = NavigationRailItem;

const Item = styled("button", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    width: "48px",
    minHeight: "48px",
    padding: "6px 4px",
    border: "none",
    borderRadius: "10px",
    background: "transparent",
    color: "var(--z-fg-muted)",
    cursor: "pointer",

    _hover: {
      background: "color-mix(in srgb, var(--z-fg-primary) 8%, transparent)",
      color: "var(--z-fg-primary)",
    },

    _focusVisible: {
      outline: "none",
      boxShadow: "var(--z-focus-ring)",
    },

    '&[data-selected="true"]': {
      background: "var(--z-nav-selected)",
      color: "var(--z-fg-primary)",
    },
  },
});

const IconSlot = styled("div", {
  base: {
    display: "inline-flex",
    color: "inherit",
    fill: "currentColor",
  },
});

const Label = styled("span", {
  base: {
    fontSize: "10px",
    lineHeight: "12px",
    fontWeight: 500,
    textAlign: "center",
    maxWidth: "52px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});
