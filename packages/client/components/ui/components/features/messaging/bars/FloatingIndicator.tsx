import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { typography } from "@revolt/ui/components/design";

/**
 * Common styles for the floating indicators
 */
export const floatingIndicator = cva({
  base: {
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

    // a control of the app, not a link on a page: the arrow cursor and no
    // text to select (userSelect above)
    cursor: "default",

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
    transition: "background-color 80ms ease, opacity 80ms ease",
    _hover: { background: "var(--z-float-hover)" },
    // pressed: a quiet darkening, as an app's own buttons do
    _active: { opacity: 0.85 },
    _phone: { minHeight: "44px" },

    // comes in quietly, as an app's own bars do: a short fade, no slide
    animation: "zFadeIn 120ms ease-out both",
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

/**
 * A floating indicator that is not itself a control
 */
export const FloatingIndicator = styled("div", floatingIndicator);
