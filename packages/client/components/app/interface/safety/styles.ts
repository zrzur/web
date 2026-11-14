import { styled } from "styled-system/jsx";

/** Shared look for Trust & Safety screens, on the Zrzur theme tokens */

export const Field = styled("label", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    "& > span": {
      fontSize: "12px",
      fontWeight: 700,
      color: "var(--z-fg-secondary)",
    },
    "& textarea, & input, & select": {
      padding: "8px 10px",
      borderRadius: "var(--z-radius, 10px)",
      border: "1px solid var(--z-border-subtle)",
      background: "var(--z-bg-input)",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "14px",
      textAlign: "start",
      unicodeBidi: "plaintext",
      outline: "none",
      _focus: { borderColor: "var(--z-focus)" },
    },
    "& textarea": { resize: "vertical", minHeight: "84px" },
    "& small": { fontSize: "12px", color: "var(--z-fg-muted)" },
  },
});

export const Choices = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    maxHeight: "min(52vh, 420px)",
    overflowY: "auto",
    paddingInlineEnd: "2px",
  },
});

export const Choice = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "100%",
    padding: "10px 12px",
    border: "1px solid var(--z-border-subtle)",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-input)",
    color: "var(--z-fg-primary)",
    font: "inherit",
    textAlign: "start",
    cursor: "pointer",
    "--z-icon-color": "var(--z-fg-muted)",
    "& [data-text]": {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      flex: 1,
      minWidth: 0,
    },
    "& strong": { fontSize: "14px", fontWeight: 650 },
    "& small": { fontSize: "13px", color: "var(--z-fg-muted)" },
    // the arrow points along the reading direction
    "& > svg": { _rtl: { transform: "scaleX(-1)" } },
    _hover: { borderColor: "var(--z-border-strong, var(--z-focus))" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },
    "&[aria-pressed='true']": {
      borderColor: "var(--z-accent)",
      background: "color-mix(in srgb, var(--z-accent) 12%, var(--z-bg-input))",
    },
  },
});

export const TargetCard = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "12px",
    background: "var(--z-bg-input)",
    color: "var(--z-fg-primary)",
    minWidth: 0,
    "& img": {
      width: "36px",
      height: "36px",
      borderRadius: "50%",
      objectFit: "cover",
      flexShrink: 0,
    },
    "& [data-text]": {
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
      gap: "2px",
    },
    "& small": {
      fontSize: "12px",
      fontWeight: 700,
      color: "var(--z-fg-secondary)",
    },
    "& strong, & p": {
      margin: 0,
      lineClamp: 3,
      fontSize: "14px",
      overflowWrap: "anywhere",
    },
  },
});

export const Summary = styled("dl", {
  base: {
    margin: 0,
    display: "grid",
    gridTemplateColumns: "max-content minmax(0, 1fr)",
    gap: "6px 14px",
    fontSize: "14px",
    "& dt": { color: "var(--z-fg-muted)" },
    "& dd": {
      margin: 0,
      color: "var(--z-fg-primary)",
      overflowWrap: "anywhere",
      whiteSpace: "pre-wrap",
    },
  },
});

export const Notice = styled("p", {
  base: {
    margin: 0,
    padding: "10px 12px",
    borderRadius: "10px",
    fontSize: "13px",
    lineHeight: 1.45,
    color: "var(--z-fg-secondary)",
    // a neutral card: raspberry is for actions, not for information
    background: "var(--z-card-bg, var(--z-bg-raised))",
    border: "1px solid var(--z-card-border, var(--z-border-subtle))",
    "&[data-tone='danger']": {
      borderColor: "transparent",
      color: "var(--z-danger, #F27488)",
      background:
        "color-mix(in srgb, var(--z-danger, #F27488) 10%, transparent)",
    },
  },
});

export const ErrorText = styled("p", {
  base: { margin: 0, fontSize: "13px", color: "var(--z-danger, #F27488)" },
});

export const Pill = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    height: "22px",
    paddingInline: "8px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 650,
    whiteSpace: "nowrap",
    color: "var(--z-fg-secondary)",
    background: "var(--z-bg-input)",
    "&[data-tone='danger']": {
      color: "#fff",
      background: "var(--z-danger-strong, #D92D2D)",
    },
    "&[data-tone='warn']": {
      color: "#1b1300",
      background: "#f5b942",
    },
    "&[data-tone='ok']": {
      color: "#04170c",
      background: "var(--z-status-success, #55DCC8)",
    },
    "&[data-tone='accent']": {
      color: "#fff",
      background: "var(--z-accent-gradient)",
    },
  },
});

export const Buttons = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "8px",
    "& button": {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      height: "34px",
      paddingInline: "14px",
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
        outlineOffset: "1px",
      },
    },
    "& button[data-primary]": {
      border: "none",
      color: "#fff",
      background: "var(--z-accent-gradient)",
    },
    "& button[data-danger]": {
      borderColor: "var(--z-danger, #F27488)",
      color: "var(--z-danger, #F27488)",
    },
  },
});

export const Empty = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    padding: "32px 12px",
    textAlign: "center",
    fontSize: "14px",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-status-success, #55DCC8)",
    // the empty / error state sits on the settings panel surface
    borderRadius: "calc(var(--z-radius, 10px) + 4px)",
    border: "1px solid color-mix(in srgb, var(--z-fg-primary) 8%, transparent)",
    background:
      "linear-gradient(180deg, color-mix(in srgb, white 3%, color-mix(in srgb, var(--z-bg-sidebar) 70%, var(--z-bg-chat))), color-mix(in srgb, var(--z-bg-sidebar) 70%, var(--z-bg-chat)))",
    boxShadow:
      "inset 0 1px 0 rgb(255 255 255 / 0.04), 0 8px 24px -16px rgb(0 0 0 / 0.6)",
    // a surface button, same as Button variant="tonal"
    "& button": {
      height: "32px",
      paddingInline: "14px",
      border: "1px solid var(--z-btn-surface-border)",
      borderRadius: "var(--z-radius, 10px)",
      background: "var(--z-btn-surface-bg)",
      boxShadow: "var(--z-btn-surface-lift)",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontWeight: 600,
      cursor: "pointer",
      transition: "background 0.12s ease",
      _hover: { background: "var(--z-btn-surface-hover)" },
      "&:active": { boxShadow: "var(--z-btn-pressed)" },
    },
  },
});

export const Stack = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
  },
});
