import { JSXElement } from "solid-js";

import { cva } from "styled-system/css";

interface Props {
  slot?: string;
  children: JSXElement;
  variant: "small" | "large";
}

/**
 * Count / status badge — Zrzur native (replaces MDUI badge).
 */
export function Badge(props: Props) {
  return (
    <span
      slot={props.slot ?? "badge"}
      class={badge({ variant: props.variant })}
    >
      {props.children}
    </span>
  );
}

const badge = cva({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "18px",
    height: "18px",
    padding: "0 5px",
    borderRadius: "999px",
    background: "var(--z-accent-fill, #E0195F)",
    color: "var(--z-on-accent, #FFFFFF)",
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: 1,
  },
  variants: {
    variant: {
      small: {
        minWidth: "8px",
        height: "8px",
        padding: 0,
      },
      large: {
        minWidth: "18px",
        height: "18px",
      },
    },
  },
});
