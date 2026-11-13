import { Show } from "solid-js";

import { Plural, Trans } from "@lingui/solid/macro";
import { css } from "styled-system/css";

import { iconSize } from "@revolt/ui";

import { expand_more as MdExpandMore } from "@revolt/ui/icons/legacy";

import { Ripple } from "../../../../components/design";
import { floatingIndicator } from "./FloatingIndicator";

interface Props {
  /**
   * Jump back to present messages
   */
  onClick: () => void;

  /**
   * Messages that arrived while the reader was reading older ones
   */
  unseen?: number;

  /**
   * The newest messages are being loaded
   */
  loading?: boolean;
}

const bar = css({
  marginBottom: "var(--gap-md)",
  // a real button: the browser's own look off, the shared bar look on
  appearance: "none",
  font: "inherit",
  textAlign: "start",
  _focusVisible: {
    outline: "2px solid var(--z-focus, var(--z-accent))",
    outlineOffset: "2px",
  },
  "&[aria-busy='true']": { cursor: "progress" },
});

const grow = css({ flexGrow: 1, minWidth: 0 });
const action = css({ flexShrink: 0 });

/**
 * The bar above the message box that leads back to the newest message. It
 * shows while the reader is away from it, and says how many messages arrived
 * meanwhile.
 */
export function JumpToBottom(props: Props) {
  return (
    <button
      type="button"
      data-jump-to-present
      class={`${floatingIndicator({ position: "bottom" })} ${bar}`}
      aria-busy={props.loading ? "true" : undefined}
      onClick={() => props.onClick()}
    >
      <Ripple />
      <span class={grow} aria-live="polite">
        <Show
          when={props.unseen}
          fallback={<Trans>Viewing older messages</Trans>}
        >
          <Plural
            value={props.unseen!}
            one="# new message"
            other="# new messages"
          />
        </Show>
      </span>
      <span class={action}>
        <Trans>Jump to present</Trans>
      </span>
      <MdExpandMore {...iconSize(16)} />
    </button>
  );
}
