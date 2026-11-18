import { describe, expect, it } from "vitest";

import {
  isSnapshot,
  latestPageOf,
  newest,
  reconcile,
  trimReady,
} from "./snapshot";

const ready = (extra: Record<string, unknown> = {}) => ({
  type: "Ready",
  users: [{ _id: "U1", username: "yusuf" }],
  servers: [{ _id: "S1", name: "Makers", description: "Hello" }],
  channels: [
    { _id: "C1", server: "S1", name: "general" },
    { _id: "C2", server: "S1", name: "art" },
  ],
  members: [{ _id: { server: "S1", user: "U1" }, nickname: "Y" }],
  emojis: [{ _id: "E1", name: "wave" }],
  ...extra,
});

describe("the kept state", () => {
  it("keeps who and what exists, and nobody in a call", () => {
    const kept = trimReady(
      ready({
        voice_states: [{ id: "C2", participants: [{ id: "U1" }] }],
        policy_changes: [{ description: "terms" }],
        user_settings: { secret: 1 },
      }),
    );
    expect(Object.keys(kept).sort()).toEqual(
      [
        "channels",
        "emojis",
        "members",
        "servers",
        "type",
        "users",
        "voice_states",
      ].sort(),
    );
    expect(kept.voice_states).toEqual([]);
    expect(isSnapshot(kept)).toBe(true);
  });

  it("is refused when it is not a state to start from", () => {
    expect(isSnapshot(undefined)).toBe(false);
    expect(isSnapshot({ type: "Ready" })).toBe(false);
    expect(
      isSnapshot({ type: "Message", users: [], servers: [], channels: [] }),
    ).toBe(false);
  });
});

describe("back online after a start from the kept state", () => {
  it("changes nothing when nothing changed", () => {
    expect(reconcile(ready(), ready())).toEqual([]);
  });

  it("removes what is gone: a channel, a server left, a member, an emoji", () => {
    const events = reconcile(
      ready(),
      ready({
        channels: [{ _id: "C1", server: "S1", name: "general" }],
        servers: [],
        members: [],
        emojis: [],
      }),
    );
    expect(events).toEqual([
      { type: "ServerMemberLeave", id: "S1", user: "U1" },
      { type: "ChannelDelete", id: "C2" },
      { type: "ServerDelete", id: "S1" },
      { type: "EmojiDelete", id: "E1" },
    ]);
  });

  it("updates what changed, and clears what was removed from it", () => {
    const events = reconcile(
      ready(),
      ready({
        servers: [{ _id: "S1", name: "Creators" }],
        channels: [
          { _id: "C1", server: "S1", name: "chat" },
          { _id: "C2", server: "S1", name: "art" },
        ],
      }),
    );
    expect(events).toEqual([
      {
        type: "ServerUpdate",
        id: "S1",
        data: { _id: "S1", name: "Creators" },
        clear: ["Description"],
      },
      {
        type: "ChannelUpdate",
        id: "C1",
        data: { _id: "C1", server: "S1", name: "chat" },
        clear: [],
      },
    ]);
  });

  it("leaves what is new to the client itself", () => {
    const events = reconcile(
      ready(),
      ready({
        channels: [
          { _id: "C1", server: "S1", name: "general" },
          { _id: "C2", server: "S1", name: "art" },
          { _id: "C3", server: "S1", name: "new" },
        ],
      }),
    );
    expect(events).toEqual([]);
  });
});

describe("a channel's kept messages", () => {
  it("are the newest, each once", () => {
    const list = [
      { _id: "01B", content: "b" },
      { _id: "01A", content: "a" },
      { _id: "01C", content: "c" },
      { _id: "01B", content: "b again" },
    ];
    expect(newest(list, 2).map((m) => m._id)).toEqual(["01C", "01B"]);
    expect(newest(list, 2)[1].content).toBe("b again");
  });

  it("are only the latest page of that channel", () => {
    expect(latestPageOf("/channels/C1/messages", { limit: 50 })).toBe("C1");
    expect(latestPageOf("/channels/C1/messages", undefined)).toBe("C1");
    expect(
      latestPageOf("/channels/C1/messages", { before: "M1" }),
    ).toBeUndefined();
    expect(
      latestPageOf("/channels/C1/messages", { nearby: "M1" }),
    ).toBeUndefined();
    expect(latestPageOf("/channels/C1/search", {})).toBeUndefined();
    expect(latestPageOf("/channels/C1/messages/M1", {})).toBeUndefined();
    expect(latestPageOf("/users/@me", {})).toBeUndefined();
  });
});
