import { For } from "solid-js";

import { styled } from "styled-system/jsx";

/**
 * A few views of one thing as plain words in a row; the open one is
 * underlined in the accent colour. No box, no pill: the quiet switch used
 * across panels (threads, Designs). Left and right arrows move between them.
 */
export function LineTabs<T extends string>(props: {
  "aria-label": string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  /** a hairline under the whole row */
  ruled?: boolean;
  class?: string;
}) {
  let row: HTMLDivElement | undefined;

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const index = props.options.findIndex((o) => o.value === props.value);
    // the row reads right to left in Arabic: the arrows follow what is seen
    const rtl = row && getComputedStyle(row).direction === "rtl";
    const forward = (event.key === "ArrowRight") !== !!rtl;
    const count = props.options.length;
    const next = props.options[(index + (forward ? 1 : count - 1)) % count];
    props.onChange(next.value);
    row?.querySelector<HTMLElement>(`[data-tab="${next.value}"]`)?.focus();
  }

  return (
    <Row
      ref={row}
      role="tablist"
      aria-label={props["aria-label"]}
      data-ruled={props.ruled ? "" : undefined}
      class={props.class}
      onKeyDown={onKeyDown}
    >
      <For each={props.options}>
        {(option) => (
          <Tab
            type="button"
            role="tab"
            data-tab={option.value}
            aria-selected={option.value === props.value}
            tabIndex={option.value === props.value ? 0 : -1}
            onClick={() => props.onChange(option.value)}
          >
            {option.label}
          </Tab>
        )}
      </For>
    </Row>
  );
}

const Row = styled("div", {
  base: {
    display: "flex",
    alignItems: "stretch",
    gap: "20px",
    minWidth: 0,
    "&[data-ruled]": {
      borderBottom: "1px solid var(--z-border-soft, var(--z-divider))",
    },
  },
});

const Tab = styled("button", {
  base: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    height: "36px",
    padding: 0,
    border: "none",
    background: "transparent",
    color: "var(--z-fg-muted)",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    cursor: "pointer",
    transition:
      "color var(--z-motion-fast, 120ms) var(--z-ease-standard, ease)",
    _hover: { color: "var(--z-fg-primary)" },
    // the underline sits on the row's own line
    "&::after": {
      content: '""',
      position: "absolute",
      insetInline: 0,
      bottom: "-1px",
      height: "2px",
      borderRadius: "2px 2px 0 0",
      background: "var(--z-accent)",
      transform: "scaleX(0)",
      transition:
        "transform var(--z-motion-fast, 120ms) var(--z-ease-standard, ease)",
    },
    "&[aria-selected='true']": { color: "var(--z-fg-primary)" },
    "&[aria-selected='true']::after": { transform: "scaleX(1)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus, var(--z-accent))",
      outlineOffset: "2px",
      borderRadius: "4px",
    },
    _motionReduce: { transition: "none", "&::after": { transition: "none" } },
    _phone: { height: "44px", fontSize: "15px" },
  },
});
