/**
 * Keeps the message cache from growing for as long as the app is open.
 *
 * Every message the app ever fetched stayed in `client.messages`: reading
 * through channels for a few hours left tens of thousands of them (about
 * 7 kB each) in memory. The pruner removes messages nobody can see any
 * more. A message stays while:
 *
 * - its channel is open, or is one of the recently visited channels kept
 *   for a quick return (see MessageCache);
 * - it is on screen anywhere (search results, pins);
 * - another part of the app says it holds it ({@link holdMessages});
 * - it became removable less than the grace time ago. Lists fetched for a
 *   panel or a dialog live in short-lived caches after it closes; the grace
 *   time is longer than those.
 */

/** The part of the SDK's message collection the pruner needs */
export interface PrunableMessages {
  size(): number;
  entries(): Iterable<[string, { channelId: string }]>;
  delete(id: string): void;
}

export interface MessagePrunerOptions {
  messages: PrunableMessages;
  /** Whether the channel is open or kept for a quick return */
  isKeptChannel(channelId: string): boolean;
  /** Whether the message is on screen */
  isShown(messageId: string): boolean;
  /** Nothing is removed while the cache holds this many messages or fewer */
  limit: number;
  /** How long a message must have been removable before it goes (ms) */
  grace: number;
  now?: () => number;
}

const holders = new Set<() => Iterable<string>>();

/**
 * Keep messages in the cache while a list that is not a channel shows them
 * (the mentions panel, for one)
 * @param ids The ids held right now
 * @returns Call to let go
 */
export function holdMessages(ids: () => Iterable<string>): () => void {
  holders.add(ids);
  return () => void holders.delete(ids);
}

export function createMessagePruner(options: MessagePrunerOptions) {
  const now = options.now ?? Date.now;
  /** message id → when it was first seen removable */
  const marked = new Map<string, number>();

  return {
    /**
     * One pass: marks what became removable, removes what has been
     * removable for the grace time
     * @returns How many messages were removed
     */
    run(): number {
      if (options.messages.size() <= options.limit) {
        marked.clear();
        return 0;
      }

      const held = new Set<string>();
      for (const ids of holders) for (const id of ids()) held.add(id);

      const time = now();
      const seen = new Set<string>();
      const remove: string[] = [];
      for (const [id, message] of options.messages.entries()) {
        if (
          options.isKeptChannel(message.channelId) ||
          held.has(id) ||
          options.isShown(id)
        ) {
          marked.delete(id);
          continue;
        }
        seen.add(id);
        const since = marked.get(id);
        if (since === undefined) marked.set(id, time);
        else if (time - since >= options.grace) remove.push(id);
      }

      // marks of messages that left the cache another way
      for (const id of marked.keys()) if (!seen.has(id)) marked.delete(id);

      for (const id of remove) {
        marked.delete(id);
        options.messages.delete(id);
      }
      return remove.length;
    },
  };
}
