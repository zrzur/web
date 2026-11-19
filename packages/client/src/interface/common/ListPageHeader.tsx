import { styled } from "styled-system/jsx";

/**
 * The parts of a list page's header (Friends, Events): the title, a divider,
 * the filter tabs and a compact search, all in the header on desktop; on
 * phones the tabs and the search take their own rows under it
 * (`ListPhoneFilters`).
 */
export const ListTitle = styled("span", {
  base: { fontSize: "16px", fontWeight: 600 },
});

export const ListDivider = styled("span", {
  base: {
    width: "1px",
    height: "20px",
    marginInline: "4px",
    background: "var(--z-border-strong)",
  },
});

export const ListPhoneFilters = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "8px 16px 12px",
    borderBottom: "1px solid var(--z-border-subtle)",
    "& label": {
      // the header hides the search below 700 px; on its own row it fits
      display: "flex",
      width: "100%",
      maxWidth: "none",
      height: "44px",
      marginInlineEnd: 0,
    },
    "& label:focus-within, & label:has(input:not(:placeholder-shown))": {
      width: "100%",
    },
    "& label input": { fontSize: "16px" },
  },
});

export const ListTabs = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    minWidth: 0,
    // narrow screens: the filters scroll sideways instead of running off
    flex: "1 1 auto",
    overflowX: "auto",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
  },
});

export const ListTab = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    height: "30px",
    paddingInline: "12px",
    border: "none",
    borderRadius: "8px",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    fontSize: "14px",
    fontWeight: 500,
    fontFamily: "inherit",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,

    "&:hover": {
      color: "var(--z-fg-primary)",
      background: "var(--z-nav-hover)",
    },
    // the current tab is raised like a button
    "&[aria-selected='true']": {
      color: "var(--z-fg-primary)",
      background: "var(--z-tab-active-bg)",
      boxShadow: "var(--z-tab-active-lift)",
    },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },
    // phones: the tabs are chips; the open one is raised and never framed
    _phone: {
      height: "44px",
      paddingInline: "16px",
      borderRadius: "999px",
      background:
        "var(--z-sheet-group, color-mix(in srgb, var(--z-fg-primary) 5%, transparent))",
      "&[aria-selected='true']": {
        fontWeight: 600,
        background: "var(--z-nav-selected)",
        boxShadow: "none",
      },
    },
  },
});

/** A count on a tab that needs attention (pending requests) */
export const ListCount = styled("span", {
  base: {
    minWidth: "18px",
    height: "16px",
    paddingInline: "5px",
    borderRadius: "8px",
    display: "grid",
    placeItems: "center",
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--z-on-danger, #FFFFFF)",
    background: "var(--z-danger-strong, var(--z-badge))",
  },
});

export const ListSpacer = styled("div", { base: { flexGrow: 1 } });

/** Compact search in the header; grows a little on focus */
export const ListSearch = styled("label", {
  base: {
    flexShrink: 1,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    width: "200px",
    minWidth: "120px",
    height: "34px",
    paddingInline: "10px",
    marginInlineEnd: "8px",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-field-bg)",
    border: "1px solid var(--z-field-border)",
    boxShadow: "var(--z-field-shadow)",
    color: "var(--z-fg-muted)",
    cursor: "text",
    transition:
      "width 0.18s var(--z-ease-standard, ease), border-color 0.15s ease, box-shadow 0.22s ease",
    "--z-icon-color": "currentColor",
    _motionReduce: { transition: "none" },

    _hover: {
      borderColor: "color-mix(in srgb, var(--z-fg-primary) 18%, transparent)",
    },
    "&:focus-within, &:has(input:not(:placeholder-shown))": {
      width: "260px",
    },
    "&:focus-within": {
      borderColor: "var(--z-accent)",
      boxShadow: "var(--z-field-focus-shadow)",
      color: "var(--z-accent)",
    },
    "& input::-webkit-search-cancel-button": { display: "none" },
    "& input": {
      flexGrow: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      color: "var(--z-fg-primary)",
      fontSize: "14px",
      fontFamily: "inherit",
    },
    "& input::placeholder": { color: "var(--z-fg-muted)" },
    "@media (max-width: 699px)": { display: "none" },
  },
});
