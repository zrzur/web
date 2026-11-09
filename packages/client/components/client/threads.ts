import { type Accessor, createMemo, createRoot } from "solid-js";

import type { Channel } from "@zrzur/sdk/solid";

type Channels = { values(): Iterable<Channel> };

/**
 * Threads by the channel and message they started from. One index per
 * channel list, built in one pass and rebuilt when a channel or a thread
 * changes. Each message used to search the whole list itself (and watch
 * every channel in it): with 50 messages on screen and hundreds of channels
 * that was tens of thousands of reads per channel switch.
 */
const indexes = new WeakMap<Channels, Accessor<Map<string, Channel>>>();

/** Same keys pointing at the same channels */
function sameThreads(
  a: Map<string, Channel> | undefined,
  b: Map<string, Channel>,
) {
  if (!a || a.size !== b.size) return false;
  for (const [key, channel] of b) if (a.get(key) !== channel) return false;
  return true;
}

function threadIndex(channels: Channels) {
  let index = indexes.get(channels);
  if (!index) {
    // lives as long as the channel list; never disposed on purpose
    index = createRoot(() =>
      createMemo(
        () => {
          const byStarter = new Map<string, Channel>();
          for (const channel of channels.values()) {
            const starter = channel.thread?.starterMessageId;
            const parent = starter && channel.parentId;
            if (!parent) continue;
            const key = `${parent}:${starter}`;
            // the first match wins, as the search it replaces did
            if (!byStarter.has(key)) byStarter.set(key, channel);
          }
          return byStarter;
        },
        undefined,
        {
          // a thread's message count changes often; the messages only need
          // to hear about it when a thread comes, goes or moves
          equals: sameThreads,
        },
      ),
    );
    indexes.set(channels, index);
  }
  return index;
}

/**
 * The thread started from a message of a channel, if one is known
 * @param channels The client's channel list
 * @param channelId Channel the message is in
 * @param messageId Message id
 */
export function findThread(
  channels: Channels,
  channelId: string,
  messageId: string,
): Channel | undefined {
  return threadIndex(channels)().get(`${channelId}:${messageId}`);
}
