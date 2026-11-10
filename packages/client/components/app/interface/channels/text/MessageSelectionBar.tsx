import { Show, onCleanup } from "solid-js";

import { Plural, Trans, useLingui } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Keybind, KeybindAction } from "@revolt/keybinds";
import { useModals } from "@revolt/modal";
import { Button, Text } from "@revolt/ui";

import {
  BULK_DELETE_MAX,
  cancelSelection,
  messageSelection,
  selectAll,
} from "./messageSelection";

/**
 * Shown instead of the message box while a moderator selects messages:
 * how many are selected, delete them, delete recent ones, or stop.
 */
export function MessageSelectionBar(props: { channel: Channel }) {
  const { t } = useLingui();
  const { openModal } = useModals();

  const client = useClient();
  const ids = () => [...(messageSelection()?.ids ?? [])];
  /** The channel's messages loaded in the app */
  const loadedIds = () =>
    client()
      .messages.filter((message) => message.channelId === props.channel.id)
      .map((message) => message.id);

  // leaving the channel ends the selection
  onCleanup(cancelSelection);

  return (
    <Bar
      role="toolbar"
      aria-label={t`Message selection`}
      data-testid="message-selection-bar"
    >
      <Keybind
        keybind={KeybindAction.CANCEL_MESSAGE_SELECTION}
        onPressed={cancelSelection}
      />
      <Summary>
        <Text size="large" aria-live="polite">
          <Plural value={ids().length} one="# selected" other="# selected" />
        </Text>
        <Text class="label" size="small">
          <Show
            when={messageSelection()?.full}
            fallback={
              <Trans>
                Click messages to select them; Shift-click selects a range.
              </Trans>
            }
          >
            <Trans>Up to {BULK_DELETE_MAX} messages at a time.</Trans>
          </Show>
        </Text>
      </Summary>
      <Actions>
        <Button
          variant="text"
          data-testid="select-all-messages"
          onPress={() => selectAll(props.channel.id, loadedIds())}
        >
          <Trans>Select all</Trans>
        </Button>
        <Button
          variant="text"
          onPress={() =>
            openModal({ type: "bulk_delete_messages", channel: props.channel })
          }
        >
          <Trans>Delete recent…</Trans>
        </Button>
        <Button variant="text" onPress={cancelSelection}>
          <Trans>Cancel</Trans>
        </Button>
        <Button
          variant="_error"
          isDisabled={!ids().length}
          onPress={() =>
            openModal({
              type: "bulk_delete_messages",
              channel: props.channel,
              ids: ids(),
            })
          }
        >
          <Trans>Delete</Trans>
        </Button>
      </Actions>
    </Bar>
  );
}

const Bar = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--z-space-3)",
    marginInline: "var(--z-space-4)",
    marginBlockEnd: "var(--z-space-3)",
    padding: "var(--z-space-3)",
    borderRadius: "var(--z-radius-md)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-raised)",
  },
});

const Summary = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--z-space-1)",
    minWidth: 0,
  },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "var(--z-space-2)",
    marginInlineStart: "auto",
  },
});
