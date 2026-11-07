import { describe, expect, it } from "vitest";

import {
  ThreadChannel,
  canSend,
  startAccess,
  writeAccess,
} from "./threadAccess";

function channel(
  held: string[],
  options: {
    forum?: boolean;
    inForum?: boolean;
    threadsDisabled?: boolean;
    forumsDisabled?: boolean;
  } = {},
): ThreadChannel {
  return {
    isForum: !!options.forum,
    havePermission: (...wanted: string[]) =>
      wanted.every((name) => held.includes(name)),
    parent: { isForum: !!options.inForum },
    server: {
      threadsDisabled: !!options.threadsDisabled,
      forumsDisabled: !!options.forumsDisabled,
    },
  } as ThreadChannel;
}

describe("canSend", () => {
  const thread = (held: string[], threadsDisabled = false) => ({
    ...channel(held, { threadsDisabled }),
    isThread: true,
  });

  it("is Send Messages in a plain channel", () => {
    expect(canSend({ ...channel(["SendMessage"]), isThread: false })).toBe(
      true,
    );
    expect(canSend({ ...channel([]), isThread: false })).toBe(false);
  });

  it("takes the thread rules in a thread", () => {
    expect(canSend(thread(["SendMessage", "SendMessageInThreads"]))).toBe(true);
    expect(canSend(thread(["SendMessage"]))).toBe(false);
    expect(
      canSend(thread(["SendMessage", "SendMessageInThreads"], true)),
    ).toBe(false);
  });
});

describe("startAccess", () => {
  it("needs Send Messages and the permission of the kind of channel", () => {
    expect(startAccess(channel(["SendMessage", "CreateThreads"]))).toBe(
      "allowed",
    );
    expect(startAccess(channel(["CreateThreads"]))).toBe("no-permission");
    expect(startAccess(channel(["SendMessage", "CreateForumPosts"]))).toBe(
      "no-permission",
    );
    expect(
      startAccess(
        channel(["SendMessage", "CreateForumPosts"], { forum: true }),
      ),
    ).toBe("allowed");
    expect(
      startAccess(channel(["SendMessage", "CreateThreads"], { forum: true })),
    ).toBe("no-permission");
  });

  it("each switch only covers its own feature, whatever the permissions", () => {
    const all = ["SendMessage", "CreateThreads", "CreateForumPosts"];
    expect(startAccess(channel(all, { threadsDisabled: true }))).toBe(
      "switched-off",
    );
    expect(
      startAccess(channel(all, { forum: true, threadsDisabled: true })),
    ).toBe("allowed");
    expect(
      startAccess(channel(all, { forum: true, forumsDisabled: true })),
    ).toBe("switched-off");
    expect(startAccess(channel(all, { forumsDisabled: true }))).toBe("allowed");
  });
});

describe("writeAccess", () => {
  const all = ["SendMessage", "SendMessageInThreads"];

  it("closes with either permission gone", () => {
    expect(writeAccess(channel(all))).toBe("allowed");
    expect(writeAccess(channel(["SendMessage"]))).toBe("no-permission");
    expect(writeAccess(channel(["SendMessageInThreads"]))).toBe(
      "no-permission",
    );
  });

  it("a post goes by the forum switch, a thread by the thread switch", () => {
    expect(
      writeAccess(channel(all, { inForum: true, forumsDisabled: true })),
    ).toBe("switched-off");
    expect(
      writeAccess(channel(all, { inForum: true, threadsDisabled: true })),
    ).toBe("allowed");
    expect(writeAccess(channel(all, { threadsDisabled: true }))).toBe(
      "switched-off",
    );
    expect(writeAccess(channel(all, { forumsDisabled: true }))).toBe("allowed");
  });
});
