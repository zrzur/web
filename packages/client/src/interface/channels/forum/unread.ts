import { type Accessor, createMemo, createRoot } from "solid-js";

import type { Channel, Client } from "@zrzur/sdk/solid";

import {
  type PostRead,
  forumSummary,
  newestActivity,
  postUnread,
  postsToAck,
  serverForumsSummary,
} from "./unreadRules";

/** The reader's mute rule (the app's notification options) */
type IsMuted = (channel: Channel) => boolean;

type Channels = Client["channels"];

/** Same parents pointing at the same posts */
function samePosts(
  a: Map<string, Channel[]> | undefined,
  b: Map<string, Channel[]>,
) {
  if (!a || a.size !== b.size) return false;
  for (const [parent, posts] of b) {
    const before = a.get(parent);
    if (!before || before.length !== posts.length) return false;
    for (let i = 0; i < posts.length; i++)
      if (before[i] !== posts[i]) return false;
  }
  return true;
}

/**
 * Posts (threads) by the channel they belong to. One index per channel
 * list, built in one pass; it is rebuilt when a channel comes, goes or
 * moves, never for a new message. Each forum row, server icon and folder
 * used to walk the whole channel list on its own.
 */
const indexes = new WeakMap<Channels, Accessor<Map<string, Channel[]>>>();

function postIndex(channels: Channels) {
  let index = indexes.get(channels);
  if (!index) {
    // lives as long as the channel list; never disposed on purpose
    index = createRoot(() =>
      createMemo(
        () => {
          const byParent = new Map<string, Channel[]>();
          for (const channel of channels.values()) {
            const parent = channel.parentId;
            if (!parent || !channel.thread) continue;
            const list = byParent.get(parent);
            if (list) list.push(channel);
            else byParent.set(parent, [channel]);
          }
          return byParent;
        },
        undefined,
        { equals: samePosts },
      ),
    );
    indexes.set(channels, index);
  }
  return index;
}

/** A post as the unread rule sees it, for this reader */
export function postRead(
  client: Client,
  post: Channel,
  isMuted: IsMuted,
): PostRead {
  const entry = client.channelUnreads.get(post.id);
  return {
    id: post.id,
    lastMessageId: post.lastMessageId,
    archived: !!post.thread?.archived,
    readUpTo: entry?.lastMessageId,
    mentions: entry?.messageMentionIds.size ?? 0,
    ownLastMessage:
      !!client.user && post.lastMessage?.authorId === client.user.id,
    muted: isMuted(post),
  };
}

/** The posts of a forum this client knows (active ones come with Ready) */
export function postsOf(client: Client, forum: Channel): Channel[] {
  return postIndex(client.channels)().get(forum.id) ?? [];
}

/** Newest activity the reader saw in the forum's list (its own read mark) */
export function forumSeen(client: Client, forum: Channel) {
  return client.channelUnreads.get(forum.id)?.lastMessageId;
}

/**
 * Badge of a forum: unread when one of its posts is, and its mentions.
 * Nothing before the first unread sync, as for every channel.
 */
export function forumUnread(
  client: Client,
  forum: Channel,
  isMuted: IsMuted,
): { unread: boolean; mentions: number } {
  if (!forum.isForum || !client.channelUnreads.loaded)
    return { unread: false, mentions: 0 };
  return forumSummary(
    postsOf(client, forum).map((post) => postRead(client, post, isMuted)),
    forumSeen(client, forum),
  );
}

/** Whether one post shows as new in the forum's list */
export function isPostUnread(
  client: Client,
  post: Channel,
  isMuted: IsMuted,
  seen: string | undefined,
) {
  return (
    client.channelUnreads.loaded &&
    postUnread(postRead(client, post, isMuted), seen)
  );
}

/** A channel's unread state, with a forum's taken from its posts */
export function channelUnread(
  client: Client,
  channel: Channel,
  isMuted: IsMuted,
): boolean {
  return channel.isForum
    ? forumUnread(client, channel, isMuted).unread
    : channel.unread;
}

/**
 * A server's forums, for its icon in the server list: unread when a post
 * is, and the mentions in posts. A forum the reader muted adds nothing.
 * @param isMuted Mute rule for posts (server, forum or post muted)
 * @param isForumMuted Mute of the forum channel itself
 */
export function serverForumsUnread(
  client: Client,
  server: { channels: Channel[] },
  isMuted: IsMuted,
  isForumMuted: IsMuted,
): { unread: boolean; mentions: number } {
  return serverForumsSummary(
    server.channels
      .filter((channel) => channel.isForum)
      .map((forum) => ({
        muted: isForumMuted(forum),
        ...forumUnread(client, forum, isMuted),
      })),
  );
}

/**
 * Mark a forum read, on the server too: every opened post with something
 * new (and every post with a mention) up to its last message, and the
 * forum's own mark up to its newest post. The server's "mark as read" acks
 * only channels with messages of their own, which a forum never has.
 */
export function markForumRead(
  client: Client,
  forum: Channel,
  isMuted: IsMuted,
) {
  if (!forum.isForum) return;
  const posts = postsOf(client, forum);
  const reads = posts.map((post) => postRead(client, post, isMuted));
  for (const read of postsToAck(reads, forumSeen(client, forum))) {
    const post = client.channels.get(read.id);
    if (post?.lastMessageId)
      post.ack(post.lastMessageId, true).catch(() => undefined);
  }
  const newest = newestActivity(posts);
  if (newest) forum.ack(newest, true).catch(() => undefined);
}

/** Mark every forum among these channels read (server, category) */
export function markForumsRead(
  client: Client,
  channels: Channel[],
  isMuted: IsMuted,
) {
  for (const channel of channels)
    if (channel.isForum) markForumRead(client, channel, isMuted);
}

/**
 * "Mark as read" for a whole server: its forums first (their posts and
 * their own marks, as real requests), then every other channel
 */
export function markServerRead(
  client: Client,
  server: { channels: Channel[]; ack(): Promise<void> },
  isMuted: IsMuted,
) {
  markForumsRead(client, server.channels, isMuted);
  // a failed request is only a mark that comes back with the next sync
  return server.ack().catch(() => undefined);
}

/** Whether a server has anything to mark read, forums included */
export function serverHasNews(
  client: Client,
  server: { unread: boolean; channels: Channel[] },
  isMuted: IsMuted,
) {
  return (
    server.unread ||
    server.channels.some(
      (channel) =>
        channel.isForum && forumUnread(client, channel, isMuted).unread,
    )
  );
}
