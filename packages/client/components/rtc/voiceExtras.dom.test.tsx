import { createSignal } from "solid-js";
import { describe, expect, it, vi } from "vitest";

const play = vi.fn(async () => undefined);
const stopAll = vi.fn();
vi.mock("./soundboardPlayer", () => ({
  SoundboardPlayer: class {
    play = play;
    stopAll = stopAll;
  },
  soundGain: (own: number, listener: number) => (own / 100) * listener,
  soundUrl: (media: string, id: string) => `${media}/sounds/${id}/original`,
}));
vi.mock("@zrzur/sdk/solid/voiceExtras", () => ({
  fetchStage: (_c: unknown, channel: { fetchStage: () => Promise<void> }) =>
    channel.fetchStage(),
  fetchSoundboard: (
    _c: unknown,
    server: { fetchSoundboard: () => Promise<void> },
  ) => server.fetchSoundboard(),
  sendStreamPreview: vi.fn(),
}));
vi.mock("./livekitConstants", () => ({ TrackSource: { ScreenShare: 3 } }));

import { attachVoiceExtras } from "./voiceExtras";

function setup(options: { stage?: boolean } = {}) {
  const listeners = new Map<string, (...args: string[]) => void>();
  const client = {
    on: (name: string, fn: (...args: string[]) => void) =>
      listeners.set(name, fn),
    off: (name: string) => listeners.delete(name),
  };
  const sounds = new Map([["tada", { _id: "tada", volume: 50 }]]);
  const server = {
    soundboard: sounds,
    fetchSoundboard: vi.fn(async () => {
      sounds.set("late", { _id: "late", volume: 100 });
    }),
  };
  const channel = {
    id: "vc",
    isStage: !!options.stage,
    isVoiceRoom: true,
    server,
    fetchStage: vi.fn(async () => undefined),
    sendStreamPreview: vi.fn(),
  };
  const [deafened, setDeafened] = createSignal(false);
  const [muted, setMuted] = createSignal(false);
  const settings = {
    get soundboardMuted() {
      return muted();
    },
    soundboardVolume: 0.5,
  };
  const detach = attachVoiceExtras(
    client as never,
    channel as never,
    {
      room: () => undefined,
      screenshare: () => false,
      deafen: deafened,
      serverDeafened: false,
    },
    settings,
    "https://cdn",
  );
  const emit = (channelId: string, soundId: string) =>
    listeners.get("soundboardPlay")?.(channelId, soundId, "someone");
  return { channel, server, listeners, emit, detach, setDeafened, setMuted };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("call extras", () => {
  it("plays a sound played in this call, at both volumes", async () => {
    play.mockClear();
    const call = setup();
    call.emit("vc", "tada");
    expect(play).toHaveBeenCalledWith(
      "tada",
      "https://cdn/sounds/tada/original",
      0.25,
    );
    call.emit("other-call", "tada");
    expect(play).toHaveBeenCalledOnce();
    call.detach();
  });

  it("loads the soundboard for a sound it does not know yet", async () => {
    play.mockClear();
    const call = setup();
    call.emit("vc", "late");
    await flush();
    expect(call.server.fetchSoundboard).toHaveBeenCalledOnce();
    expect(play).toHaveBeenCalledWith(
      "late",
      "https://cdn/sounds/late/original",
      0.5,
    );
    call.detach();
  });

  it("stays silent when deafened or the soundboard is muted, and stops what plays", () => {
    play.mockClear();
    stopAll.mockClear();
    const call = setup();
    call.setMuted(true);
    expect(stopAll).toHaveBeenCalled();
    call.emit("vc", "tada");
    call.setMuted(false);
    call.setDeafened(true);
    call.emit("vc", "tada");
    expect(play).not.toHaveBeenCalled();
    call.detach();
  });

  it("stops listening and playing when the call ends", () => {
    stopAll.mockClear();
    const call = setup();
    call.detach();
    expect(call.listeners.has("soundboardPlay")).toBe(false);
    expect(stopAll).toHaveBeenCalled();
  });

  it("fetches the stage state of a stage call", () => {
    const call = setup({ stage: true });
    expect(call.channel.fetchStage).toHaveBeenCalledOnce();
    call.detach();
    expect(setup().channel.fetchStage).not.toHaveBeenCalled();
  });
});
