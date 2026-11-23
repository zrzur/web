import { describe, expect, it } from "vitest";

import {
  FORMATS,
  WAVEFORM_BARS,
  isVoiceMessageName,
  opusTypeOf,
  placeholderBars,
  playableVoiceSrc,
  toBars,
} from "./voice";

describe("voice messages", () => {
  it("recognises only our own voice file names", () => {
    expect(isVoiceMessageName("voice-message-1729890000000.ogg")).toBe(true);
    expect(isVoiceMessageName("voice-message-1729890000000.webm")).toBe(true);
    expect(isVoiceMessageName("voice-message-1.m4a")).toBe(true);
    expect(isVoiceMessageName("SPOILER_voice-message-1.ogg")).toBe(false);
    expect(isVoiceMessageName("voice-message-1.exe")).toBe(false);
    expect(isVoiceMessageName("voice-message.ogg")).toBe(false);
    expect(isVoiceMessageName("song.ogg")).toBe(false);
    expect(isVoiceMessageName(undefined)).toBe(false);
  });

  it("turns samples into normalised bars", () => {
    const samples = Array.from({ length: 4000 }, (_, i) =>
      i < 2000 ? 0.1 : 0.5,
    );
    const bars = toBars(samples);
    expect(bars).toHaveLength(WAVEFORM_BARS);
    expect(Math.max(...bars)).toBeCloseTo(1);
    expect(bars[0]).toBeLessThan(bars[WAVEFORM_BARS - 1]);
    // silence still draws a small bar
    expect(Math.min(...toBars(new Array(4000).fill(0)))).toBeGreaterThan(0);
  });

  it("draws the same stand-in waveform for the same file", () => {
    expect(placeholderBars("a")).toEqual(placeholderBars("a"));
    expect(placeholderBars("a")).not.toEqual(placeholderBars("b"));
    for (const bar of placeholderBars("x")) {
      expect(bar).toBeGreaterThan(0);
      expect(bar).toBeLessThanOrEqual(1);
    }
  });

  it("asks about Opus in the file's own container", () => {
    expect(opusTypeOf("audio/opus")).toBe('audio/ogg; codecs="opus"');
    expect(opusTypeOf("audio/ogg")).toBe('audio/ogg; codecs="opus"');
    expect(opusTypeOf("video/webm")).toBe('audio/webm; codecs="opus"');
    expect(opusTypeOf(undefined, "voice-message-1.webm")).toBe(
      'audio/webm; codecs="opus"',
    );
    expect(opusTypeOf("audio/mp4")).toBe('audio/mp4; codecs="opus"');
  });

  it("plays the AAC copy where the browser can't play the recording", () => {
    const url = "https://cdn.test/attachments/A/original";
    // Safari before 18.4: no Ogg at all
    const oldSafari = (type: string) =>
      type.startsWith("audio/ogg") || type.includes("opus") ? "" : "maybe";
    expect(
      playableVoiceSrc(url, { contentType: "audio/opus" }, oldSafari),
    ).toBe(`${url}?format=m4a`);
    // Chrome, Firefox, Safari 18.4+: the recording itself
    expect(
      playableVoiceSrc(url, { contentType: "audio/opus" }, () => "probably"),
    ).toBe(url);
    expect(
      playableVoiceSrc(`${url}?x=1`, { contentType: "video/webm" }, oldSafari),
    ).toBe(`${url}?x=1&format=m4a`);
  });

  it("records AAC in MP4 first where the browser can", () => {
    expect(FORMATS[0]).toEqual(["audio/mp4;codecs=mp4a.40.2", "m4a"]);
    expect(FORMATS.at(-1)).toEqual(["audio/mp4", "m4a"]);
  });
});
