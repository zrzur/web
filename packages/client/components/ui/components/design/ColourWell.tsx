import { styled } from "styled-system/jsx";

/**
 * One colour of your own: a swatch in the current colour that opens the
 * system colour picker. The browser's own colour box looks different on
 * every system, so it sits invisible over the swatch; a click on the swatch
 * is a real click on it, and Tab and Enter reach it as well.
 */
export function ColourWell(props: {
  /** What the colour is for, read out and shown as a tooltip */
  label: string;
  /** #rrggbb */
  value: string;
  /** 40 px square (default) or a wide 84 × 56 well */
  size?: "md" | "lg";
  onInput: (colour: string) => void;
}) {
  return (
    <Well
      title={props.label}
      data-size={props.size ?? "md"}
      style={{ "--well-colour": props.value }}
    >
      <input
        type="color"
        aria-label={props.label}
        value={props.value}
        onInput={(event) => props.onInput(event.currentTarget.value)}
      />
    </Well>
  );
}

const Well = styled("label", {
  base: {
    position: "relative",
    display: "block",
    flexShrink: 0,
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    background: "var(--well-colour)",
    border: "1px solid var(--z-border-strong)",
    cursor: "pointer",
    "&[data-size='lg']": { width: "84px", height: "56px" },
    // 44 px target on phones
    _phone: { minWidth: "44px", minHeight: "44px" },
    "&:focus-within": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "& input": {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      margin: 0,
      padding: 0,
      border: "none",
      opacity: 0,
      cursor: "pointer",
    },
  },
});
