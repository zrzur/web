import { describe, expect, it } from "vitest";

import { conversationName } from "./conversationName";

describe("conversationName", () => {
  it("names a direct message by the person's display name", () => {
    expect(
      conversationName({
        type: "DirectMessage",
        // what the SDK gives for a direct message: the username
        displayName: "omar71ac8d",
        recipient: { displayName: "عمر", username: "omar71ac8d" },
      }),
    ).toBe("عمر");
  });

  it("falls back to the username, then to the channel's own name", () => {
    expect(
      conversationName({
        type: "DirectMessage",
        recipient: { username: "omar71ac8d" },
      }),
    ).toBe("omar71ac8d");
    expect(
      conversationName({ type: "DirectMessage", displayName: "omar71ac8d" }),
    ).toBe("omar71ac8d");
  });

  it("leaves groups and server channels with their own name", () => {
    expect(conversationName({ type: "Group", displayName: "Friday" })).toBe(
      "Friday",
    );
    expect(
      conversationName({
        type: "TextChannel",
        displayName: "chat",
        recipient: { displayName: "nobody" },
      }),
    ).toBe("chat");
    expect(conversationName({ type: "VoiceChannel", name: "Lounge" })).toBe(
      "Lounge",
    );
  });

  it("has no name for no channel", () => {
    expect(conversationName(undefined)).toBeUndefined();
  });
});
