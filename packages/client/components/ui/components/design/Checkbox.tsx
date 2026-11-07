import type { JSX } from "solid-js";
import { Show, splitProps } from "solid-js";

import { styled } from "styled-system/jsx";

type Props = {
  children?: JSX.Element;
  required?: boolean;
  name?: string;
  checked?: boolean;
  disabled?: boolean;
  indeterminate?: boolean;
  class?: string;
  onChange?: (event: { currentTarget: { checked: boolean } }) => void;
};

/**
 * Native checkbox behavior with the shared compact toggle appearance.
 */
export function Checkbox(props: Props) {
  const [local, rest] = splitProps(props, [
    "children",
    "checked",
    "indeterminate",
    "disabled",
    "class",
    "onChange",
  ]);

  return (
    <Root
      class={local.class}
      data-checked={!!local.checked}
      data-disabled={!!local.disabled}
    >
      <HiddenInput
        type="checkbox"
        checked={local.checked}
        disabled={local.disabled}
        {...rest}
        onChange={(e) =>
          local.onChange?.({
            currentTarget: { checked: e.currentTarget.checked },
          })
        }
      />
      <CheckboxTrack
        aria-hidden="true"
        data-checked={!!(local.checked || local.indeterminate)}
      >
        <span />
      </CheckboxTrack>
      <Show when={local.children}>
        <LabelText>{local.children}</LabelText>
      </Show>
    </Root>
  );
}

const Root = styled("label", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    cursor: "pointer",
    userSelect: "none",
    position: "relative",
    color: "var(--z-fg-primary)",
    "&:has(input:focus-visible)": {
      outline: "2px solid var(--z-accent)",
      outlineOffset: "4px",
      borderRadius: "4px",
    },
    "@media (max-width: 600px)": {
      minWidth: "44px",
      minHeight: "44px",
    },

    "&[data-disabled='true']": {
      opacity: 0.45,
      cursor: "not-allowed",
    },
  },
});

const HiddenInput = styled("input", {
  base: {
    position: "absolute",
    opacity: 0,
    width: "1px",
    height: "1px",
    margin: 0,
    pointerEvents: "none",
  },
});

export const CheckboxTrack = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    // drawn exactly like <Toggle>
    width: "38px",
    height: "22px",
    borderRadius: "999px",
    flexShrink: 0,
    border:
      "1px solid color-mix(in srgb, var(--z-fg-primary) 12%, transparent)",
    background: "var(--z-field-bg, var(--z-bg-input, #2A2C3C))",
    boxShadow: "var(--z-field-shadow, inset 0 1px 1px rgb(0 0 0 / 0.16))",
    transition:
      "background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease",
    "& > span": {
      position: "absolute",
      top: "2px",
      insetInlineStart: "2px",
      width: "16px",
      height: "16px",
      borderRadius: "50%",
      background: "var(--z-fg-secondary, #a5adbd)",
      transition:
        "transform 0.18s var(--z-ease-standard, ease), background-color 0.18s ease",
    },
    "&[data-checked='true'], input:checked + &": {
      background: "var(--z-accent-fill, var(--z-accent, #E0195F))",
      borderColor: "transparent",
      "& > span": {
        transform: "translateX(16px)",
        background: "var(--z-on-accent, #FFFFFF)",
        _rtl: { transform: "translateX(-16px)" },
      },
    },
    "@media (prefers-reduced-motion: reduce)": {
      "&, & > span": { transition: "none" },
    },
  },
});

const LabelText = styled("span", {
  base: {
    fontSize: "14px",
    lineHeight: "18px",
  },
});
