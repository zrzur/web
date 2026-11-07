import { For } from "solid-js";

import { useLingui } from "@lingui/solid/macro";

import { styled } from "styled-system/jsx";

import { Icon, IconName } from "@revolt/ui/icons/Icon";

export const Switch = {
  Override: OverrideSwitch,
};

type State = "allow" | "neutral" | "deny";

interface Props {
  readonly value: State;
  readonly disabled?: boolean;
  readonly onChange: (state: State) => void;
  /** id of the visible label (the permission name) */
  readonly labelledBy?: string;
}

const OPTIONS: { value: State; icon: IconName }[] = [
  { value: "allow", icon: "check" },
  { value: "neutral", icon: "minus" },
  { value: "deny", icon: "x" },
];

/**
 * Three-way permission override: Allow / Default / Deny.
 * A compact segmented control on the field surface; the chosen segment is
 * tinted in its meaning (green, neutral, red).
 */
function OverrideSwitch(props: Props) {
  const { t } = useLingui();
  const label = (state: State) =>
    state === "allow" ? t`Allow` : state === "deny" ? t`Deny` : t`Default`;
  let group!: HTMLDivElement;

  function move(delta: number) {
    const index = OPTIONS.findIndex((o) => o.value === props.value);
    const next = OPTIONS[(index + delta + OPTIONS.length) % OPTIONS.length];
    props.onChange(next.value);
    queueMicrotask(() =>
      (group.querySelector("[aria-checked='true']") as HTMLElement)?.focus(),
    );
  }

  return (
    <Group
      ref={group}
      role="radiogroup"
      aria-labelledby={props.labelledBy}
      aria-disabled={props.disabled}
      onKeyDown={(e) => {
        if (props.disabled) return;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      <For each={OPTIONS}>
        {(option) => (
          <Segment
            type="button"
            role="radio"
            data-kind={option.value}
            aria-checked={props.value === option.value}
            aria-label={label(option.value)}
            title={label(option.value)}
            tabIndex={props.value === option.value ? 0 : -1}
            disabled={props.disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (!props.disabled) props.onChange(option.value);
            }}
          >
            <Icon name={option.icon} size={16} />
          </Segment>
        )}
      </For>
    </Group>
  );
}

const Group = styled("div", {
  base: {
    flexShrink: 0,
    display: "inline-flex",
    gap: "2px",
    padding: "2px",
    borderRadius: "8px",
    background: "var(--z-bg-input)",
    border: "1px solid var(--z-border-strong)",

    "&[aria-disabled='true']": {
      opacity: 0.5,
    },
  },
});

const Segment = styled("button", {
  base: {
    width: "32px",
    height: "28px",
    "@media (max-width: 600px)": {
      width: "44px",
      height: "44px",
    },
    display: "grid",
    placeItems: "center",
    padding: 0,
    border: "none",
    borderRadius: "6px",
    background: "transparent",
    cursor: "pointer",
    "--z-icon-color": "var(--z-icon-muted)",
    transition: "background-color 0.1s ease",

    _hover: { "--z-icon-color": "var(--z-icon-hover)" },
    _disabled: { cursor: "not-allowed" },
    _focusVisible: {
      outline: "none",
      boxShadow: "inset 0 0 0 2px var(--z-focus)",
    },

    "&[data-kind='allow'][aria-checked='true']": {
      background:
        "color-mix(in srgb, var(--z-status-success) 18%, transparent)",
      "--z-icon-color": "var(--z-status-success)",
    },
    "&[data-kind='neutral'][aria-checked='true']": {
      background: "var(--z-nav-selected)",
      "--z-icon-color": "var(--z-fg-primary)",
    },
    "&[data-kind='deny'][aria-checked='true']": {
      background: "var(--z-danger-muted)",
      "--z-icon-color": "var(--z-danger)",
    },
  },
});
