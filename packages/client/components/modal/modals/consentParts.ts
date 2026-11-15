/**
 * The parts of the add-bot dialog that "Sign in with Zrzur" (the OAuth2
 * consent page) uses too, so both look the same: the two avatars with dots,
 * the name and its mark, the lead line, the panel of what the app gets, and
 * the facts below it.
 */
import { styled } from "styled-system/jsx";

export const Body = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 },
});

export const Pair = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    paddingBlockStart: "8px",
  },
});

export const Dots = styled("div", {
  base: {
    display: "flex",
    gap: "5px",
    "& span": {
      width: "5px",
      height: "5px",
      borderRadius: "50%",
      background: "color-mix(in srgb, var(--z-accent) 70%, transparent)",
    },
    "& span:nth-child(2)": { opacity: 0.7 },
    "& span:nth-child(3)": { opacity: 0.45 },
  },
});

export const Who = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    textAlign: "center",
    minWidth: 0,
  },
});

export const NameLine = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: "8px",
    minWidth: 0,
  },
});

export const BotName = styled("h2", {
  base: {
    margin: 0,
    fontSize: "20px",
    lineHeight: "28px",
    fontWeight: 700,
    color: "var(--z-fg-primary)",
    overflowWrap: "anywhere",
  },
});

export const Lead = styled("p", {
  base: {
    margin: 0,
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    overflowWrap: "anywhere",
  },
});

export const Panel = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    borderRadius: "var(--z-radius-md, 14px)",
    background: "var(--z-bg-nav, var(--z-bg-sidebar))",
    border: "1px solid var(--z-border-subtle)",
    minWidth: 0,
  },
});

export const PanelTitle = styled("div", {
  base: {
    fontSize: "14px",
    fontWeight: 650,
    color: "var(--z-fg-primary)",
  },
});

export const Allow = styled("ul", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: 0,
    padding: 0,
    listStyle: "none",
    "& li": {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      fontSize: "14px",
      color: "var(--z-fg-primary)",
      "--z-icon-color": "var(--z-success, var(--z-accent))",
    },
  },
});

export const Divider = styled("hr", {
  base: {
    width: "100%",
    margin: "4px 0",
    border: "none",
    borderTop: "1px solid var(--z-border-subtle)",
  },
});

export const Hint = styled("p", {
  base: {
    margin: 0,
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-muted)",
  },
});

export const Facts = styled("ul", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: 0,
    padding: 0,
    listStyle: "none",
    "& li": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "12px",
      lineHeight: "16px",
      color: "var(--z-fg-muted)",
      "--z-icon-color": "var(--z-fg-muted)",
    },
  },
});
