import { describe, expect, it } from "vitest";

import type { State } from "..";

import { Voice } from "./Voice";

const store = () => new Voice({} as State);

/** A store over a plain object, so getters and setters can be exercised */
function liveStore() {
  const s = new Voice({} as State);
  let data = s.default();
  const state = {
    get: () => data,
    set: (key: string, ...path: unknown[]) => {
      // only the (field, id, value) shape used by the volume setters
      const [field, id, value] = path as [keyof typeof data, string, unknown];
      data = { ...data, [field]: { ...(data[field] as object), [id]: value } };
      void key;
    },
  };
  return new Voice(state as unknown as State);
}

describe("Voice store: volumes and stream audio", () => {
  it("keeps a volume of 0 % (it used to read back as 100 %)", () => {
    const s = liveStore();
    s.setUserVolume("u1", 0);
    s.setScreenShareVolume("u1", 0);
    expect(s.getUserVolume("u1")).toBe(0);
    expect(s.getScreenShareVolume("u1")).toBe(0);
  });

  it("starts at 100 % for people never changed", () => {
    const s = liveStore();
    expect(s.getUserVolume("new")).toBe(1);
    expect(s.getScreenShareVolume("new")).toBe(1);
  });

  it("plays a stream's sound unless the viewer muted it", () => {
    const s = liveStore();
    expect(s.getScreenShareMuted("streamer")).toBe(false);
    s.setScreenShareMuted("streamer", true);
    expect(s.getScreenShareMuted("streamer")).toBe(true);
  });

  it("keeps volumes between 0 and 300 %", () => {
    const s = liveStore();
    s.setUserVolume("a", -1);
    s.setScreenShareVolume("b", 9);
    s.setUserVolume("c", Number.NaN);
    expect(s.getUserVolume("a")).toBe(0);
    expect(s.getScreenShareVolume("b")).toBe(3);
    expect(s.getUserVolume("c")).toBe(1);
  });

  it("keeps saved stream mutes of false when loading", () => {
    const data = new Voice({} as State).clean({
      screenShareMutes: { a: false, b: true },
      userVolumes: { z: 0 },
    });
    expect(data.screenShareMutes).toEqual({ a: false, b: true });
    expect(data.userVolumes).toEqual({ z: 0 });
  });
});

describe("Voice store: push to talk", () => {
  it("starts on voice activity with the ` key ready", () => {
    const data = store().default();
    expect(data.inputMode).toBe("voice");
    expect(data.pttKey).toBe("Backquote");
  });

  it("keeps a saved push-to-talk choice", () => {
    const data = store().clean({ inputMode: "ptt", pttKey: "KeyV" });
    expect(data.inputMode).toBe("ptt");
    expect(data.pttKey).toBe("KeyV");
  });

  it("drops unknown modes and keys that are not allowed", () => {
    const data = store().clean({
      inputMode: "always",
      pttKey: "Escape",
    } as unknown as Parameters<ReturnType<typeof store>["clean"]>[0]);
    expect(data.inputMode).toBe("voice");
    expect(data.pttKey).toBe("Backquote");
    expect(
      store().clean({ pttKey: 5 } as unknown as Parameters<
        ReturnType<typeof store>["clean"]
      >[0]).pttKey,
    ).toBe("Backquote");
  });
});

describe("Voice store: input sensitivity", () => {
  it("starts on automatic with a -50 dB manual threshold ready", () => {
    const data = store().default();
    expect(data.inputSensitivityAuto).toBe(true);
    expect(data.inputThreshold).toBe(-50);
  });

  it("keeps a saved manual threshold", () => {
    const data = store().clean({
      inputSensitivityAuto: false,
      inputThreshold: -37,
    });
    expect(data.inputSensitivityAuto).toBe(false);
    expect(data.inputThreshold).toBe(-37);
  });

  it("keeps thresholds inside the slider range and drops nonsense", () => {
    expect(store().clean({ inputThreshold: -300 }).inputThreshold).toBe(-80);
    expect(store().clean({ inputThreshold: 12 }).inputThreshold).toBe(0);
    const bad = store().clean({
      inputSensitivityAuto: "no",
      inputThreshold: "loud",
    } as unknown as Parameters<ReturnType<typeof store>["clean"]>[0]);
    expect(bad.inputSensitivityAuto).toBe(true);
    expect(bad.inputThreshold).toBe(-50);
  });
});
