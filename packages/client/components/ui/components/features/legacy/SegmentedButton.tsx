import type { JSXElement } from "solid-js";
import { createContext, useContext } from "solid-js";

import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

const GroupCtx = createContext<{
  value: string;
  onSelect: (value: string) => void;
}>();

/**
 * @deprecated Prefer Button groups; kept for compatibility, now Zrzur-native.
 */
export function SegmentedButton(props: {
  value: string;
  children: JSXElement;
}) {
  const ctx = useContext(GroupCtx);
  const selected = () => ctx?.value === props.value;

  return (
    <Btn
      type="button"
      class={styles()}
      data-selected={selected() ? "true" : undefined}
      aria-pressed={selected()}
      onClick={() => ctx?.onSelect(props.value)}
    >
      {props.children}
    </Btn>
  );
}

/**
 * @deprecated Prefer Button groups; kept for compatibility, now Zrzur-native.
 */
export function SingleSelectSegmentedButtonGroup(props: {
  onSelect: (e: Event & { currentTarget: HTMLInputElement }) => void;
  children: JSXElement;
  value: string;
  required?: boolean;
}) {
  return (
    <GroupCtx.Provider
      value={{
        value: props.value,
        onSelect: (v) => {
          const fake = {
            currentTarget: { value: v },
          } as Event & { currentTarget: HTMLInputElement };
          props.onSelect(fake);
        },
      }}
    >
      <Group role="group">{props.children}</Group>
    </GroupCtx.Provider>
  );
}

const Group = styled("div", {
  base: {
    display: "inline-flex",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px solid color-mix(in srgb, var(--z-fg-muted) 35%, transparent)",
    overflow: "hidden",
  },
});

const Btn = styled("button", {
  base: {
    border: "none",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: 550,
    cursor: "pointer",

    _hover: {
      background: "color-mix(in srgb, var(--z-fg-primary) 6%, transparent)",
    },

    '&[data-selected="true"]': {
      color: "var(--z-fg-primary)",
      background:
        "color-mix(in srgb, var(--z-accent, #E0195F) 22%, transparent)",
    },
  },
});

const styles = cva({
  base: {
    borderRight:
      "1px solid color-mix(in srgb, var(--z-fg-muted) 28%, transparent)",

    "&:last-child": {
      borderRight: "none",
    },
  },
});
