/**
 * What a channel looked like when the person left it (messages, scroll
 * position), for the channels they left most recently. Going back to one of
 * them shows it as it was; older ones load again from the newest message.
 *
 * It used to keep every channel ever visited, and with them their messages,
 * for as long as the app was open.
 */
export function createChannelStateCache<T>(limit: number) {
  /** channel id → state, least recently left first */
  const states = new Map<string, T>();
  /** channel id → how many message lists show it right now */
  const open = new Map<string, number>();

  return {
    /** Keep the state of a channel that is being left */
    manage(channelId: string, state: T) {
      states.delete(channelId);
      states.set(channelId, state);
      while (states.size > limit) {
        states.delete(states.keys().next().value!);
      }
    },
    /** Take the state of a channel that is being opened */
    unmanage(channelId: string): T | undefined {
      const state = states.get(channelId);
      states.delete(channelId);
      return state;
    },
    get(channelId: string): T | undefined {
      return states.get(channelId);
    },
    /** Replace the state of a channel that is kept; others are ignored */
    set(channelId: string, state: T) {
      if (states.has(channelId)) states.set(channelId, state);
    },
    clear() {
      states.clear();
    },
    /** A message list shows the channel */
    opened(channelId: string) {
      open.set(channelId, (open.get(channelId) ?? 0) + 1);
    },
    /** That message list is gone or shows another channel */
    closed(channelId: string) {
      const count = (open.get(channelId) ?? 0) - 1;
      if (count > 0) open.set(channelId, count);
      else open.delete(channelId);
    },
    /** Whether the channel's messages are still needed */
    isKept(channelId: string): boolean {
      return open.has(channelId) || states.has(channelId);
    },
  };
}
