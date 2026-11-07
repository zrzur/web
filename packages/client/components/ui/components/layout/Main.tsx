import { cva } from "styled-system/css";

/**
 * Styles for the main content of a page
 *
 * This creates a surface on the lowest level with appropriate padding and separation.
 */
export const main = cva({
  base: {
    flexGrow: 1,
    minWidth: 0,
    minHeight: 0,

    display: "flex",
    overflow: "hidden",
    flexDirection: "column",

    paddingInline: "12px",
    margin: 0,
    borderRadius: 0,
    background:
      "var(--z-bg-shell, var(--md-sys-color-surface-container-lowest))",
    // a quiet wash some library themes add; none by default
    backgroundImage: "var(--z-shell-gradient, none)",
    paddingBottom: "env(keyboard-inset-height)",

    _tablet: {
      margin: 0,
      borderRadius: 0,
    },

    _phone: {
      margin: 0,
      borderRadius: 0,
    },
  },
});
