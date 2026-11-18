/**
 * The state the gateway sends when it connects ("Ready"), as it is kept for
 * starting without a connection, and how a start from it is corrected once
 * the gateway answers again.
 */

type WithId = { _id: unknown };
type Packet = { type: string } & Record<string, unknown>;

/** The lists of a Ready packet that are kept */
const KEPT = ["users", "servers", "channels", "members", "emojis"] as const;

/**
 * What is kept of a Ready packet: who and what exists. Not kept: who is in
 * which voice room (wrong a minute later) and notices to accept.
 */
export function trimReady(ready: Packet): Packet {
  const kept: Packet = { type: "Ready" };
  for (const list of KEPT)
    if (Array.isArray(ready[list])) kept[list] = ready[list];
  // a start from this must not show anybody in a call
  kept.voice_states = [];
  return kept;
}

/** Whether something is a packet a start can be made from */
export function isSnapshot(value: unknown): value is Packet {
  const packet = value as Packet | undefined;
  return (
    !!packet &&
    packet.type === "Ready" &&
    Array.isArray(packet.users) &&
    Array.isArray(packet.servers) &&
    Array.isArray(packet.channels)
  );
}

const key = (item: WithId) =>
  typeof item._id === "string" ? item._id : JSON.stringify(item._id);

function compare(
  before: unknown,
  after: unknown,
): { gone: WithId[]; changed: WithId[] } {
  const was = new Map(
    (Array.isArray(before) ? (before as WithId[]) : []).map((item) => [
      key(item),
      item,
    ]),
  );
  const changed: WithId[] = [];
  for (const item of Array.isArray(after) ? (after as WithId[]) : []) {
    const old = was.get(key(item));
    if (old && JSON.stringify(old) !== JSON.stringify(item)) changed.push(item);
    was.delete(key(item));
  }
  return { gone: [...was.values()], changed };
}

/** Fields of the old object the new one no longer has, as the API names them */
function cleared(
  old: WithId | undefined,
  now: WithId,
  names: Record<string, string>,
) {
  const out: string[] = [];
  for (const [field, name] of Object.entries(names))
    if (
      old &&
      (old as Record<string, unknown>)[field] != null &&
      (now as Record<string, unknown>)[field] == null
    )
      out.push(name);
  return out;
}

/**
 * The app was started from a kept state and the gateway has now sent the
 * real one. The client added what is new by itself; these are the events
 * that bring the rest in line, in the gateway's own format: what changed
 * while away is updated, what is gone is removed. Nothing reloads.
 */
export function reconcile(kept: Packet, fresh: Packet): Packet[] {
  const events: Packet[] = [];
  const old = (list: string) =>
    new Map(
      (Array.isArray(kept[list]) ? (kept[list] as WithId[]) : []).map(
        (item) => [key(item), item],
      ),
    );

  // removed first, containers last: a server's channels before the server
  const members = compare(kept.members, fresh.members);
  for (const member of members.gone) {
    const id = member._id as { server: string; user: string };
    events.push({ type: "ServerMemberLeave", id: id.server, user: id.user });
  }
  const channels = compare(kept.channels, fresh.channels);
  for (const channel of channels.gone)
    events.push({ type: "ChannelDelete", id: channel._id });
  const servers = compare(kept.servers, fresh.servers);
  for (const server of servers.gone)
    events.push({ type: "ServerDelete", id: server._id });
  for (const emoji of compare(kept.emojis, fresh.emojis).gone)
    events.push({ type: "EmojiDelete", id: emoji._id });

  const oldServers = old("servers");
  for (const server of servers.changed)
    events.push({
      type: "ServerUpdate",
      id: server._id,
      data: server,
      clear: cleared(oldServers.get(key(server)), server, {
        description: "Description",
        icon: "Icon",
        banner: "Banner",
        categories: "Categories",
        system_messages: "SystemMessages",
      }),
    });
  const oldChannels = old("channels");
  for (const channel of channels.changed)
    events.push({
      type: "ChannelUpdate",
      id: channel._id,
      data: channel,
      clear: cleared(oldChannels.get(key(channel)), channel, {
        description: "Description",
        icon: "Icon",
        default_permissions: "DefaultPermissions",
      }),
    });
  const oldUsers = old("users");
  for (const user of compare(kept.users, fresh.users).changed)
    events.push({
      type: "UserUpdate",
      id: user._id,
      data: user,
      clear: cleared(oldUsers.get(key(user)), user, {
        avatar: "Avatar",
        display_name: "DisplayName",
        status: "StatusText",
      }),
    });
  const oldMembers = old("members");
  for (const member of members.changed)
    events.push({
      type: "ServerMemberUpdate",
      id: member._id,
      data: member,
      clear: cleared(oldMembers.get(key(member)), member, {
        nickname: "Nickname",
        avatar: "Avatar",
        roles: "Roles",
        timeout: "Timeout",
      }),
    });
  return events;
}

/** The newest `limit` of a channel's messages, whatever order they came in */
export function newest<T extends { _id: string }>(
  messages: T[],
  limit: number,
) {
  const byId = new Map(messages.map((message) => [message._id, message]));
  return [...byId.values()]
    .sort((a, b) => (a._id < b._id ? 1 : -1))
    .slice(0, limit);
}

/**
 * Whether a request for a channel's messages asks for its latest page, the
 * one that is kept, and for which channel. Older pages and searches are not
 * kept.
 */
export function latestPageOf(
  path: string,
  query: Record<string, unknown> | undefined,
): string | undefined {
  const match = /^\/channels\/([^/]+)\/messages$/.exec(path);
  if (!match) return undefined;
  if (query && (query.before || query.after || query.nearby)) return undefined;
  return match[1];
}
