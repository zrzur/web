import { describe, expect, it } from "vitest";

import {
  type TargetLike,
  canForwardMessage,
  forwardTargets,
  forwardingEnabled,
} from "./forwardTargets";

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 9, 12, minutes));

function channel(partial: Partial<TargetLike> & { id: string }): TargetLike {
  return {
    type: "TextChannel",
    displayName: partial.id,
    active: true,
    isForum: false,
    mature: false,
    updatedAt: at(0),
    canSend: true,
    ...partial,
  };
}

describe("forwardTargets", () => {
  const general = channel({
    id: "general",
    displayName: "general",
    server: { name: "Book Club", mature: false },
    updatedAt: at(5),
  });
  const dm = channel({
    id: "dm",
    type: "DirectMessage",
    displayName: "layla",
    updatedAt: at(30),
  });
  const group = channel({
    id: "group",
    type: "Group",
    displayName: "Weekend trip",
    updatedAt: at(10),
  });
  const saved = channel({
    id: "saved",
    type: "SavedMessages",
    displayName: "me",
    updatedAt: at(1),
  });

  it("lists every place the person can write, most recent first", () => {
    expect(
      forwardTargets([general, dm, group, saved], "", false).map((t) => t.id),
    ).toEqual(["dm", "group", "general", "saved"]);
  });

  it("leaves out read-only channels, forums and closed direct messages", () => {
    const readOnly = channel({ id: "news", canSend: false });
    const forum = channel({ id: "forum", isForum: true });
    const closedDm = channel({
      id: "closed",
      type: "DirectMessage",
      active: false,
    });
    expect(
      forwardTargets([general, readOnly, forum, closedDm], "", false).map(
        (t) => t.id,
      ),
    ).toEqual(["general"]);
  });

  it("searches channel and server names, ignoring case", () => {
    expect(
      forwardTargets([general, dm, group], "BOOK", false).map((t) => t.id),
    ).toEqual(["general"]);
    expect(
      forwardTargets([general, dm, group], "trip", false).map((t) => t.id),
    ).toEqual(["group"]);
    expect(
      forwardTargets([general, dm, group], "  ", false).map((t) => t.id),
    ).toEqual(["dm", "group", "general"]);
  });

  it("finds Arabic and German names", () => {
    const arabic = channel({ id: "ar", displayName: "الأخبار" });
    const german = channel({ id: "de", displayName: "Grüße" });
    expect(forwardTargets([arabic, german], "أخبار", false)[0]?.id).toBe("ar");
    expect(forwardTargets([arabic, german], "GRÜSSE", false)).toEqual([]);
    expect(forwardTargets([arabic, german], "grü", false)[0]?.id).toBe("de");
  });

  it("sends mature messages only to mature places", () => {
    const mature = channel({ id: "late", mature: true });
    const matureServer = channel({
      id: "lounge",
      server: { name: "Night", mature: true },
    });
    expect(
      forwardTargets([general, dm, mature, matureServer], "", true).map(
        (t) => t.id,
      ),
    ).toEqual(["late", "lounge"]);
  });

  it("shows at most the given number", () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      channel({ id: `c${i}`, updatedAt: at(i) }),
    );
    const list = forwardTargets(many, "", false, 50);
    expect(list).toHaveLength(50);
    expect(list[0].id).toBe("c79");
  });
});

describe("forwardingEnabled", () => {
  it("is on only when the server says so", () => {
    expect(
      forwardingEnabled({ configuration: { features: { forwarding: true } } }),
    ).toBe(true);
    expect(
      forwardingEnabled({ configuration: { features: { forwarding: false } } }),
    ).toBe(false);
    expect(forwardingEnabled({ configuration: { features: {} } })).toBe(false);
    expect(forwardingEnabled({ configuration: undefined })).toBe(false);
    expect(forwardingEnabled(undefined)).toBe(false);
  });
});

describe("canForwardMessage", () => {
  it("takes messages with text, files or embeds", () => {
    expect(canForwardMessage({ content: "hi" })).toBe(true);
    expect(canForwardMessage({ attachments: [{}] })).toBe(true);
    expect(canForwardMessage({ embeds: [{}] })).toBe(true);
  });

  it("refuses system lines and empty messages", () => {
    expect(canForwardMessage({ systemMessage: {}, content: "joined" })).toBe(
      false,
    );
    expect(canForwardMessage({ content: "   " })).toBe(false);
    expect(canForwardMessage({})).toBe(false);
  });
});
