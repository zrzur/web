import { describe, expect, it } from "vitest";

import {
  SOUND_MAX_MS,
  checkSound,
  isOneEmoji,
  nameFromFile,
} from "./soundFile";

const file = (name: string, type: string, size = 1000) =>
  new File([new Uint8Array(size)], name, { type });

describe("picking a soundboard sound", () => {
  it("takes a short MP3, OGG or WAV and gives its length", async () => {
    for (const [name, type] of [
      ["a.mp3", "audio/mpeg"],
      ["b.ogg", "audio/ogg"],
      ["c.wav", "audio/wav"],
    ]) {
      expect(
        await checkSound(file(name, type), 512_000, async () => 1234.4),
      ).toEqual({ durationMs: 1234 });
    }
  });

  it("refuses other types, big files and long sounds before uploading", async () => {
    const measure = async () => 1000;
    expect(
      await checkSound(file("a.flac", "audio/flac"), 512_000, measure),
    ).toEqual({
      problem: "type",
    });
    expect(
      await checkSound(file("a.mp3", "audio/mpeg", 600_000), 512_000, measure),
    ).toEqual({ problem: "size" });
    expect(
      await checkSound(
        file("a.mp3", "audio/mpeg"),
        512_000,
        async () => SOUND_MAX_MS + 1,
      ),
    ).toEqual({ problem: "length" });
  });

  it("says when a file can't be read as sound", async () => {
    expect(
      await checkSound(file("a.mp3", "audio/mpeg"), 512_000, async () => {
        throw new Error("EncodingError");
      }),
    ).toEqual({ problem: "unreadable" });
    expect(
      await checkSound(file("a.mp3", "audio/mpeg"), 512_000, async () => 0),
    ).toEqual({ problem: "unreadable" });
  });

  it("names a sound after its file", () => {
    expect(nameFromFile("air-horn.mp3")).toBe("air horn");
    expect(nameFromFile("drum_roll_2.WAV")).toBe("drum roll 2");
    expect(nameFromFile("x".repeat(50) + ".ogg")).toHaveLength(32);
  });
});

describe("the emoji of a sound", () => {
  it("is one emoji, skin tones and joined emoji included", () => {
    for (const ok of ["🎉", "👍🏽", "❤️", "👩‍💻"])
      expect(isOneEmoji(ok), ok).toBe(true);
    for (const bad of [
      "🎉🎉",
      "tada",
      ":tada:",
      "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      "a🎉",
    ])
      expect(isOneEmoji(bad), bad).toBe(false);
  });
});
