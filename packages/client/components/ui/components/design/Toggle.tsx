import { splitProps } from "solid-js";

import { styled } from "styled-system/jsx";

type Props = {
  /**
   * Whether the toggle is on
   */
  checked: boolean;

  /**
   * Called with the next state
   */
  onChange?: (checked: boolean) => void;

  disabled?: boolean;

  /**
   * Accessible name when there is no visible label wired via aria-labelledby
   */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  id?: string;
};

/**
 * On/off switch (role="switch"). The track stays compact; on phones the
 * button around it is a 44 px target, so it works in a row that isn't clickable.
 */
export function Toggle(props: Props) {
  const [local, aria] = splitProps(props, ["checked", "onChange", "disabled"]);

  return (
    <Target
      type="button"
      role="switch"
      aria-checked={local.checked}
      disabled={local.disabled}
      data-checked={local.checked}
      onClick={(e) => {
        // rows may also be clickable; the switch handles its own press
        e.stopPropagation();
        local.onChange?.(!local.checked);
      }}
      {...aria}
    >
      <Track aria-hidden="true" data-checked={local.checked}>
        <Knob />
      </Track>
    </Target>
  );
}

const Target = styled("button", {
  base: {
    position: "relative",
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "38px",
    height: "22px",
    padding: 0,
    border: "none",
    borderRadius: "11px",
    background: "transparent",
    cursor: "pointer",

    "&:focus-visible": {
      outline: "none",
    },
    "&:focus-visible > span": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "&:disabled": {
      cursor: "not-allowed",
    },
    "&:disabled > span": {
      opacity: 0.45,
    },
    "@media (max-width: 600px)": {
      width: "44px",
      height: "44px",
    },
  },
});

const Track = styled("span", {
  base: {
    position: "relative",
    display: "block",
    flexShrink: 0,
    width: "38px",
    height: "22px",
    borderRadius: "11px",
    // off: a recessed track; on: the primary button's two-shade fill
    border:
      "1px solid color-mix(in srgb, var(--z-fg-primary) 12%, transparent)",
    background: "var(--z-field-bg, var(--z-bg-input, var(--z-bg-app)))",
    boxShadow: "var(--z-field-shadow, inset 0 1px 1px rgb(0 0 0 / 0.16))",
    transition:
      "background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease",

    "&[data-checked='true']": {
      background: "var(--z-accent-fill, var(--z-accent))",
      borderColor: "transparent",
    },
    "@media (prefers-reduced-motion: reduce)": {
      "&, & > span": { transition: "none" },
    },
  },
});

const Knob = styled("span", {
  base: {
    position: "absolute",
    top: "2px",
    insetInlineStart: "2px",
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    background: "var(--z-fg-secondary)",
    transition:
      "transform 0.18s var(--z-ease-standard, ease), background-color 0.18s ease",

    "[data-checked='true'] > &": {
      transform: "translateX(16px)",
      background: "linear-gradient(180deg, #FFFFFF, #ECEAF5)",
    },
    "[dir='rtl'] [data-checked='true'] > &": {
      transform: "translateX(-16px)",
    },
  },
});
