import type { Channel, Client, Server } from "@zrzur/sdk/solid";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchStage = vi.fn();
const fetchSoundboard = vi.fn();
vi.mock("@zrzur/sdk/solid/voiceExtras", async (original) => ({
  ...(await original<object>()),
  fetchStage: (...args: unknown[]) => fetchStage(...args),
  fetchSoundboard: (...args: unknown[]) => fetchSoundboard(...args),
}));

import {
  followVoiceEvents,
  soundboardOf,
  stageOf,
  watchStage,
} from "./voiceExtrasStore";

/** A client with only the event methods the store uses */
function fakeClient() {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  return {
    on(name: string, fn: (...args: unknown[]) => void) {
      handlers.set(name, [...(handlers.get(name) ?? []), fn]);
    },
    emit(name: string, ...args: unknown[]) {
      for (const fn of handlers.get(name) ?? []) fn(...args);
    },
  } as unknown as Client & { emit(name: string, ...args: unknown[]): void };
}

const stage = (speakers: string[]) => ({
  topic: "",
  speakers,
  hands: [],
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  fetchStage.mockReset();
  fetchSoundboard.mockReset();
});

describe("voice extras store", () => {
  it("fetches the stage again when the client is ready after a reconnect", async () => {
    const client = fakeClient();
    followVoiceEvents(client);
    const channel = { id: "stage-1" } as Channel;
    const stop = watchStage(channel);
    stageOf(channel.id).set(stage(["old"]));

    // while the gateway was down someone was given the floor
    fetchStage.mockResolvedValue(stage(["old", "new"]));
    client.emit("ready");
    await flush();
    expect(fetchStage).toHaveBeenCalledWith(client, channel);
    expect(stageOf(channel.id).state().speakers).toEqual(["old", "new"]);

    // a stage you left is not fetched any more
    stop();
    fetchStage.mockClear();
    client.emit("ready");
    await flush();
    expect(fetchStage).not.toHaveBeenCalled();
  });

  it("shows nothing of the last account after signing in as another", async () => {
    const first = fakeClient();
    followVoiceEvents(first);
    const held = stageOf("stage-2");
    held.set(stage(["first-account-friend"]));
    fetchSoundboard.mockResolvedValue({
      sounds: [{ _id: "s1", server: "srv", name: "a" }],
      limit: 8,
    });
    const server = { id: "srv" } as Server;
    await soundboardOf(first, server).load();
    expect(soundboardOf(first, server).sounds.size).toBe(1);

    const second = fakeClient();
    followVoiceEvents(second);
    // a screen still holding the old stage sees it empty
    expect(held.state().speakers).toEqual([]);
    expect(stageOf("stage-2").state().speakers).toEqual([]);
    // the soundboard is fetched again for the new account
    fetchSoundboard.mockResolvedValue({ sounds: [], limit: 8 });
    const board = soundboardOf(second, server);
    expect(board.sounds.size).toBe(0);
    await board.load();
    expect(fetchSoundboard).toHaveBeenLastCalledWith(second, server);
  });

  it("forgets everything on sign out", async () => {
    const client = fakeClient();
    followVoiceEvents(client);
    stageOf("stage-3").set(stage(["someone"]));
    client.emit("logout");
    expect(stageOf("stage-3").state().speakers).toEqual([]);
  });
});
