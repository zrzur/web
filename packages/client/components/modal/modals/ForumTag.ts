import { styled } from "styled-system/jsx";

// Its own file: the forum channel draws it too, and importing it from the
// thread dialog put that dialog and its form library in the app shell.
/** A forum tag that can be switched on and off */
export const Tag = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "32px",
    padding: "4px 12px",
    borderRadius: "var(--z-radius-pill)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-primary)",
    fontSize: "13px",
    cursor: "pointer",
    _hover: { background: "var(--z-slate-1, var(--z-bg-raised))" },
    _focusVisible: {
      outline: "2px solid var(--z-accent)",
      outlineOffset: "2px",
    },
    "&[aria-pressed=true]": {
      background: "var(--z-accent-muted)",
      borderColor: "var(--z-accent)",
    },
    _phone: { minHeight: "44px" },
  },
});
