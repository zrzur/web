import { For, JSX, Show, createEffect, createSignal } from "solid-js";

import { styled } from "styled-system/jsx";

import { Column } from "@revolt/ui";

/**
 * Related settings on one page: text tabs under the page title pick the
 * part shown. `initial` follows the page id, so links to a part
 * (e.g. "reports") open it.
 */
export function SettingsTabs<T extends string>(props: {
  initial: T;
  label: string;
  tabs: { id: T; label: JSX.Element; render: () => JSX.Element }[];
}) {
  const [tab, setTab] = createSignal<T>(props.initial);
  // a link to another part while the page is open switches to it
  createEffect(() => {
    const value = props.initial;
    setTab(() => value);
  });

  return (
    <Column gap="lg">
      <TextTabs
        label={props.label}
        value={tab()}
        onChange={(id) => setTab(() => id)}
        tabs={props.tabs}
      />
      <For each={props.tabs}>
        {(item) => (
          <Show when={tab() === item.id}>
            <div role="tabpanel">{item.render()}</div>
          </Show>
        )}
      </For>
    </Column>
  );
}

/**
 * The tab bar of Settings on its own: plain text tabs on a hairline, the
 * chosen one underlined in the accent. Arrow keys move between them
 * (mirrored right to left). Every switch between parts of one place uses
 * it, so they all look the same (the mentions box, 2026-11-19).
 */
export function TextTabs<T extends string>(props: {
  label: string;
  value: T;
  onChange: (id: T) => void;
  tabs: { id: T; label: JSX.Element }[];
}) {
  let bar!: HTMLDivElement;
  function move(delta: number) {
    const index = props.tabs.findIndex((item) => item.id === props.value);
    const next =
      props.tabs[(index + delta + props.tabs.length) % props.tabs.length];
    props.onChange(next.id);
    queueMicrotask(() =>
      (bar.querySelector("[aria-selected='true']") as HTMLElement)?.focus(),
    );
  }

  return (
    <Bar
      ref={bar}
      role="tablist"
      aria-label={props.label}
      onKeyDown={(e) => {
        const rtl = getComputedStyle(bar).direction === "rtl";
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          move((e.key === "ArrowRight") !== rtl ? 1 : -1);
        }
      }}
    >
      <For each={props.tabs}>
        {(item) => (
          <Tab
            type="button"
            role="tab"
            data-tab={item.id}
            aria-selected={props.value === item.id}
            tabIndex={props.value === item.id ? 0 : -1}
            onClick={() => props.onChange(item.id)}
          >
            {item.label}
          </Tab>
        )}
      </For>
    </Bar>
  );
}

/** Plain text tabs on a hairline; the chosen one is underlined in the accent */
const Bar = styled("div", {
  base: {
    display: "flex",
    gap: "24px",
    borderBottom: "1px solid var(--z-border-subtle)",
  },
});

const Tab = styled("button", {
  base: {
    paddingBlock: "0 10px",
    paddingInline: 0,
    marginBottom: "-1px",
    border: "none",
    borderBottom: "2px solid transparent",
    background: "none",
    color: "var(--z-fg-muted)",
    font: "inherit",
    fontSize: "15px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "color var(--z-motion-fast, 120ms) ease",
    _hover: { color: "var(--z-fg-primary)" },
    "&[aria-selected='true']": {
      color: "var(--z-fg-primary)",
      borderBottomColor: "var(--z-accent)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "4px",
      borderRadius: "4px",
    },
  },
});
