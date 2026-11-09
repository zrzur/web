import { describe, expect, it } from "vitest";

import { deviceFallback, qualityLevel } from "./callHealth";

describe("connection quality per participant", () => {
  it("shows bars and warns only when the connection is weak or gone", () => {
    expect(qualityLevel("excellent")).toEqual({ bars: 3, warn: false });
    expect(qualityLevel("good")).toEqual({ bars: 2, warn: false });
    expect(qualityLevel("poor")).toEqual({ bars: 1, warn: true });
    expect(qualityLevel("lost")).toEqual({ bars: 0, warn: true });
    // LiveKit says "unknown" before its first measurement: nothing to warn about
    expect(qualityLevel("unknown")).toEqual({ bars: 3, warn: false });
    expect(qualityLevel(undefined)).toEqual({ bars: 3, warn: false });
  });
});

describe("device hot-swap", () => {
  const devices = (...ids: string[]) => ids.map((deviceId) => ({ deviceId }));

  it("falls back to the default device when the chosen one is unplugged", () => {
    expect(
      deviceFallback({
        preferred: "headset",
        active: "headset",
        available: devices("default", "laptop-mic"),
      }),
    ).toEqual({ switchTo: "default", notice: "fallback" });
  });

  it("goes back to the chosen device when it is plugged in again", () => {
    expect(
      deviceFallback({
        preferred: "headset",
        active: "default",
        available: devices("default", "headset"),
      }),
    ).toEqual({ switchTo: "headset", notice: "restored" });
  });

  it("does nothing while things are as chosen", () => {
    expect(
      deviceFallback({
        preferred: "headset",
        active: "headset",
        available: devices("default", "headset"),
      }),
    ).toEqual({});
    // no choice saved: the browser's default follows the system on its own
    expect(
      deviceFallback({
        preferred: undefined,
        active: "default",
        available: devices("default"),
      }),
    ).toEqual({});
    // already on the default after a fallback, still unplugged
    expect(
      deviceFallback({
        preferred: "headset",
        active: "default",
        available: devices("default"),
      }),
    ).toEqual({});
  });

  it("does not switch when no device is left at all", () => {
    expect(
      deviceFallback({
        preferred: "headset",
        active: "headset",
        available: [],
      }),
    ).toEqual({ notice: "fallback" });
  });
});
