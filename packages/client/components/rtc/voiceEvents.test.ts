import type { Setter } from "solid-js";
import type { Client } from "@zrzur/sdk/solid";
import { expect, it, vi } from "vitest";
import { handleEvent } from "../../../stoat.js/src/solid/events/v1";
import { hydrate } from "../../../stoat.js/src/solid/hydration/index";

it("hydrates false moderation flags without treating absence as muted", () => {
  expect(
    hydrate(
      "serverMember",
      { can_publish: false, can_receive: false },
      {},
      false,
    ),
  ).toMatchObject({ canPublish: false, canReceive: false });
  expect(
    hydrate("serverMember", { can_publish: true }, {}, false),
  ).toMatchObject({ canPublish: true });
  expect(hydrate("serverMember", {}, {}, false)).not.toHaveProperty(
    "canPublish",
  );
});

it("moves the roster between channels without phantom or duplicate users", async () => {
  const old = { voiceParticipants: new Map([["user", {}]]) };
  const next = { voiceParticipants: new Map() };
  const client = {
    options: {},
    channels: { getOrPartial: (id: string) => (id === "old" ? old : next) },
    emit: vi.fn(),
  } as unknown as Client;
  const event = {
    type: "VoiceChannelMove" as const,
    from: "old",
    to: "next",
    user: "user",
    state: {
      id: "user",
      joined_at: 0,
      is_receiving: true,
      is_publishing: false,
      camera: false,
      screensharing: false,
    },
  };
  await handleEvent(client, event, (() => {}) as Setter<boolean>);
  await handleEvent(client, event, (() => {}) as Setter<boolean>);
  expect(old.voiceParticipants.size).toBe(0);
  expect(next.voiceParticipants.size).toBe(1);
});

it("forwards the fresh token and destination to the existing voice controller", async () => {
  const emit = vi.fn();
  const event = {
    type: "UserMoveVoiceChannel" as const,
    from: "old",
    to: "next",
    node: "worldwide",
    token: "test-token",
  };
  await handleEvent(
    { emit, options: {} } as unknown as Client,
    event,
    (() => {}) as Setter<boolean>,
  );
  expect(emit).toHaveBeenCalledWith("userMoveVoiceChannel", {
    from: "old",
    to: "next",
    node: "worldwide",
    token: "test-token",
  });
});
