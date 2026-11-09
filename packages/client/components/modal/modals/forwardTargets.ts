/**
 * Where a message can be forwarded: the conversations and channels this
 * person can write in, searched by name and sorted by recent activity. The
 * server checks every rule again; this only keeps the list honest.
 */

/** The parts of a channel the list reads */
export type TargetLike = {
  id: string;
  type: "SavedMessages" | "DirectMessage" | "Group" | "TextChannel" | string;
  displayName?: string;
  /** Server the channel is in, if any */
  server?: { name: string; mature: boolean };
  /** Direct messages: whether the conversation is open */
  active: boolean;
  isForum: boolean;
  mature: boolean;
  updatedAt: Date;
  /** Whether this person may send a message here */
  canSend: boolean;
};

const KINDS = new Set([
  "SavedMessages",
  "DirectMessage",
  "Group",
  "TextChannel",
]);

/**
 * Whether messages from mature places may go here
 */
export function isMatureTarget(target: Pick<TargetLike, "mature" | "server">) {
  return target.mature || !!target.server?.mature;
}

/**
 * Places to forward to
 * @param channels Every channel the app knows
 * @param query What the person typed in the search field
 * @param sourceMature Whether the message comes from a mature place
 * @param limit How many to show
 */
export function forwardTargets<T extends TargetLike>(
  channels: Iterable<T>,
  query: string,
  sourceMature: boolean,
  limit = 50,
): T[] {
  return forwardChannels(
    channels,
    (channel) => channel,
    query,
    sourceMature,
    limit,
  );
}

/**
 * Places to forward to, returning the items given (the app's own channel
 * objects), so a list keyed by them keeps its rows, focus and scroll when
 * new messages reorder it
 * @param items Every channel the app knows
 * @param view What the list reads of an item
 */
export function forwardChannels<T>(
  items: Iterable<T>,
  view: (item: T) => TargetLike,
  query: string,
  sourceMature: boolean,
  limit = 50,
): T[] {
  const needle = query.trim().toLocaleLowerCase();
  const list: { item: T; updatedAt: number }[] = [];

  for (const item of items) {
    const channel = view(item);
    if (!KINDS.has(channel.type) || !channel.canSend || channel.isForum)
      continue;
    if (channel.type === "DirectMessage" && !channel.active) continue;
    if (sourceMature && !isMatureTarget(channel)) continue;
    if (
      needle &&
      !`${channel.displayName ?? ""}\n${channel.server?.name ?? ""}`
        .toLocaleLowerCase()
        .includes(needle)
    )
      continue;
    list.push({ item, updatedAt: channel.updatedAt.getTime() });
  }

  return list
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map((entry) => entry.item);
}

/**
 * The destination a send goes to: the selected one while it is still in the
 * list; with `firstIfNone` (Enter in the search field) the first result
 */
export function chosenTarget<T extends { id: string }>(
  list: T[],
  selected: string | undefined,
  firstIfNone = false,
): T | undefined {
  return (
    list.find((item) => item.id === selected) ??
    (firstIfNone ? list[0] : undefined)
  );
}

/** The part of the client this reads: the server's root config, once fetched */
type ConfiguredClient =
  | { configuration?: { features?: { forwarding?: boolean } } | undefined }
  | null
  | undefined;

/**
 * Is forwarding on for this server (`features.message_forwarding_enabled`)?
 * Only a clear yes counts: unknown or missing means off.
 */
export function forwardingEnabled(client: ConfiguredClient) {
  return client?.configuration?.features?.forwarding === true;
}

/**
 * Whether this message can be forwarded: a real message with something in
 * it (not a system line) and a person, not a bot, forwarding it
 */
export function canForwardMessage(message: {
  systemMessage?: unknown;
  content?: string;
  attachments?: unknown[];
  embeds?: unknown[];
}) {
  return (
    !message.systemMessage &&
    (!!message.content?.trim() ||
      !!message.attachments?.length ||
      !!message.embeds?.length)
  );
}
