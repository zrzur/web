import type { Channel, Client } from "@zrzur/sdk/solid";

import { type PostRead, forumSummary, postUnread } from "./unreadRules";

/** The reader's mute rule (the app's notification options) */
type IsMuted = (channel: Channel) => boolean;

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
  return client.channels.filter(
    (channel) => channel.parentId === forum.id && !!channel.thread,
  );
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
 * is, and the mentions in posts (forums the reader muted do not count)
 */
export function serverForumsUnread(
  client: Client,
  server: { channels: Channel[] },
  isMuted: IsMuted,
): { unread: boolean; mentions: number } {
  let unread = false;
  let mentions = 0;
  for (const channel of server.channels) {
    if (!channel.isForum) continue;
    const forum = forumUnread(client, channel, isMuted);
    if (forum.unread && !isMuted(channel)) unread = true;
    mentions += forum.mentions;
  }
  return { unread, mentions };
}
