import { describe, expect, it } from "vitest";

import {
  BRIDGED_FLAG,
  allConfirmed,
  isBridged,
  linkNoticeKind,
  linkRefusal,
  linkedChannelsOpen,
} from "./linkedChannels";

describe("linked channels", () => {
  it("is offered only where the server says so", () => {
    expect(linkedChannelsOpen({ linked_channels: true })).toBe(true);
    expect(linkedChannelsOpen({ linked_channels: false })).toBe(false);
    expect(linkedChannelsOpen({})).toBe(false);
    expect(linkedChannelsOpen(undefined)).toBe(false);
  });

  it("reads the bridged mark from a message's flags", () => {
    expect(BRIDGED_FLAG).toBe(32);
    expect(isBridged(32)).toBe(true);
    expect(isBridged(32 + 1 + 16)).toBe(true);
    // the other flags are not the mark
    for (const flags of [0, 1, 2, 4, 8, 16, 31, 64]) {
      expect(isBridged(flags)).toBe(false);
    }
    expect(isBridged(undefined)).toBe(false);
    expect(isBridged(null)).toBe(false);
  });

  it("links only with all four confirmations", () => {
    expect(allConfirmed({})).toBe(false);
    const all = {
      runs_it: true,
      notice_posted: true,
      not_age_restricted: true,
      new_messages_only: true,
    };
    expect(allConfirmed(all)).toBe(true);
    for (const missing of Object.keys(all)) {
      expect(allConfirmed({ ...all, [missing]: false })).toBe(false);
      const { [missing as keyof typeof all]: _, ...rest } = all;
      expect(allConfirmed(rest)).toBe(false);
    }
  });

  it("words each refusal of the server", () => {
    for (const reason of [
      "not_text",
      "mature",
      "private",
      "not_a_bot",
      "not_your_bot",
      "bot_not_member",
      "not_confirmed",
      "already_linked",
      "too_many",
    ]) {
      expect(linkRefusal({ type: "ChannelLinkRefused", reason })).toBe(reason);
    }
    expect(linkRefusal({ type: "ChannelLinkRefused", reason: "new" })).toBe(
      "other",
    );
    expect(
      linkRefusal({ type: "MissingPermission", permission: "ManageServer" }),
    ).toBe("no_permission");
    expect(linkRefusal({ type: "FeatureDisabled" })).toBe("off");
    // the error as the client wraps it
    expect(
      linkRefusal({
        cause: { type: "ChannelLinkRefused", reason: "private" },
      }),
    ).toBe("private");
    expect(linkRefusal(new Error("network"))).toBe("other");
    expect(linkRefusal(undefined)).toBe("other");
  });

  it("recognises the two link announcements the SDK hands over as text", () => {
    expect(linkNoticeKind("channel_linked is not supported.")).toBe("linked");
    expect(linkNoticeKind("channel_unlinked is not supported.")).toBe(
      "unlinked",
    );
    expect(linkNoticeKind("message_pinned is not supported.")).toBeUndefined();
    expect(linkNoticeKind("channel_linked")).toBeUndefined();
    expect(linkNoticeKind("")).toBeUndefined();
  });
});
