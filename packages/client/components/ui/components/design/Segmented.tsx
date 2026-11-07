import { For, JSX } from "solid-js";

import { styled } from "styled-system/jsx";

type Option<T extends string> = {
  value: T;
  label: JSX.Element;
  icon?: JSX.Element;
};

/**
 * Compact single-row choice (radiogroup), sized to its content
 */
export function Segmented<T extends string>(props: {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  let group!: HTMLDivElement;

  function move(delta: number) {
    const index = props.options.findIndex((o) => o.value === props.value);
    const next =
      props.options[
        (index + delta + props.options.length) % props.options.length
      ];
    props.onChange(next.value);
    queueMicrotask(() =>
      (group.querySelector("[aria-checked='true']") as HTMLElement)?.focus(),
    );
  }

  return (
    <Group
      ref={group}
      role="radiogroup"
      aria-label={props["aria-label"]}
      aria-labelledby={props["aria-labelledby"]}
      onKeyDown={(e) => {
        const rtl = getComputedStyle(group).direction === "rtl";
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          move(rtl && e.key === "ArrowRight" ? -1 : 1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          move(rtl && e.key === "ArrowLeft" ? 1 : -1);
        }
      }}
    >
      <For each={props.options}>
        {(option) => (
          <Item
            type="button"
            role="radio"
            aria-checked={option.value === props.value}
            tabIndex={option.value === props.value ? 0 : -1}
            onClick={() => props.onChange(option.value)}
          >
            {option.icon}
            {option.label}
          </Item>
        )}
      </For>
    </Group>
  );
}

const Group = styled("div", {
  base: {
    display: "inline-flex",
    gap: "2px",
    padding: "3px",
    borderRadius: "10px",
    // soft track, same family as text fields
    background: "var(--z-field-bg, var(--z-bg-input, var(--z-bg-app)))",
    border:
      "1px solid var(--z-field-border, color-mix(in srgb, var(--z-fg-primary) 9%, transparent))",
    boxShadow: "var(--z-field-shadow, inset 0 1px 1px rgb(0 0 0 / 0.16))",
  },
});

const Item = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    height: "28px",
    paddingInline: "12px",
    // short labels ("All") still make a full-size target on phones
    _phone: { minWidth: "44px" },
    border: "none",
    borderRadius: "7px",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    fontSize: "13px",
    fontWeight: 500,
    fontFamily: "inherit",
    cursor: "pointer",
    whiteSpace: "nowrap",
    "--z-icon-color": "var(--z-icon-muted)",
    transition: "background-color 0.12s ease, color 0.12s ease",

    "&:hover": {
      color: "var(--z-fg-primary)",
    },
    // the choice is raised out of the track like a button
    "&[aria-checked='true']": {
      color: "var(--z-fg-primary)",
      background: "var(--z-tab-active-bg)",
      boxShadow: "var(--z-tab-active-lift)",
      "--z-icon-color": "var(--z-fg-primary)",
    },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },
  },
});
