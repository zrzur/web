import { describe, expect, it, vi } from "vitest";

import {
  SOUND_MAX_MS,
  SoundboardPlayer,
  soundGain,
  soundUrl,
} from "./soundboardPlayer";

/** A Web Audio stand-in that records what plays */
function fakeContext() {
  const started: { duration: number; gain: number }[] = [];
  const stopped: number[] = [];
  let decoded = 0;
  const context = {
    state: "running",
    destination: {},
    resume: vi.fn(async () => undefined),
    decodeAudioData: vi.fn(async (bytes: ArrayBuffer) => {
      decoded++;
      return { duration: bytes.byteLength } as unknown as AudioBuffer;
    }),
    createGain() {
      const node = {
        gain: { value: 1 },
        connect: () => context.destination,
      };
      return node;
    },
    createBufferSource() {
      const index = started.length;
      const source = {
        buffer: undefined as AudioBuffer | undefined,
        onended: undefined as undefined | (() => void),
        connect: (gain: { gain: { value: number } }) => {
          source.gain = gain;
          return gain;
        },
        gain: undefined as undefined | { gain: { value: number } },
        disconnect: vi.fn(),
        start: (_when: number, _offset: number, duration: number) =>
          started.push({ duration, gain: source.gain!.gain.value }),
        stop: () => stopped.push(index),
      };
      return source;
    },
  };
  return {
    context: context as unknown as AudioContext,
    started,
    stopped,
    decoded: () => decoded,
  };
}

describe("soundboard player", () => {
  it("downloads and decodes a sound once, then plays it from memory", async () => {
    const audio = fakeContext();
    const fetch = vi.fn(async () => new ArrayBuffer(2));
    const player = new SoundboardPlayer(fetch, () => audio.context);
    await player.play("s1", "https://cdn/sounds/s1/original", 1);
    await player.play("s1", "https://cdn/sounds/s1/original", 0.5);
    await Promise.all([player.load("s1", "x"), player.load("s1", "x")]);
    expect(fetch).toHaveBeenCalledOnce();
    expect(audio.decoded()).toBe(1);
    expect(audio.started.map((s) => s.gain)).toEqual([1, 0.5]);
  });

  it("stops a sound at the longest length a sound may have", async () => {
    const audio = fakeContext();
    // "duration" of the fake buffer is its byte length, in seconds
    const player = new SoundboardPlayer(
      async () => new ArrayBuffer(30),
      () => audio.context,
    );
    await player.play("long", "u", 1);
    expect(audio.started[0].duration).toBe(SOUND_MAX_MS / 1000);
  });

  it("plays nothing at volume zero and loads nothing for it", async () => {
    const audio = fakeContext();
    const fetch = vi.fn(async () => new ArrayBuffer(1));
    const player = new SoundboardPlayer(fetch, () => audio.context);
    await player.play("s", "u", 0);
    expect(fetch).not.toHaveBeenCalled();
    expect(audio.started).toEqual([]);
  });

  it("lets at most three sounds overlap", async () => {
    const audio = fakeContext();
    const player = new SoundboardPlayer(
      async () => new ArrayBuffer(1),
      () => audio.context,
    );
    for (const id of ["a", "b", "c", "d"]) await player.play(id, id, 1);
    expect(audio.started).toHaveLength(4);
    expect(audio.stopped).toEqual([0]);
    player.stopAll();
    expect(audio.stopped).toEqual([0, 1, 2, 3]);
  });

  it("tries a failed download again next time", async () => {
    const audio = fakeContext();
    const fetch = vi
      .fn<() => Promise<ArrayBuffer>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(new ArrayBuffer(1));
    const player = new SoundboardPlayer(fetch, () => audio.context);
    await expect(player.play("s", "u", 1)).rejects.toThrow("offline");
    await player.play("s", "u", 1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(player.cached).toBe(1);
  });

  it("mixes the sound's own volume with the listener's", () => {
    expect(soundGain(100, 1)).toBe(1);
    expect(soundGain(50, 0.5)).toBe(0.25);
    expect(soundGain(400, 3)).toBe(1);
    expect(soundGain(-5, 1)).toBe(0);
    expect(soundUrl("https://cdn.zrzur.com", "01S")).toBe(
      "https://cdn.zrzur.com/sounds/01S/original",
    );
  });
});
