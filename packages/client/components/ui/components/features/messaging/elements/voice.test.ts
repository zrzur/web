import { describe, expect, it } from "vitest";

import {
  WAVEFORM_BARS,
  isVoiceMessageName,
  placeholderBars,
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
});
