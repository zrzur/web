import { styled } from "styled-system/jsx";

/**
 * Phone sheet: the most used actions, side by side, at the top
 *
 *   [reply]  [react]  [copy]  [delete]
 */
export const QuickRow = styled("div", {
  base: {
    display: "flex",
    gap: "8px",
  },
});

export const QuickAction = styled("a", {
  base: {
    flex: "1 1 0",
    minWidth: 0,
    minHeight: "64px !important",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    // (!important: the phone sheet sizes every menu row, FloatingManager)
    gap: "6px !important",
    paddingBlock: "8px",
    paddingInline: "2px !important",
    borderRadius: "14px",
    background:
      "var(--z-sheet-group, color-mix(in srgb, var(--z-fg-primary) 5%, transparent))",
    cursor: "pointer",
    // 12 px, medium: "Antworten" fits a quarter of a 320 px screen
    fontSize: "12px !important",
    fontWeight: 500,
    lineHeight: "16px",
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-fg-primary)",
    WebkitTapHighlightColor: "transparent",
    "& > span:last-child": {
      // the sheet gives its rows a larger text; these four are captions
      fontSize: "12px !important",
      fontWeight: "500 !important",
      lineHeight: "16px !important",
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    _active: {
      background: "color-mix(in srgb, var(--z-fg-primary) 10%, transparent)",
    },
    "&:focus-visible": {
      outline: "none",
      boxShadow: "inset 0 0 0 2px var(--z-focus)",
    },
    "&[data-danger]": {
      color: "var(--z-danger)",
      "--z-icon-color": "var(--z-icon-danger, var(--z-danger))",
    },
  },
});
