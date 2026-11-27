import { Accessor, Show } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { css } from "styled-system/css";
import { decodeTime } from "ulid";

import { useTime } from "@revolt/i18n";
import { iconSize } from "@revolt/ui/components/utils";

import {
  close as MdClose,
  expand_less as MdExpandLess,
} from "@revolt/ui/icons/legacy";

import { floatingIndicator } from "./FloatingIndicator";

interface Props {
  /**
   * The last Id of the message the user read
   */
  lastId: Accessor<string | undefined>;

  /**
   * Jump back to the last message
   */
  jumpBack: () => void;

  /**
   * Dismiss the message
   */
  dismiss: () => void;
}

/**
 * A strip in the accent colour, attached under the channel header: the
 * one thing to act on when a channel opens. Plain: no tint, no glow, no
 * pill (owner, 2026-11-27).
 */
const bar = css({
  padding: "0 !important",
  cursor: "default !important",
  gap: "0 !important",
  overflow: "hidden",
  // flush with the header, square on top, a soft corner below
  marginTop: "calc(-1 * var(--gap-md))",
  minHeight: "30px !important",
  borderRadius: "0 0 8px 8px !important",
  border: "none !important",
  boxShadow: "none !important",
  animation: "none !important",
  background: "var(--z-accent-fill, var(--z-accent)) !important",
  color: "var(--z-on-accent, #FFFFFF) !important",
  fill: "var(--z-on-accent, #FFFFFF) !important",
  "--z-icon-color": "var(--z-on-accent, #FFFFFF)",
  fontWeight: 600,
  "&:hover": {
    background: "var(--z-accent-hover, var(--z-accent-fill)) !important",
  },
  // while the reader is in older messages the bar above the message box
  // already leads to the new ones: one bar at a time, never both
  "main:has([data-jump-to-present]) &": { display: "none !important" },
  _phone: { borderRadius: "0 !important" },
});

const control = {
  appearance: "none",
  font: "inherit",
  color: "inherit",
  background: "transparent",
  border: "none",
  cursor: "default",
  display: "flex",
  alignItems: "center",
  alignSelf: "stretch",
  _focusVisible: {
    outline: "2px solid var(--z-focus, var(--z-accent))",
    outlineOffset: "-2px",
    borderRadius: "10px",
  },
  // pressed: a quiet darkening, as an app's own buttons do
  _active: { opacity: 0.85 },
} as const;

const jump = css({
  ...control,
  position: "relative",
  flexGrow: 1,
  minWidth: 0,
  textAlign: "start",
  paddingBlock: "4px",
  paddingInlineStart: "14px",
  paddingInlineEnd: "12px",
  gap: "12px",
  whiteSpace: "nowrap",
});

/** the words, cut short rather than wrapped onto a second line */
const words = css({
  flexGrow: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
});

/** the action: after a thin divider, in the strip's own ink */
const action = css({
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  paddingInlineStart: "12px",
  borderInlineStart:
    "1px solid color-mix(in srgb, var(--z-on-accent, #FFFFFF) 35%, transparent)",
  "--z-icon-color": "currentColor",
});

const close = css({
  ...control,
  flexShrink: 0,
  justifyContent: "center",
  minWidth: "36px",
  paddingInline: "10px",
  _hover: {
    background:
      "color-mix(in srgb, var(--z-on-accent, #FFFFFF) 14%, transparent)",
  },
  _phone: {
    minWidth: "44px",
    _hover: { background: "transparent" },
  },
});

/**
 * Component indicating to user there were new messages in chat
 */
export function NewMessages(props: Props) {
  const dayjs = useTime();
  const { t } = useLingui();

  return (
    <Show when={props.lastId()}>
      <div
        class={`${floatingIndicator({ position: "top" })} ${bar}`}
        data-new-messages
      >
        <button type="button" class={jump} onClick={() => props.jumpBack()}>
          <span class={words}>
            <Trans>
              New messages since {dayjs(decodeTime(props.lastId()!)).fromNow()}
            </Trans>
          </span>
          <span class={action}>
            <Trans>Jump to the beginning</Trans>
            <MdExpandLess {...iconSize(16)} />
          </span>
        </button>
        <button
          type="button"
          class={close}
          aria-label={t`Dismiss`}
          onClick={() => props.dismiss()}
        >
          <MdClose {...iconSize(16)} />
        </button>
      </div>
    </Show>
  );
}
