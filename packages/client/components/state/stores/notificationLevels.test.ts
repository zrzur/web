import { describe, expect, it } from "vitest";

import {
  MENTIONS_EVERYONE,
  MENTIONS_ONLINE,
  effectiveChannelMute,
  effectiveChannelState,
  effectiveServerState,
  effectiveSuppress,
  mentionsForNotification,
  muteActive,
} from "./notificationLevels";

describe("effectiveServerState", () => {
  it("uses the member's own choice first", () => {
    expect(effectiveServerState("none", "All")).toBe("none");
    expect(effectiveServerState("all", "Mentions")).toBe("all");
  });

  it("falls back to the server default", () => {
    expect(effectiveServerState(undefined, "All")).toBe("all");
    expect(effectiveServerState(undefined, "Mentions")).toBe("mention");
  });

  it("is mentions only when neither is set", () => {
    expect(effectiveServerState(undefined, undefined)).toBe("mention");
  });
});

describe("effectiveSuppress", () => {
  it("a channel choice wins over the server", () => {
    expect(effectiveSuppress(false, true)).toBe(false);
    expect(effectiveSuppress(true, false)).toBe(true);
  });

  it("inherits the server, then off", () => {
    expect(effectiveSuppress(undefined, true)).toBe(true);
    expect(effectiveSuppress(undefined, undefined)).toBe(false);
  });
});

describe("mentionsForNotification", () => {
  const base = {
    selfId: "me",
    mentionIds: [] as string[],
    flags: 0,
    mentionsMyRole: false,
    suppressEveryone: false,
    suppressRoles: false,
  };

  it("a direct mention always counts", () => {
    expect(
      mentionsForNotification({
        ...base,
        mentionIds: ["me"],
        suppressEveryone: true,
        suppressRoles: true,
      }),
    ).toBe(true);
  });

  it("@everyone and @here count unless suppressed", () => {
    expect(mentionsForNotification({ ...base, flags: MENTIONS_EVERYONE })).toBe(
      true,
    );
    expect(mentionsForNotification({ ...base, flags: MENTIONS_ONLINE })).toBe(
      true,
    );
    expect(
      mentionsForNotification({
        ...base,
        flags: MENTIONS_EVERYONE | MENTIONS_ONLINE,
        suppressEveryone: true,
      }),
    ).toBe(false);
  });

  it("role mentions count unless suppressed", () => {
    expect(mentionsForNotification({ ...base, mentionsMyRole: true })).toBe(
      true,
    );
    expect(
      mentionsForNotification({
        ...base,
        mentionsMyRole: true,
        suppressRoles: true,
      }),
    ).toBe(false);
  });

  it("suppressing one kind keeps the other", () => {
    expect(
      mentionsForNotification({
        ...base,
        flags: MENTIONS_EVERYONE,
        mentionsMyRole: true,
        suppressEveryone: true,
      }),
    ).toBe(true);
  });

  it("someone else's mention does not count", () => {
    expect(mentionsForNotification({ ...base, mentionIds: ["other"] })).toBe(
      false,
    );
  });
});

describe("effectiveChannelState (threads and forum posts)", () => {
  const base = {
    own: undefined,
    parent: undefined,
    server: undefined,
    typeDefault: "all" as const,
  };
  it("uses the post's own level first", () => {
    expect(
      effectiveChannelState({
        ...base,
        own: "all",
        parent: "none",
        server: "mention",
      }),
    ).toBe("all");
  });
  it("follows its parent channel's level when it has none", () => {
    expect(
      effectiveChannelState({ ...base, parent: "none", server: "all" }),
    ).toBe("none");
  });
  it("then the server's, then the default for its type", () => {
    expect(effectiveChannelState({ ...base, server: "mention" })).toBe(
      "mention",
    );
    expect(effectiveChannelState(base)).toBe("all");
  });
});

describe("effectiveChannelMute (threads and forum posts)", () => {
  const none = { server: false, parent: false, own: false };
  it("a post is muted with its muted parent channel", () => {
    expect(effectiveChannelMute({ ...none, parent: true })).toBe(true);
  });
  it("a post is muted with its muted server", () => {
    expect(effectiveChannelMute({ ...none, server: true })).toBe(true);
  });
  it("a post can be muted on its own", () => {
    expect(effectiveChannelMute({ ...none, own: true })).toBe(true);
  });
  it("is not muted when nothing is", () => {
    expect(effectiveChannelMute(none)).toBe(false);
  });
});

describe("muteActive", () => {
  it("a mute without an end, or with an end to come, is on", () => {
    expect(muteActive({}, 1000)).toBe(true);
    expect(muteActive({ until: 2000 }, 1000)).toBe(true);
  });
  it("an ended mute or none is off", () => {
    expect(muteActive({ until: 500 }, 1000)).toBe(false);
    expect(muteActive(undefined, 1000)).toBe(false);
  });
});
