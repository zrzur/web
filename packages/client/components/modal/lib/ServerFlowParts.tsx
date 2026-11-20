import { Icon } from "@revolt/ui/icons/Icon";
import { styled } from "styled-system/jsx";
import { type ServerFlowArtName, ServerFlowArt } from "./ServerFlowArt";

/**
 * The pieces the server dialogs share: the rows to pick from, the picture
 * and rules of a new server, progress and failure. One look for creating a
 * server from scratch, from a ready-made start, or from a copied setup.
 */
export function Row(props: {
  art: ServerFlowArtName;
  choice: string;
  label: string;
  onPick: () => void;
}) {
  return (
    <Choice
      type="button"
      data-flow-row
      data-flow-choice={props.choice}
      onClick={() => props.onPick()}
    >
      <ServerFlowArt name={props.art} />
      <span>{props.label}</span>
      <Icon name="caret-right" size={16} />
    </Choice>
  );
}

export const SectionTitle = styled("h3", {
  base: {
    margin: "16px 0 8px",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
  },
});
export const Rows = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "8px" },
});
export const Choice = styled("button", {
  base: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "48px",
    padding: "8px 12px",
    border: "1px solid var(--z-border-subtle)",
    borderRadius: "10px",
    background: "var(--z-bg-sidebar)",
    color: "var(--z-fg-primary)",
    fontFamily: "inherit",
    fontSize: "15px",
    fontWeight: 600,
    textAlign: "start",
    cursor: "pointer",
    "--z-icon-color": "var(--z-icon-muted)",
    transition: "background-color 0.12s ease, border-color 0.12s ease",
    "& > span:not(.z-icon)": { flex: 1, minWidth: 0 },
    // direction icons turn by themselves in right-to-left (styles.css)
    "& > .z-icon": { flexShrink: 0 },
    _hover: {
      background: "var(--z-nav-hover)",
      borderColor: "var(--z-accent)",
    },
    "&:active": { background: "var(--z-nav-selected)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _motionReduce: { transition: "none" },
    _phone: { minHeight: "52px" },
  },
});
export const IconPicker = styled("div", {
  base: {
    position: "relative",
    alignSelf: "center",
    minHeight: "80px",
  },
});
export const PlusBadge = styled("span", {
  base: {
    position: "absolute",
    insetBlockStart: 0,
    insetInlineStart: "56px",
    width: "24px",
    height: "24px",
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: "var(--z-accent)",
    color: "var(--z-on-accent)",
    "--z-icon-color": "currentColor",
    pointerEvents: "none",
  },
});
export const Rules = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    cursor: "pointer",
    "& a": { color: "var(--z-link)", textDecoration: "underline" },
    "& button": { flexShrink: 0 },
    _phone: { minHeight: "44px" },
  },
});
export const Progress = styled("div", {
  base: { fontSize: "13px", color: "var(--z-fg-secondary)" },
});
export const Failure = styled("div", {
  base: {
    padding: "12px",
    borderRadius: "var(--z-box-radius)",
    background: "var(--z-box-bg)",
    color: "var(--z-status-error)",
    fontSize: "13px",
    "& p": { margin: "8px 0", color: "var(--z-fg-secondary)" },
    border: "var(--z-box-border)",
  },
});
