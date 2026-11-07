import { decodeTime } from "ulid";

/** The parts of a forum post (a thread) the list needs */
export type PostLike = {
  id: string;
  parentId?: string;
  lastMessageId?: string;
  thread?: { archived: boolean; tags: string[] };
};

/** Last activity of a post: its last message, or when it was made */
export function activity(post: PostLike) {
  return decodeTime(post.lastMessageId ?? post.id);
}

/**
 * The posts of a forum that match the filter, the most recently active
 * first
 */
export function forumPosts<T extends PostLike>(
  channels: T[],
  forumId: string,
  filter: { archived: boolean; tag?: string },
): T[] {
  return channels
    .filter(
      (channel) =>
        channel.parentId === forumId &&
        !!channel.thread &&
        channel.thread.archived === filter.archived &&
        (!filter.tag || channel.thread.tags.includes(filter.tag)),
    )
    .sort((a, b) => activity(b) - activity(a));
}
