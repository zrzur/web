import { For, JSX, Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Button, Segmented } from "@revolt/ui";
import { type IconName, Icon } from "@revolt/ui/icons/Icon";

/** A section of a page: a title, one line, and the way to all of it */
export function Shelf(props: {
  id?: string;
  title: JSX.Element;
  /** one line saying what this is */
  hint?: JSX.Element;
  /** "All 16 decorations" */
  more?: { label: JSX.Element; onClick: () => void };
  children: JSX.Element;
}) {
  return (
    <ShelfBase id={props.id}>
      <ShelfHead>
        <div>
          <h2>{props.title}</h2>
          <Show when={props.hint}>
            <p>{props.hint}</p>
          </Show>
        </div>
        <Show when={props.more}>
          {(more) => (
            <button type="button" onClick={() => more().onClick()}>
              {more().label}
              <Icon name="caret-right" size={16} />
            </button>
          )}
        </Show>
      </ShelfHead>
      {props.children}
    </ShelfBase>
  );
}

/**
 * One choice out of a few (filters): the shared segmented control with a
 * count beside each label. Scrolls sideways on a phone.
 */
export function Filters<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
}) {
  return (
    <FilterRow>
      <Segmented
        aria-label={props.label}
        value={props.value}
        onChange={props.onChange}
        options={props.options.map((option) => ({
          value: option.value,
          label: (
            <>
              {option.label}
              <Show when={option.count !== undefined}>
                <small>{option.count}</small>
              </Show>
            </>
          ),
        }))}
      />
    </FilterRow>
  );
}

/**
 * Empty, error and "nothing found": real designs or one icon, one sentence
 * and at most one action
 */
export function Notice(props: {
  icon?: IconName;
  art?: JSX.Element;
  title: JSX.Element;
  children?: JSX.Element;
  action?: {
    label: JSX.Element;
    onClick: () => void;
    filled?: boolean;
    disabled?: boolean;
  };
  role?: "alert" | "status";
}) {
  return (
    <NoticeBase role={props.role}>
      <Show
        when={props.art}
        fallback={
          <Show when={props.icon}>
            {(icon) => <Icon name={icon()} size={32} />}
          </Show>
        }
      >
        <div aria-hidden="true">{props.art}</div>
      </Show>
      <strong>{props.title}</strong>
      <Show when={props.children}>
        <p>{props.children}</p>
      </Show>
      <Show when={props.action}>
        {(action) => (
          <Button
            size="lg"
            variant={action().filled ? "filled" : "tonal"}
            isDisabled={action().disabled}
            onPress={() => action().onClick()}
          >
            {action().label}
          </Button>
        )}
      </Show>
    </NoticeBase>
  );
}

/** The error of every list of designs */
export function LoadError(props: { onRetry?: () => void }) {
  return (
    <Notice
      role="alert"
      icon="warning-circle"
      title={<Trans>Designs couldn't be loaded</Trans>}
      action={
        props.onRetry
          ? { label: <Trans>Try again</Trans>, onClick: props.onRetry }
          : undefined
      }
    >
      <Trans>Check your connection and try again in a moment.</Trans>
    </Notice>
  );
}

/** Placeholders in the shape of what is on its way */
export function Placeholders(props: {
  count: number;
  shape: "card" | "ring" | "plate" | "person";
}) {
  return (
    <Holders aria-busy="true" data-shape={props.shape}>
      <For each={Array.from({ length: props.count })}>
        {(_, i) => (
          <Holder data-first={i() === 0}>
            <i />
            <b />
          </Holder>
        )}
      </For>
    </Holders>
  );
}

const ShelfBase = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    minWidth: 0,
    scrollMarginTop: "80px",
  },
});

const ShelfHead = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "16px",
    "& > div": { minWidth: 0 },
    "& h2": {
      margin: 0,
      fontSize: "22px",
      lineHeight: "30px",
      fontWeight: 700,
      color: "var(--z-fg-primary)",
    },
    "& p": {
      margin: "4px 0 0",
      fontSize: "15px",
      lineHeight: "24px",
      color: "var(--z-fg-secondary)",
    },
    "& button": {
      flexShrink: 0,
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      minHeight: "32px",
      paddingInline: "8px",
      marginInlineEnd: "-8px",
      borderRadius: "var(--z-shape-button, 6px)",
      border: "none",
      background: "none",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "14px",
      fontWeight: 600,
      whiteSpace: "nowrap",
      cursor: "pointer",
      "--z-icon-color": "currentColor",
      transition: "background-color 120ms cubic-bezier(0.2, 0, 0, 1)",
      _hover: { background: "var(--z-designs-button)" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "2px",
      },
      // direction icons turn by themselves in right-to-left (styles.css)
      _phone: { minHeight: "44px" },
    },
    // a phone: the title on its own, the link under it
    _phone: {
      flexDirection: "column",
      alignItems: "flex-start",
      gap: "4px",
      "& button": { marginInlineStart: "-8px" },
    },
  },
});

const FilterRow = styled("div", {
  base: {
    display: "flex",
    maxWidth: "100%",
    minWidth: 0,
    overflowX: "auto",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
    "& small": {
      fontSize: "12px",
      fontWeight: 500,
      color: "var(--z-fg-muted)",
    },
    "& button": { minHeight: "32px", flexShrink: 0 },
    _phone: { "& button": { minHeight: "44px" } },
  },
});

const NoticeBase = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    paddingBlock: "56px",
    paddingInline: "16px",
    textAlign: "center",
    "--z-icon-color": "var(--z-fg-muted)",
    "& strong": {
      fontSize: "18px",
      lineHeight: "26px",
      fontWeight: 700,
      color: "var(--z-fg-primary)",
    },
    "& p": {
      margin: 0,
      maxWidth: "440px",
      fontSize: "15px",
      lineHeight: "24px",
      color: "var(--z-fg-secondary)",
    },
    "& > div[aria-hidden]": { marginBottom: "12px" },
    "& > button": { marginTop: "8px" },
  },
});

const Holders = styled("div", {
  base: {
    display: "grid",
    gap: "16px",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    "&[data-shape='ring']": {
      gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
    },
    "&[data-shape='plate']": {
      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    },
    "& i, & b": {
      display: "block",
      background: "var(--z-designs-surface)",
      animation: "skeletonPulse 1.4s ease-in-out infinite",
      _motionReduce: { animation: "none" },
    },
    "&[data-shape='ring'] i": {
      width: "96px",
      height: "96px",
      marginInline: "auto",
      borderRadius: "50%",
    },
    "&[data-shape='plate'] i": { height: "64px" },
    "&[data-shape='person'] i": { height: "96px" },
    _phone: {
      gridTemplateColumns: "minmax(0, 1fr)",
      "&[data-shape='ring']": {
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      },
    },
  },
});

const Holder = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px",
    borderRadius: "var(--z-shape-card, 14px)",
    border: "1px solid var(--z-designs-edge)",
    "& i": { height: "132px", borderRadius: "var(--z-shape-button, 10px)" },
    "& b": { height: "12px", width: "60%", borderRadius: "6px" },
  },
});
