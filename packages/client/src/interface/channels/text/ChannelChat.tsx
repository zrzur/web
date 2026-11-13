import { Show, createEffect, createSignal, on, onCleanup } from "solid-js";

import { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { DraftMessages, Messages } from "@revolt/app";
import {
  EphemeralMessages,
  InteractionModal,
  attachInteractions,
} from "@revolt/app/interface/channels/text/interactions";
import { useClient } from "@revolt/client";

import { MessageComposition } from "./Composition";

/**
 * A channel's messages and composer on their own, for places that show a
 * conversation next to something else (the chat of a voice channel). Marks
 * the channel as read while it is open and scrolled to the end.
 */
export function ChannelChat(props: { channel: Channel }) {
  const client = useClient();
  attachInteractions(client());

  const [atEnd, setEnd] = createSignal(true);
  let jumpToBottom: (() => void) | undefined;

  const ack = () => {
    if (props.channel.unread && atEnd() && document.hasFocus())
      props.channel.ack();
  };
  createEffect(on(() => [props.channel.unread, atEnd()], ack));
  window.addEventListener("focus", ack);
  onCleanup(() => window.removeEventListener("focus", ack));

  return (
    <Column>
      <Messages
        channel={props.channel}
        pendingMessages={(pending) => (
          <>
            <DraftMessages
              channel={props.channel}
              tail={pending.tail}
              sentIds={pending.ids}
            />
            <EphemeralMessages
              channelId={props.channel.id}
              serverId={props.channel.serverId}
            />
          </>
        )}
        highlightedMessageId={() => undefined}
        lastReadId={() => undefined}
        clearHighlightedMessage={() => {}}
        jumpToBottomRef={(ref) => (jumpToBottom = ref)}
        atPresent={[atEnd, setEnd]}
      />
      <InteractionModal />
      <Show when={props.channel.havePermission("SendMessage")}>
        <MessageComposition
          channel={props.channel}
          onMessageSend={() => jumpToBottom?.()}
        />
      </Show>
    </Column>
  );
}

const Column = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: 0,
    minWidth: 0,
  },
});
