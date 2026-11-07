import { ulid } from "ulid";
import { describe, expect, it } from "vitest";

import { PostLike, forumPosts } from "./posts";

const at = (ms: number) => ulid(ms);

function post(
  id: string,
  change: Partial<PostLike> & { tags?: string[]; archived?: boolean } = {},
): PostLike {
  return {
    id,
    parentId: change.parentId ?? "FORUM",
    lastMessageId: change.lastMessageId,
    thread: { archived: change.archived ?? false, tags: change.tags ?? [] },
  };
}

describe("forumPosts", () => {
  const old = post(at(1_000), { lastMessageId: at(9_000), tags: ["bug"] });
  const fresh = post(at(5_000), { tags: ["idea"] });
  const quiet = post(at(2_000));
  const closed = post(at(3_000), { archived: true, tags: ["bug"] });
  const elsewhere = post(at(4_000), { parentId: "OTHER" });
  const all = [old, fresh, quiet, closed, elsewhere];

  it("lists this forum's active posts, most recently active first", () => {
    expect(forumPosts(all, "FORUM", { archived: false })).toEqual([
      old,
      fresh,
      quiet,
    ]);
  });

  it("filters by tag and by archived", () => {
    expect(forumPosts(all, "FORUM", { archived: false, tag: "bug" })).toEqual([
      old,
    ]);
    expect(forumPosts(all, "FORUM", { archived: true })).toEqual([closed]);
  });

  it("leaves out channels that are not posts", () => {
    const plain = { id: at(6_000), parentId: "FORUM" };
    expect(forumPosts([plain], "FORUM", { archived: false })).toEqual([]);
  });
});
