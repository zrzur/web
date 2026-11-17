import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

/**
 * Common styles for sidebar (recipe, for elements that need a directive)
 */
export const sidebarBase = cva({
  base: {
    display: "flex",
    flexShrink: 0,
    flexDirection: "column",
    overflow: "hidden",
    // the panel begins here: rounded where it meets the frame (rail + top
    // bar), hairline on its frame-facing edges
    borderRadius: 0,
    borderStartStartRadius: "var(--z-radius-md, 10px)",
    borderTop: "1px solid var(--z-border-subtle)",
    borderInlineStart: "1px solid var(--z-border-subtle)",
    borderInlineEnd: "1px solid var(--z-border-subtle)",
    width: "var(--z-sidebar-width, var(--layout-width-channel-sidebar))",

    fill: "var(--z-fg-primary, var(--md-sys-color-on-surface))",
    color: "var(--z-fg-primary, var(--md-sys-color-on-surface))",
    // channel list is one step above the rail (surface ladder)
    background: "var(--z-bg-nav, var(--z-bg-sidebar))",

    "& a": {
      textDecoration: "none",
    },

    // phones: the list takes what the rail leaves. Its desktop width (260 px)
    // plus the rail is 332 px: on a 320 px screen the list ran 12 px past
    // the edge and its dates and buttons were cut
    _phone: {
      flexGrow: 1,
      flexShrink: 1,
      width: "auto",
      minWidth: 0,
      // the panel's top edge sits a little under the top of the screen, not
      // on it (owner, 2026-11-17). Its colour stays the rail's: a lighter
      // panel was tried the same day and he preferred it as it was.
      marginBlockStart: "8px",
    },
  },
});

export const SidebarBase = styled("div", sidebarBase);
