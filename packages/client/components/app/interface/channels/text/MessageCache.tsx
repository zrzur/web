import {
  type JSX,
  batch,
  createContext,
  createEffect,
  on,
  onCleanup,
  onMount,
  untrack,
  useContext,
} from "solid-js";

import { Channel, Client, Message } from "@zrzur/sdk/solid";

import { useClientLifecycle } from "@revolt/client";
import { State } from "@revolt/client/Controller";
import { createMessagePruner } from "@revolt/client/messagePruner";

import { createChannelStateCache } from "./channelStateCache";
import type { HistorySnapshot } from "./history/controller";
import { addLive, removeIds, trimForCache } from "./history/window";

/** Channels kept as they were for a quick return */
export const KEPT_CHANNELS = 12;
/** The message cache is left alone while it holds this many or fewer */
export const PRUNE_ABOVE = 1000;
/**
 * How long a message nobody shows any more stays (ms): longer than the
 * five minutes closed panels keep their lists
 */
export const PRUNE_GRACE = 6 * 60_000;
/** How often the message cache is looked through (ms) */
export const PRUNE_EVERY = 60_000;

/** A channel's loaded history and the reader's place in it, while the channel is not open */
type ChannelState = HistorySnapshot<Message>;

/** Rows kept for a channel that is not open */
const CACHED_ROWS = 50;

const CacheContext = createContext<{
  manage(channel: Channel, state: ChannelState): void;
  unmanage(channel: Channel): ChannelState | void;
  /** A message list shows the channel: its messages stay in memory */
  opened(channel: Channel): void;
  /** That message list is gone or shows another channel */
  closed(channel: Channel): void;
  // preload(channel: Channel): void; :: future optimisation feature
}>();

/**
 * Persistent message & channel state cache
 */
export function MessageCache(props: { client: Client; children: JSX.Element }) {
  const lifecycle = useClientLifecycle();
  const cache = createChannelStateCache<ChannelState>(KEPT_CHANNELS);

  // messages nobody shows any more leave the client's cache
  const pruner = createMessagePruner({
    messages: {
      size: () => props.client.messages.size(),
      entries: () => props.client.messages.entries(),
      delete: (id) => props.client.messages.delete(id),
    },
    isKeptChannel: cache.isKept,
    // every message row carries its id (search results and pins too)
    isShown: (id) => document.getElementById(id) !== null,
    limit: PRUNE_ABOVE,
    grace: PRUNE_GRACE,
  });
  onMount(() => {
    const timer = setInterval(
      () => untrack(() => batch(() => pruner.run())),
      PRUNE_EVERY,
    );
    onCleanup(() => clearInterval(timer));
  });

  /**
   * Handle incoming messages
   * @param message Message object
   */
  function onMessage(message: Message) {
    const entry = cache.get(message.channelId);
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
    const entry = cache.get(message.channelId);
    if (entry) entry.window = removeIds(entry.window, [message.id]);
  }

  /**
   * Handle bulk-deleted messages
   */
  function onMessageDeleteBulk(
    messages: { id: string }[],
    channel?: { id: string },
  ) {
    const entry = channel && cache.get(channel.id);
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
          cache.clear();
        }
      },
      { defer: true },
    ),
  );

  return (
    <CacheContext.Provider
      value={{
        manage(channel, state) {
          cache.manage(channel.id, state);
        },
        unmanage(channel) {
          return cache.unmanage(channel.id);
        },
        opened(channel) {
          cache.opened(channel.id);
        },
        closed(channel) {
          cache.closed(channel.id);
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
