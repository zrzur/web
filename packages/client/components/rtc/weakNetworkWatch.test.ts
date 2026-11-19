import { describe, expect, it } from "vitest";

import {
  DEFAULT_WEAK_NETWORK,
  GOOD_NETWORK,
  nextNetworkState,
} from "./weakNetwork";
import {
  type Reading,
  emptyReading,
  readReport,
  sampleFrom,
} from "./weakNetworkWatch";

type Stat = Record<string, unknown>;

/** A reading from the reports of several tracks */
function reading(...reports: Stat[][]): Reading {
  const out = emptyReading();
  for (const report of reports) readReport(out, report);
  return out;
}

const inbound = (ssrc: number, received: number, lost = 0): Stat => ({
  type: "inbound-rtp",
  ssrc,
  packetsReceived: received,
  packetsLost: lost,
});
const outbound = (ssrc: number, sent: number): Stat => ({
  type: "outbound-rtp",
  ssrc,
  packetsSent: sent,
});
const remote = (ssrc: number, lost: number, fractionLost = 0): Stat => ({
  type: "remote-inbound-rtp",
  ssrc,
  packetsLost: lost,
  fractionLost,
  roundTripTime: 0.002,
});
const pair = (rtt: number): Stat => ({
  type: "candidate-pair",
  nominated: true,
  currentRoundTripTime: rtt,
});

describe("reading the counters", () => {
  it("keeps counters per stream and the connection's round trip time", () => {
    const r = reading(
      [inbound(1, 100, 2), pair(0.003)],
      [outbound(9, 50), remote(9, 1), pair(0.004)],
    );
    expect(r.inbound.get("1")).toEqual({ lost: 2, received: 100 });
    expect(r.sent.get("9")).toBe(50);
    expect(r.upLost.get("9")).toBe(1);
    expect(r.rttMs).toBe(4);
  });

  it("takes the round trip time from the connection, not from a stale layer", () => {
    const r = reading([remote(5, 0), { ...remote(6, 0), roundTripTime: 2.5 }]);
    expect(r.rttMs).toBeUndefined();
  });
});

describe("a sample between two readings", () => {
  it("knows nothing at the first reading", () => {
    expect(
      sampleFrom(undefined, reading([inbound(1, 100, 50)]), undefined, 0)
        .lossPercent,
    ).toBe(undefined);
  });

  it("is clean on a clean call", () => {
    const a = reading([inbound(1, 100), outbound(9, 100), remote(9, 0)]);
    const b = reading([inbound(1, 200), outbound(9, 200), remote(9, 0)]);
    expect(sampleFrom(a, b, "excellent", 2000).lossPercent).toBe(0);
  });

  it("ignores a paused simulcast layer whose last report says it lost everything", () => {
    // dynacast paused layer 8: it sends nothing, and its last receiver
    // report keeps fractionLost 1 and an old loss count
    const a = reading([
      outbound(7, 100),
      remote(7, 0),
      outbound(8, 40),
      remote(8, 30, 1),
    ]);
    const b = reading([
      outbound(7, 200),
      remote(7, 0),
      outbound(8, 40),
      remote(8, 30, 1),
    ]);
    expect(sampleFrom(a, b, undefined, 2000).lossPercent).toBe(0);
  });

  it("does not count a stream that appears between two readings", () => {
    // a screen share subscribed meanwhile, with loss counted since its start
    const a = reading([inbound(1, 100)]);
    const b = reading([inbound(1, 200)], [inbound(2, 300, 200)]);
    expect(sampleFrom(a, b, undefined, 2000).lossPercent).toBe(0);
  });

  it("does not count a stream that went away or restarted", () => {
    const a = reading([inbound(1, 100), inbound(2, 500, 10)]);
    const b = reading([inbound(1, 200), inbound(2, 20, 0)]);
    expect(sampleFrom(a, b, undefined, 2000).lossPercent).toBe(0);
  });

  it("says nothing when too few packets moved (silence, paused video)", () => {
    const a = reading([inbound(1, 100), outbound(9, 100), remote(9, 0)]);
    const b = reading([inbound(1, 105, 3), outbound(9, 102), remote(9, 1)]);
    expect(sampleFrom(a, b, undefined, 2000).lossPercent).toBeUndefined();
  });

  it("measures real loss both ways", () => {
    const a = reading([inbound(1, 100, 0), outbound(9, 100), remote(9, 0)]);
    // down: 90 arrived, 10 lost; up: 100 sent, 20 lost
    const down = reading([inbound(1, 190, 10), outbound(9, 100), remote(9, 0)]);
    expect(sampleFrom(a, down, undefined, 2000).lossPercent).toBe(10);
    const up = reading([inbound(1, 200, 0), outbound(9, 200), remote(9, 20)]);
    expect(sampleFrom(a, up, undefined, 2000).lossPercent).toBe(20);
  });
});

describe("a clean call over time", () => {
  it("stays good even with a poor verdict from the voice server", () => {
    let state = GOOD_NETWORK;
    let before: Reading | undefined;
    for (let i = 0; i < 30; i++) {
      const now = reading(
        [inbound(1, 100 * i), pair(0.003)],
        [outbound(9, 100 * i), remote(9, 0), outbound(8, 40), remote(8, 30, 1)],
      );
      state = nextNetworkState(
        state,
        sampleFrom(before, now, i % 2 ? "poor" : "lost", i * 2000),
        DEFAULT_WEAK_NETWORK,
      );
      before = now;
      expect(state.level).toBe("good");
    }
  });
});
