import { styled } from "styled-system/jsx";

/** The day of an event in the icon column of its row */
export const DateMark = styled("span", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    minHeight: "40px",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-input)",
    "& b": {
      fontSize: "16px",
      lineHeight: "18px",
      fontWeight: 700,
      color: "var(--z-fg-primary)",
    },
    "& small": {
      fontSize: "11px",
      lineHeight: "14px",
      color: "var(--z-fg-secondary)",
    },
    "&[data-quiet] b": { color: "var(--z-fg-muted)" },
  },
});
