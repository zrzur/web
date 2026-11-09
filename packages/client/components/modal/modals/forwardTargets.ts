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
  const needle = query.trim().toLocaleLowerCase();
  const list: T[] = [];

  for (const channel of channels) {
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
    list.push(channel);
  }

  return list
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit);
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
