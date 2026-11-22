/**
 * Unread state of forum posts. A forum has no messages of its own: every
 * post is a thread, so the forum is unread when one of its posts is.
 * Pure, so the channel list, the server list, the forum page and the tests
 * share one rule.
 */

/** What the rule needs to know of one post, for this reader */
export type PostRead = {
  /** Post (thread) id: a ULID, so it also says when the post was made */
  id: string;
  /** Newest message of the post */
  lastMessageId?: string;
  archived: boolean;
  /** The reader's read mark in the post; none if never opened */
  readUpTo?: string;
  /** Unread mentions of the reader in the post */
  mentions: number;
  /** The newest message is the reader's own */
  ownLastMessage: boolean;
  /** The reader muted the post or its forum */
  muted: boolean;
};

/**
 * Whether a post has something new for the reader.
 * @param post The post
 * @param forumSeen Newest activity the reader saw in the forum's list (the
 *  forum's own read mark); posts never opened count from there
 */
export function postUnread(post: PostRead, forumSeen: string | undefined) {
  if (post.mentions > 0) return true;
  if (post.archived || post.muted || post.ownLastMessage) return false;
  const latest = post.lastMessageId ?? post.id;
  const mark = post.readUpTo ?? forumSeen ?? "0";
  return mark.localeCompare(latest) < 0;
}

/** One badge for the whole forum: unread, and how many mentions */
export function forumSummary(
  posts: PostRead[],
  forumSeen: string | undefined,
): { unread: boolean; mentions: number } {
  let unread = false;
  let mentions = 0;
  for (const post of posts) {
    if (postUnread(post, forumSeen)) unread = true;
    mentions += post.mentions;
  }
  return { unread, mentions };
}

/** Newest activity among posts: what the reader has now seen in the list */
export function newestActivity(
  posts: Pick<PostRead, "id" | "lastMessageId">[],
): string | undefined {
  let newest: string | undefined;
  for (const post of posts) {
    const latest = post.lastMessageId ?? post.id;
    if (!newest || newest.localeCompare(latest) < 0) newest = latest;
  }
  return newest;
}

/**
 * Posts that need their own read mark when the reader marks a forum read.
 * A post never opened is covered by the forum's own mark (moved to the
 * newest activity at the same time); only opened posts with something new
 * and posts with a mention need one.
 */
export function postsToAck(posts: PostRead[], forumSeen: string | undefined) {
  return posts.filter(
    (post) =>
      postUnread(post, forumSeen) &&
      (post.readUpTo !== undefined || post.mentions > 0),
  );
}

/**
 * Forums of one server for its icon: a forum the reader muted adds neither
 * the unread dot nor its mentions, as for any muted channel
 */
export function serverForumsSummary(
  forums: { muted: boolean; unread: boolean; mentions: number }[],
): { unread: boolean; mentions: number } {
  let unread = false;
  let mentions = 0;
  for (const forum of forums) {
    if (forum.muted) continue;
    if (forum.unread) unread = true;
    mentions += forum.mentions;
  }
  return { unread, mentions };
}
