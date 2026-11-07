import { styled } from "styled-system/jsx";

import { typography } from "@revolt/ui/components/design";

/**
 * Common styles for the floating indicators
 */
export const FloatingIndicator = styled("div", {
  base: {
    // for <Ripple />:
    position: "relative",

    display: "flex",
    userSelect: "none",
    alignItems: "center",

    width: "100%",
    minHeight: "36px",
    boxSizing: "border-box",
    gap: "8px",
    paddingBlock: "8px",
    paddingInline: "12px",
    borderRadius: "10px",

    cursor: "pointer",

    ...typography.raw({ size: "small" }),
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 500,

    fill: "var(--z-fg-primary)",
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-icon-neutral)",
    background: "var(--z-popover-bg)",
    border: "1px solid var(--z-popover-border)",
    boxShadow: "var(--z-popover-lift)",
    transition: "background-color 120ms ease",
    _hover: { background: "var(--z-float-hover)" },
    _phone: { minHeight: "44px" },

    animation: "slideIn 200ms cubic-bezier(0.2, 0, 0, 1) forwards",
    _motionReduce: { animation: "none", transition: "none" },
  },
  variants: {
    position: {
      top: {
        "--translateY": "-33px",
      },
      bottom: {
        "--translateY": "33px",
      },
    },
  },
});
