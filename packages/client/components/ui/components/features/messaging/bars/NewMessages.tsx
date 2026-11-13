import { Accessor, Show } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { css } from "styled-system/css";
import { decodeTime } from "ulid";

import { useTime } from "@revolt/i18n";
import { Ripple } from "@revolt/ui/components/design";
import { iconSize } from "@revolt/ui/components/utils";

import { close as MdClose } from "@revolt/ui/icons/legacy";

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

/** The bar holds two controls: its own padding moves into them */
const bar = css({
  padding: "0 !important",
  cursor: "default !important",
  gap: "0 !important",
  overflow: "hidden",
});

const control = {
  appearance: "none",
  font: "inherit",
  color: "inherit",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  alignSelf: "stretch",
  _focusVisible: {
    outline: "2px solid var(--z-focus, var(--z-accent))",
    outlineOffset: "-2px",
    borderRadius: "10px",
  },
} as const;

const jump = css({
  ...control,
  // for <Ripple />
  position: "relative",
  flexGrow: 1,
  minWidth: 0,
  gap: "8px",
  textAlign: "start",
  paddingBlock: "8px",
  paddingInlineStart: "12px",
  paddingInlineEnd: "4px",
});

const close = css({
  ...control,
  flexShrink: 0,
  justifyContent: "center",
  minWidth: "36px",
  paddingInline: "10px",
  _hover: { background: "var(--z-float-hover)" },
  _phone: { minWidth: "44px" },
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
          <Ripple />
          <span class={css({ flexGrow: 1, minWidth: 0 })}>
            <Trans>
              New messages since {dayjs(decodeTime(props.lastId()!)).fromNow()}
            </Trans>
          </span>
          <span class={css({ flexShrink: 0 })}>
            <Trans>Jump to the beginning</Trans>
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
