import { createSignal } from "solid-js";
import { describe, expect, it, vi } from "vitest";

const play = vi.fn(async () => undefined);
const stopAll = vi.fn();
const forget = vi.fn();
vi.mock("./soundboardPlayer", () => ({
  SoundboardPlayer: class {
    play = play;
    stopAll = stopAll;
    forget = forget;
  },
  soundGain: (own: number, listener: number) => (own / 100) * listener,
  soundUrl: (media: string, id: string) => `${media}/sounds/${id}/original`,
}));
vi.mock("./livekitConstants", () => ({ TrackSource: { ScreenShare: 3 } }));
const fetchStage = vi.fn(async () => ({ speakers: ["me"], hands: [] }));
const fetchSoundboard = vi.fn(async () => ({
  sounds: [
    { _id: "tada", server: "sv", volume: 50 },
    { _id: "late", server: "sv", volume: 100 },
  ],
  limit: 8,
}));
vi.mock("@zrzur/sdk/solid/voiceExtras", () => ({
  EMPTY_STAGE: { speakers: [], hands: [] },
  applyStageChange: (state: unknown) => state,
  fetchStage: () => fetchStage(),
  fetchSoundboard: () => fetchSoundboard(),
  sendStreamPreview: vi.fn(),
}));

import { setSoundboardChoice } from "./soundboardSettings";
import { attachVoiceExtras } from "./voiceExtras";

function setup(options: { stage?: boolean; id?: string } = {}) {
  const handlers: ((event: unknown) => void)[] = [];
  const client = {
    user: { id: "me" },
    on: (_name: string, fn: (event: unknown) => void) => handlers.push(fn),
  };
  const channel = {
    id: options.id ?? "vc",
    isStage: !!options.stage,
    isVoiceRoom: true,
    server: { id: "sv" },
  };
  const [deafened, setDeafened] = createSignal(false);
  let gate: (() => boolean) | undefined;
  const detach = attachVoiceExtras(
    client as never,
    channel as never,
    {
      room: () => undefined,
      screenshare: () => false,
      deafen: deafened,
      serverDeafened: false,
      setStageGate: (next) => (gate = next),
    },
    "https://cdn",
  );
  const emit = (event: unknown) => handlers.forEach((fn) => fn(event));
  const played = (soundId: string, channelId = channel.id) =>
    emit({
      type: "SoundboardPlay",
      channel_id: channelId,
      sound_id: soundId,
      user: "x",
    });
  return { channel, emit, played, detach, setDeafened, gate: () => gate };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("call extras", () => {
  it("loads the soundboard once, then plays at both volumes", async () => {
    play.mockClear();
    setSoundboardChoice({ muted: false, volume: 0.5 });
    const call = setup();
    call.played("tada");
    await flush();
    expect(fetchSoundboard).toHaveBeenCalledOnce();
    expect(play).toHaveBeenCalledWith(
      "tada",
      "https://cdn/sounds/tada/original",
      0.25,
    );
    call.played("late");
    expect(play).toHaveBeenLastCalledWith(
      "late",
      "https://cdn/sounds/late/original",
      0.5,
    );
    call.played("tada", "other-call");
    expect(play).toHaveBeenCalledTimes(2);
    call.detach();
  });

  it("stays silent when deafened or the soundboard is muted, and stops what plays", async () => {
    play.mockClear();
    stopAll.mockClear();
    const call = setup();
    setSoundboardChoice({ muted: true });
    expect(stopAll).toHaveBeenCalled();
    call.played("tada");
    setSoundboardChoice({ muted: false });
    call.setDeafened(true);
    call.played("tada");
    await flush();
    expect(play).not.toHaveBeenCalled();
    call.detach();
  });

  it("stops playing and listening when the call ends", () => {
    play.mockClear();
    stopAll.mockClear();
    const call = setup();
    call.detach();
    expect(stopAll).toHaveBeenCalled();
    call.played("tada");
    expect(play).not.toHaveBeenCalled();
  });

  it("forgets a removed sound", () => {
    const call = setup();
    call.emit({ type: "SoundboardSoundDelete", id: "tada", server: "sv" });
    expect(forget).toHaveBeenCalledWith("tada");
    call.detach();
  });

  it("opens the microphone on a stage only for speakers", async () => {
    const call = setup({ stage: true, id: "stage-1" });
    expect(call.gate()?.()).toBe(false);
    await flush();
    expect(fetchStage).toHaveBeenCalledOnce();
    expect(call.gate()?.()).toBe(true);
    call.detach();
    expect(call.gate()).toBeUndefined();
  });
});
