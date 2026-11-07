import { JSX, splitProps } from "solid-js";

import { styled } from "styled-system/jsx";

import { typography } from "../design";

/**
 * Base element for the tooltip
 */
export const TooltipBase = styled("div", {
  base: {
    ...typography.raw({
      class: "label",
      size: "small",
    }),

    // compact desktop tooltip on the shared popover surface
    maxWidth: "260px",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: "20px",
    color: "var(--z-fg-primary, white)",
    background: "var(--z-popover-bg)",
    border: "1px solid var(--z-popover-border)",
    boxShadow: "var(--z-popover-lift)",
    pointerEvents: "none",
  },
});

type Props = {
  /**
   * Tooltip trigger area
   */
  children: JSX.Element;
} & (JSX.Directives["floating"] & object)["tooltip"];

/**
 * Tooltip component
 */
export function Tooltip(props: Props) {
  const [local, remote] = splitProps(props, ["children"]);

  return (
    <div use:floating={{ tooltip: remote }}>{local.children}</div>
  );
}
