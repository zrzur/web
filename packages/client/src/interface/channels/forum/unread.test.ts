import { ulid } from "ulid";
import { describe, expect, it } from "vitest";

import { type PostRead, forumSummary, postUnread } from "./unreadRules";

/** One id per moment, so the same moment compares equal */
const ids = new Map<number, string>();
const at = (ms: number) => {
  if (!ids.has(ms)) ids.set(ms, ulid(ms));
  return ids.get(ms)!;
};

/** A post made at 1000, last message at 5000, never opened by the reader */
function read(change: Partial<PostRead> = {}): PostRead {
  return {
    id: at(1000),
    lastMessageId: at(5000),
    archived: false,
    readUpTo: undefined,
    mentions: 0,
    ownLastMessage: false,
    muted: false,
    ...change,
  };
}

describe("postUnread", () => {
  it("a new post the reader never opened is unread", () => {
    expect(postUnread(read(), undefined)).toBe(true);
    // and after the forum was last looked at
    expect(postUnread(read(), at(2000))).toBe(true);
  });

  it("a never-opened post older than the reader's last look at the forum is read", () => {
    expect(postUnread(read(), at(6000))).toBe(false);
  });

  it("a post read up to its last message is read; a later reply makes it unread", () => {
    expect(postUnread(read({ readUpTo: at(5000) }), undefined)).toBe(false);
    expect(postUnread(read({ readUpTo: at(4000) }), at(9000))).toBe(true);
  });

  it("a post with no message yet counts from when it was made", () => {
    expect(postUnread(read({ lastMessageId: undefined }), at(500))).toBe(true);
    expect(postUnread(read({ lastMessageId: undefined }), at(1500))).toBe(
      false,
    );
  });

  it("the reader's own last message is not news", () => {
    expect(postUnread(read({ ownLastMessage: true }), undefined)).toBe(false);
  });

  it("a mention always counts, even in a muted or archived post", () => {
    expect(
      postUnread(read({ mentions: 1, readUpTo: at(5000) }), at(9000)),
    ).toBe(true);
    expect(postUnread(read({ mentions: 2, muted: true }), at(9000))).toBe(true);
    expect(postUnread(read({ mentions: 1, archived: true }), at(9000))).toBe(
      true,
    );
  });

  it("muted and archived posts without a mention stay quiet", () => {
    expect(postUnread(read({ muted: true }), undefined)).toBe(false);
    expect(postUnread(read({ archived: true }), undefined)).toBe(false);
  });
});

describe("forumSummary", () => {
  it("is unread when one post is, and adds up the mentions", () => {
    expect(
      forumSummary(
        [
          read({ readUpTo: at(5000) }),
          read({ id: at(1100) }),
          read({ id: at(1200), mentions: 2, readUpTo: at(5000) }),
        ],
        at(500),
      ),
    ).toEqual({ unread: true, mentions: 2 });
  });

  it("is read when every post is", () => {
    expect(
      forumSummary(
        [read({ readUpTo: at(5000) }), read({ id: at(1100) })],
        at(9000),
      ),
    ).toEqual({ unread: false, mentions: 0 });
  });

  it("an empty forum is read", () => {
    expect(forumSummary([], undefined)).toEqual({ unread: false, mentions: 0 });
  });
});
