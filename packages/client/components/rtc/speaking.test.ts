import { describe, expect, it, vi } from "vitest";

vi.mock("solid-livekit-components", () => ({
  useIsSpeaking: () => () => false,
}));

import { HOLD_MS, nextSpeaking, packetLevel } from "./speaking";

const receiver = (sources: Partial<RTCRtpSynchronizationSource>[]) => ({
  getSynchronizationSources: () => sources as RTCRtpSynchronizationSource[],
});

describe("speaking, measured here", () => {
  it("reads the level of the newest packet", () => {
    const now = 10_000;
    expect(
      packetLevel(receiver([{ audioLevel: 0.2, timestamp: now - 20 }]), now),
    ).toBe(0.2);
  });

  it("takes an old packet as silence (a silent sender sends nothing)", () => {
    const now = 10_000;
    expect(
      packetLevel(receiver([{ audioLevel: 0.5, timestamp: now - 2000 }]), now),
    ).toBeUndefined();
  });

  it("understands timestamps counted from 1970", () => {
    const now = 10_000;
    const epoch = performance.timeOrigin + now - 10;
    expect(
      packetLevel(receiver([{ audioLevel: 0.3, timestamp: epoch }]), now),
    ).toBe(0.3);
  });

  it("lights at once and keeps the ring through a short gap", () => {
    let state = { speaking: false, lastLoudMs: 0 };
    state = nextSpeaking(state, true, 1000);
    expect(state.speaking).toBe(true);
    state = nextSpeaking(state, false, 1000 + HOLD_MS - 50);
    expect(state.speaking).toBe(true);
    state = nextSpeaking(state, false, 1000 + HOLD_MS + 10);
    expect(state.speaking).toBe(false);
  });
});
