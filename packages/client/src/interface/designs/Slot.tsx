import { JSX, Show } from "solid-js";

import { styled } from "styled-system/jsx";

import { type IconName, Icon } from "@revolt/ui/icons/Icon";

/**
 * An open slot: a dashed outline with an icon standing on its own, a title,
 * one line and at most one action. Marks a place still waiting for
 * something (nothing saved yet, your design here, mix your own).
 */
export function Slot(props: {
  icon: IconName;
  title: JSX.Element;
  children: JSX.Element;
  /** one action; filled only where the slot is the page's main thing */
  action?: {
    label: JSX.Element;
    onClick: () => void;
    filled?: boolean;
  };
  /** centred, for a slot that fills an empty page */
  centre?: boolean;
  /** fills its grid cell (as the last card of a row) */
  tile?: boolean;
  /** what goes in the slot, drawn above the title */
  art?: JSX.Element;
}) {
  return (
    <SlotBase data-centre={props.centre} data-tile={props.tile}>
      <Show
        when={props.art}
        fallback={
          <SlotIcon aria-hidden="true">
            <Icon name={props.icon} size={28} />
          </SlotIcon>
        }
      >
        <div aria-hidden="true">{props.art}</div>
      </Show>
      <strong>{props.title}</strong>
      <p>{props.children}</p>
      <Show when={props.action}>
        {(action) => (
          <SlotAction
            type="button"
            data-filled={action().filled}
            onClick={() => action().onClick()}
          >
            {action().label}
            <Show when={!action().filled}>
              <Icon name="arrow-right" size={16} />
            </Show>
          </SlotAction>
        )}
      </Show>
    </SlotBase>
  );
}

const SlotBase = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
    padding: "24px",
    borderRadius: "var(--z-shape-card, 14px)",
    border: "1px dashed var(--z-designs-edge-hover)",
    // see-through, so the Designs atmosphere shows in the open slot
    background: "var(--z-card-bg)",
    color: "var(--z-fg-primary)",
    textAlign: "start",
    "& > strong": { marginTop: "8px", fontSize: "16px", fontWeight: 750 },
    "& > p": {
      margin: 0,
      maxWidth: "460px",
      fontSize: "14px",
      lineHeight: "20px",
      color: "var(--z-fg-secondary)",
    },
    "&[data-centre='true']": {
      alignItems: "center",
      textAlign: "center",
      paddingBlock: "40px",
    },
    "&[data-tile='true']": {
      height: "100%",
      boxSizing: "border-box",
      justifyContent: "center",
      padding: "16px",
      "& > strong": { marginTop: "4px", fontSize: "15px" },
      "& > p": { fontSize: "13px", lineHeight: "18px" },
    },
    _phone: { padding: "16px" },
  },
});

const SlotIcon = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    "--z-icon-color": "var(--z-fg-muted)",
  },
});

const SlotAction = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "40px",
    marginTop: "8px",
    paddingInline: "0",
    border: "none",
    borderRadius: "var(--z-shape-button, 6px)",
    background: "transparent",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    transition: "background-color 0.12s ease, gap 0.15s ease",
    _hover: { gap: "12px" },
    _active: { opacity: 0.85 },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { minHeight: "44px" },
    _motionReduce: { transition: "none", _hover: { gap: "8px" } },
    "&[data-filled='true']": {
      paddingInline: "16px",
      color: "var(--z-designs-on-pink)",
      background: "var(--z-designs-fill)",
      _hover: { gap: "8px", background: "var(--z-designs-pink-hover)" },
      _active: { background: "var(--z-designs-pink-pressed)" },
    },
  },
});
