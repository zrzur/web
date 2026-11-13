import {
  type JSX,
  createContext,
  createEffect,
  on,
  onCleanup,
  onMount,
  useContext,
} from "solid-js";

import { Channel, Client, Message } from "@zrzur/sdk/solid";

import { useClientLifecycle } from "@revolt/client";
import { State } from "@revolt/client/Controller";

import type { HistorySnapshot } from "./history/controller";
import { addLive, removeIds, trimForCache } from "./history/window";

/** A channel's loaded history and the reader's place in it, while the channel is not open */
type ChannelState = HistorySnapshot<Message>;

/** Rows kept for a channel that is not open */
const CACHED_ROWS = 50;

const CacheContext = createContext<{
  manage(channel: Channel, state: ChannelState): void;
  unmanage(channel: Channel): ChannelState | void;
  // preload(channel: Channel): void; :: future optimisation feature
}>();

/**
 * Persistent message & channel state cache
 */
export function MessageCache(props: { client: Client; children: JSX.Element }) {
  const lifecycle = useClientLifecycle();
  const cache: Record<string, ChannelState> = {};

  /**
   * Handle incoming messages
   * @param message Message object
   */
  function onMessage(message: Message) {
    const entry = cache[message.channelId];
    if (entry?.window.atEnd) {
      // cut to the newest rows; a cut window no longer claims to hold the
      // first message of the channel
      entry.window = trimForCache(
        addLive(entry.window, message, { trim: false, limit: CACHED_ROWS }),
        CACHED_ROWS,
      );
    }
  }

  /**
   * Handle deleted messages
   */
  function onMessageDelete(message: { id: string; channelId: string }) {
    const entry = cache[message.channelId];
    if (entry) entry.window = removeIds(entry.window, [message.id]);
  }

  /**
   * Handle bulk-deleted messages
   */
  function onMessageDeleteBulk(
    messages: { id: string }[],
    channel?: { id: string },
  ) {
    const entry = channel && cache[channel.id];
    if (entry) {
      entry.window = removeIds(
        entry.window,
        messages.map((message) => message.id),
      );
    }
  }

  // Add listener for messages
  onMount(() => {
    props.client.addListener("messageCreate", onMessage);
    props.client.addListener("messageDelete", onMessageDelete);
    props.client.addListener("messageDeleteBulk", onMessageDeleteBulk);
  });

  onCleanup(() => {
    props.client.removeListener("messageCreate", onMessage);
    props.client.removeListener("messageDelete", onMessageDelete);
    props.client.removeListener("messageDeleteBulk", onMessageDeleteBulk);
  });

  // Clear cache when we reconnect
  createEffect(
    on(
      () => lifecycle.lifecycle.state(),
      (state) => {
        if (state === State.Connected) {
          for (const key of Object.keys(cache)) {
            delete cache[key];
          }
        }
      },
      { defer: true },
    ),
  );

  return (
    <CacheContext.Provider
      value={{
        manage(channel, state) {
          cache[channel.id] = state;
        },
        unmanage(channel) {
          if (cache[channel.id]) {
            const state = cache[channel.id];
            delete cache[channel.id];
            return state;
          }
        },
      }}
    >
      {props.children}
    </CacheContext.Provider>
  );
}

export function useMessageCache() {
  return useContext(CacheContext);
}
