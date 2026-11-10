import { Show } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import type { Message } from "@zrzur/sdk/solid";
import { cva } from "styled-system/css";

import { useClient } from "@revolt/client";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import {
  clickMessage,
  isMessageSelected,
  isSelecting,
} from "./messageSelection";

/**
 * Moderators' selection mode: the whole message row becomes one checkbox,
 * so a click selects it instead of opening links or menus. Drawn inside
 * the message container (which is `position: relative`).
 */
export function MessageSelectOverlay(props: {
  message: Message;
  /** Off for previews and search results */
  enabled: boolean;
}) {
  const { t } = useLingui();
  const client = useClient();

  const selected = () =>
    isMessageSelected(props.message.channelId, props.message.id);

  /** The channel's loaded messages, oldest first, for Shift-click ranges */
  const orderedIds = () =>
    client()
      .messages.filter((m) => m.channelId === props.message.channelId)
      .map((m) => m.id)
      .sort();

  return (
    <Show when={props.enabled && isSelecting(props.message.channelId)}>
      <button
        type="button"
        role="checkbox"
        aria-checked={selected()}
        aria-label={t`Select message from ${
          props.message.member?.nickname ??
          props.message.author?.displayName ??
          props.message.username ??
          ""
        }`}
        data-message-select={props.message.id}
        class={overlay({ selected: selected() })}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          clickMessage(
            props.message.channelId,
            props.message.id,
            event.shiftKey,
            orderedIds,
          );
        }}
      >
        <span class={box({ selected: selected() })} aria-hidden="true">
          <Show when={selected()}>
            <Symbol size={16}>check</Symbol>
          </Show>
        </span>
      </button>
    </Show>
  );
}

const overlay = cva({
  base: {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    // the box sits in the avatar column (12 + 36 + 12 px), centred on it,
    // so it never covers the name, the time or the text
    paddingBlockStart: "var(--z-space-1)",
    paddingInlineStart: "var(--z-space-5)",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    "@media (hover: hover)": {
      _hover: {
        background: "var(--z-message-hover)",
      },
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },
  },
  variants: {
    selected: {
      true: {
        background: "var(--z-accent-muted)",
        "@media (hover: hover)": {
          _hover: {
            background: "var(--z-accent-muted)",
          },
        },
      },
    },
  },
});

const box = cva({
  base: {
    width: "20px",
    height: "20px",
    display: "grid",
    placeItems: "center",
    borderRadius: "var(--z-radius-xs)",
    border: "2px solid var(--z-border-strong)",
    background: "var(--z-bg-raised)",
    boxShadow: "0 0 0 2px var(--z-bg-chat)",
    color: "var(--z-on-accent)",
  },
  variants: {
    selected: {
      true: {
        background: "var(--z-accent)",
        borderColor: "var(--z-accent)",
      },
    },
  },
});
