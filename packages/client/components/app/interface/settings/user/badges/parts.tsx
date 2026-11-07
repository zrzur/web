import { styled } from "styled-system/jsx";

/** Shared pieces of the badge pages, in the settings look */

export const Page = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "32px", minWidth: 0 },
});

export const Section = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    minWidth: 0,
    // same section titles as SettingsSection
    "& > h3": {
      margin: 0,
      paddingInline: "2px",
      fontSize: "12px",
      fontWeight: 600,
      color: "var(--z-fg-muted)",
    },
    "& > p": { margin: 0, fontSize: "13px", color: "var(--z-fg-muted)" },
  },
});

export const Grid = styled("ul", {
  base: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 250px), 1fr))",
    gap: "10px",
  },
});

export const Tile = styled("li", {
  base: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    minWidth: 0,
    padding: "12px",
    borderRadius: "calc(var(--z-radius, 10px) + 2px)",
    border: "1px solid var(--z-btn-surface-border)",
    background: "var(--z-card-bg)",
    boxShadow: "var(--z-card-lift)",
    // locked art (BadgeMark) comes back to colour while you read the tile
    "&:hover [data-state='locked']": {
      filter: "grayscale(0.2)",
      opacity: 0.9,
    },
  },
});

export const TileText = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    minWidth: 0,
    flex: 1,
    "& strong": { fontSize: "14px", overflowWrap: "anywhere" },
    "& p": {
      margin: 0,
      fontSize: "13px",
      lineHeight: "17px",
      color: "var(--z-fg-secondary)",
      overflowWrap: "anywhere",
    },
    "& small": { fontSize: "12px", color: "var(--z-fg-muted)" },
  },
});

export const Pill = styled("span", {
  base: {
    alignSelf: "flex-start",
    paddingInline: "8px",
    height: "20px",
    lineHeight: "20px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    background: "var(--z-bg-input)",
    color: "var(--z-fg-secondary)",
    "&[data-tone='accent']": {
      background: "var(--z-accent-muted)",
      color: "var(--z-accent-text, var(--z-accent))",
    },
    // tiers: rare in the accent, top tier in gold
    "&[data-tier='1']": {
      background: "var(--z-accent-muted)",
      color: "var(--z-accent-text, var(--z-accent))",
    },
    "&[data-tier='2']": {
      background: "color-mix(in srgb, #E8B04A 18%, transparent)",
      color: "#F0C46A",
    },
    "&[data-tone='warn']": {
      background: "rgb(245 196 81 / 20%)",
      color: "var(--z-fg-primary)",
    },
    "&[data-tone='danger']": {
      background:
        "color-mix(in srgb, var(--z-danger, #F27488) 18%, transparent)",
      color: "var(--z-danger, #F27488)",
    },
  },
});

export const Card = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "14px",
    borderRadius: "calc(var(--z-radius, 10px) + 2px)",
    border: "1px solid var(--z-btn-surface-border)",
    background: "var(--z-card-bg)",
    boxShadow: "var(--z-card-lift)",
    minWidth: 0,
    "& h4": { margin: 0, fontSize: "14px" },
    "& p": { margin: 0, fontSize: "13px", color: "var(--z-fg-secondary)" },
  },
});

export const Cards = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))",
    gap: "10px",
  },
});

export const Actions = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    "& button": {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      minHeight: "30px",
      paddingInline: "12px",
      border: "1px solid var(--z-border-subtle)",
      borderRadius: "var(--z-radius, 10px)",
      background: "transparent",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "13px",
      fontWeight: 650,
      cursor: "pointer",
      "--z-icon-color": "currentColor",
      _disabled: { opacity: 0.5, cursor: "default" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "2px",
      },
    },
    "& button[data-primary]": {
      border: "none",
      color: "var(--z-on-accent, #fff)",
      background: "var(--z-accent-gradient)",
    },
    "& button[data-danger]": {
      borderColor: "var(--z-danger, #F27488)",
      color: "var(--z-danger, #F27488)",
    },
    "& button[aria-pressed='true']": { borderColor: "var(--z-accent)" },
  },
});

export const Field = styled("label", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    minWidth: 0,
    "& > span": {
      fontSize: "12px",
      fontWeight: 700,
      color: "var(--z-fg-secondary)",
    },
    "& input, & textarea, & select": {
      minHeight: "34px",
      padding: "7px 10px",
      borderRadius: "var(--z-radius, 10px)",
      border: "1px solid var(--z-border-subtle)",
      background: "var(--z-bg-input)",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "14px",
      textAlign: "start",
      unicodeBidi: "plaintext",
      outline: "none",
      // only when focus came from the keyboard or typing: a menu that opens
      // the form does not paint the first field pink
      _focusVisible: { borderColor: "var(--z-focus)" },
    },
    "& textarea": { resize: "vertical", minHeight: "72px" },
  },
});

/** a file picker drawn like the other fields: our button + what was chosen */
export const FilePick = styled("span", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "34px",
    padding: "4px",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-input)",
    cursor: "pointer",
    // it sits where the field label's caps style applies (Field "& > span")
    textTransform: "none",
    letterSpacing: "normal",
    fontWeight: 400,
    // the real input stays focusable for the keyboard, but unseen
    "& input": {
      position: "absolute",
      width: "1px",
      height: "1px",
      opacity: 0,
      pointerEvents: "none",
    },
    "&:focus-within": { borderColor: "var(--z-focus)" },
    "& [data-button]": {
      flexShrink: 0,
      padding: "4px 10px",
      borderRadius: "calc(var(--z-radius, 10px) - 3px)",
      border: "1px solid var(--z-btn-tonal-border, var(--z-border-subtle))",
      background: "var(--z-btn-tonal-bg, var(--z-bg-raised))",
      color: "var(--z-fg-primary)",
      fontSize: "13px",
      fontWeight: 600,
      // set here: the field label's ".field > span" rule wins over the
      // picker's own class
      textTransform: "none",
      letterSpacing: "normal",
    },
    "&:hover [data-button]": {
      background: "var(--z-btn-tonal-hover, var(--z-bg-raised))",
    },
    "& [data-status]": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: "13px",
      fontWeight: 400,
      textTransform: "none",
      letterSpacing: "normal",
      color: "var(--z-fg-muted)",
    },
  },
});

export const Row = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    "& > *": { flex: "1 1 180px" },
  },
});

/** a title with small pills after it */
export const TitleLine = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "6px",
    "& > span": { alignSelf: "center" },
  },
});

/** small second line under a row description (dates) */
export const Meta = styled("span", {
  base: {
    display: "block",
    marginTop: "2px",
    fontSize: "12px",
    color: "var(--z-fg-muted)",
  },
});

export const RowActions = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "6px" },
});

/**
 * The collection: held badges large on one panel, with a quiet glow in the
 * accent and how many of the set you hold
 */
export const Showcase = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    padding: "20px",
    borderRadius: "calc(var(--z-radius, 10px) + 6px)",
    border: "1px solid color-mix(in srgb, var(--z-fg-primary) 8%, transparent)",
    background:
      "radial-gradient(420px 180px at 100% 0%, color-mix(in srgb, var(--z-accent) 16%, transparent), transparent 70%), linear-gradient(180deg, color-mix(in srgb, white 3%, color-mix(in srgb, var(--z-bg-sidebar) 70%, var(--z-bg-chat))), color-mix(in srgb, var(--z-bg-sidebar) 70%, var(--z-bg-chat)))",
    boxShadow:
      "inset 0 1px 0 rgb(255 255 255 / 0.04), 0 8px 24px -16px rgb(0 0 0 / 0.6)",
  },
});

export const ShowcaseHead = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
    "& h3": { margin: 0, fontSize: "16px", fontWeight: 700 },
    "& p": {
      margin: "2px 0 0",
      fontSize: "13px",
      color: "var(--z-fg-muted)",
    },
  },
});

export const Meter = styled("div", {
  base: {
    width: "min(220px, 100%)",
    height: "6px",
    borderRadius: "999px",
    background: "color-mix(in srgb, var(--z-fg-primary) 8%, transparent)",
    overflow: "hidden",
    "& > span": {
      display: "block",
      height: "100%",
      borderRadius: "inherit",
      background: "var(--z-accent-gradient)",
    },
  },
});

export const Shelf = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
});

export const ShelfItem = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    width: "92px",
    padding: "12px 6px 10px",
    borderRadius: "12px",
    textAlign: "center",
    transition: "background-color 0.12s ease",
    _hover: { background: "var(--z-nav-hover)" },
    "& > span": {
      fontSize: "12px",
      fontWeight: 600,
      lineHeight: "15px",
      color: "var(--z-fg-secondary)",
      overflowWrap: "anywhere",
    },
  },
});

export const ShowcaseEmpty = styled("p", {
  base: { margin: 0, fontSize: "14px", color: "var(--z-fg-secondary)" },
});

export const ErrorText = styled("p", {
  base: { margin: 0, fontSize: "13px", color: "var(--z-danger, #F27488)" },
});

export const Empty = styled("p", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    margin: 0,
    padding: "20px 8px",
    textAlign: "center",
    fontSize: "14px",
    color: "var(--z-fg-muted)",
  },
});

export const Search = styled("label", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    height: "38px",
    paddingInline: "12px",
    borderRadius: "999px",
    border: "1px solid var(--z-field-border)",
    background: "var(--z-field-bg)",
    boxShadow: "var(--z-field-shadow)",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "currentColor",
    _focusWithin: {
      borderColor: "var(--z-focus)",
      boxShadow: "var(--z-field-focus-shadow)",
    },
    "& input": {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "14px",
      textAlign: "start",
    },
  },
});

export const List = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    maxHeight: "min(440px, 55dvh)",
    overflowY: "auto",
    padding: "2px",
  },
});

export const Log = styled("ol", {
  base: {
    margin: 0,
    paddingInlineStart: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    fontSize: "13px",
    "& li": { display: "flex", flexWrap: "wrap", gap: "6px" },
    "& time": { color: "var(--z-fg-muted)" },
  },
});
