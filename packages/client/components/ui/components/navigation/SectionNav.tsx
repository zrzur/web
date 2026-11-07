import { styled } from "styled-system/jsx";

/**
 * Left section sidebar for full pages (Discover, Designs): it takes the
 * place of the conversations list while the page is open.
 *
 * [ # Overview      ]  <- the open section is filled, like the Home
 *   o Decorations         sidebar rows
 * Tools
 * [ * Studio        ]  <- an optional primary action
 */
export const SectionNav = styled("nav", {
  base: {
    width: "var(--z-sidebar-width, 248px)",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "12px 8px",
    // clear of the account card that floats over the foot of the menu
    paddingBottom:
      "calc(var(--z-dock-height, 56px) + 2 * var(--z-dock-gap, 8px))",
    overflowY: "auto",
    background: "var(--z-bg-nav, var(--z-bg-sidebar))",
    borderInlineEnd: "1px solid var(--z-border-subtle)",

    "&[data-open='false']": { display: "none" },
    "@media (max-width: 899px)": { display: "none" },
  },
});

export const SectionNavGroup = styled("div", {
  // same rhythm as the Home sidebar rows (34px row + 13px)
  base: { display: "flex", flexDirection: "column", gap: "13px" },
});

export const SectionNavLabel = styled("div", {
  base: {
    padding: "20px 10px 6px",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
  },
});

/**
 * One section, drawn exactly like the Home sidebar rows (Home, Friends,
 * Designs): a plain row, a filled background when it is the open section
 */
export const SectionNavItem = styled("button", {
  base: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    width: "100%",
    height: "var(--z-row-height, 34px)",
    flexShrink: 0,
    padding: "0 10px",
    border: "none",
    borderRadius: "6px",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    font: "inherit",
    fontSize: "15px",
    fontWeight: 500,
    textAlign: "start",
    cursor: "pointer",
    userSelect: "none",
    "--z-icon-color": "var(--z-nav-icon)",
    transition: "background-color 0.12s ease, color 0.12s ease",
    _motionReduce: { transition: "none" },

    _hover: {
      background: "var(--z-nav-hover)",
      color: "var(--z-fg-primary)",
    },
    // a pure :active press (Panda's _active also matches [data-active])
    "&:active": { background: "var(--z-nav-selected)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },

    // the open section
    "&[data-active='true']": {
      color: "var(--z-fg-primary)",
      background: "var(--z-nav-selected)",
      "--z-icon-color": "var(--z-icon-hover)",
    },
    "&[data-active='true']:hover": { background: "var(--z-nav-selected)" },

    // a primary action in the sidebar (e.g. Creator Studio)
    "&[data-primary]": {
      marginTop: "4px",
      height: "36px",
      color: "var(--z-on-accent, #fff)",
      fontWeight: 600,
      background: "var(--z-btn-primary-bg)",
      boxShadow: "var(--z-btn-lift)",
      "--z-icon-color": "currentColor",
      _hover: {
        background: "var(--z-btn-primary-hover)",
        color: "var(--z-on-accent, #fff)",
      },
    },
  },
});

/** Small count at the end of a section row */
export const SectionNavCount = styled("span", {
  base: {
    marginInlineStart: "auto",
    minWidth: "20px",
    height: "20px",
    padding: "0 6px",
    display: "inline-grid",
    placeItems: "center",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 800,
    color: "#fff",
    background: "var(--z-danger-strong, #B85867)",
  },
});
