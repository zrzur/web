import { describe, expect, it } from "vitest";

import {
  MENTIONS_EVERYONE,
  MENTIONS_ONLINE,
  effectiveServerState,
  effectiveSuppress,
  mentionsForNotification,
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
