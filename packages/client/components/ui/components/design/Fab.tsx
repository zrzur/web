import type { JSX } from "solid-js";

import { styled } from "styled-system/jsx";

type Props = {
  children?: JSX.Element;
  variant?: string;
  onClick?: () => void;
  class?: string;
};

/**
 * Floating action button — Zrzur native (replaces MDUI fab).
 */
export function Fab(props: Props) {
  return (
    <Root type="button" class={props.class} onClick={props.onClick}>
      {props.children}
    </Root>
  );
}

const Root = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minWidth: "48px",
    height: "48px",
    padding: "0 16px",
    border: "none",
    borderRadius: "var(--z-radius, 12px)",
    background: "var(--z-btn-primary-bg, var(--z-accent-fill, #E0195F))",
    color: "var(--z-on-accent, #FFFFFF)",
    fontWeight: 650,
    fontSize: "14px",
    cursor: "pointer",
    boxShadow: "var(--z-btn-lift), var(--z-shadow-md)",
    transition: "filter 0.12s ease, transform 80ms ease",

    _hover: {
      filter: "brightness(1.06)",
    },
    "&:active": { transform: "translateY(0.5px) scale(0.985)" },
    _motionReduce: { transition: "none", "&:active": { transform: "none" } },

    _focusVisible: {
      outline: "none",
      boxShadow: "var(--z-focus-ring)",
    },
  },
});
