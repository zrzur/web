import { describe, expect, it } from "vitest";

import {
  type RingState,
  NO_RINGS,
  RING_TIMEOUT_MS,
  applyRingEvent,
  expireRings,
  outgoingOutcome,
} from "./ringing";

const ME = "ME";
const LINA = "LINA";
const OMAR = "OMAR";
const DM = "DM1";

const start = (initiator = LINA, channel = DM) =>
  ({
    type: "VoiceCallUpdate",
    initiator_id: initiator,
    channel_id: channel,
    ended: false,
  }) as const;
const ringEnd = (user: string, reason: "Declined" | "Missed" | "Answered") =>
  ({ type: "VoiceRingEnd", channel_id: DM, user, reason }) as const;

describe("incoming ring", () => {
  it("rings when someone else starts a call, once per channel", () => {
    let state = applyRingEvent(NO_RINGS, start(), ME, 1);
    state = applyRingEvent(state, start(), ME, 2);
    expect(state.incoming).toEqual([
      { channelId: DM, initiatorId: LINA, at: 2 },
    ]);
  });

  it("never rings for one's own call or before sign-in", () => {
    expect(applyRingEvent(NO_RINGS, start(ME), ME, 1).incoming).toEqual([]);
    expect(applyRingEvent(NO_RINGS, start(), undefined, 1).incoming).toEqual(
      [],
    );
  });

  it("stops when this account declines, answers or misses it", () => {
    for (const reason of ["Declined", "Answered", "Missed"] as const) {
      const state = applyRingEvent(
        applyRingEvent(NO_RINGS, start(), ME, 1),
        ringEnd(ME, reason),
        ME,
        2,
      );
      expect(state.incoming).toEqual([]);
    }
  });

  it("keeps ringing when someone else's ring ends", () => {
    const state = applyRingEvent(
      applyRingEvent(NO_RINGS, start(), ME, 1),
      ringEnd(OMAR, "Declined"),
      ME,
      2,
    );
    expect(state.incoming).toHaveLength(1);
  });

  it("stops when the call ends", () => {
    const state = applyRingEvent(
      applyRingEvent(NO_RINGS, start(), ME, 1),
      { ...start(), ended: true },
      ME,
      2,
    );
    expect(state.incoming).toEqual([]);
  });

  it("gives up by itself after the timeout when no end arrives", () => {
    const state = applyRingEvent(NO_RINGS, start(), ME, 0);
    expect(expireRings(state, RING_TIMEOUT_MS - 1)).toBe(state);
    expect(expireRings(state, RING_TIMEOUT_MS).incoming).toEqual([]);
  });
});

describe("outgoing ring", () => {
  const calling: RingState = {
    incoming: [],
    outgoing: {
      channelId: DM,
      ringing: [LINA, OMAR],
      declined: [],
      missed: [],
      at: 0,
    },
  };

  it("is still open while someone is rung", () => {
    const state = applyRingEvent(calling, ringEnd(LINA, "Declined"), ME, 1);
    expect(state.outgoing?.ringing).toEqual([OMAR]);
    expect(outgoingOutcome(state.outgoing)).toBeUndefined();
  });

  it("says declined when everyone declined", () => {
    let state = applyRingEvent(calling, ringEnd(LINA, "Declined"), ME, 1);
    state = applyRingEvent(state, ringEnd(OMAR, "Declined"), ME, 2);
    expect(outgoingOutcome(state.outgoing)).toBe("declined");
  });

  it("says no answer when anyone missed it and nobody answered", () => {
    let state = applyRingEvent(calling, ringEnd(LINA, "Declined"), ME, 1);
    state = applyRingEvent(state, ringEnd(OMAR, "Missed"), ME, 2);
    expect(outgoingOutcome(state.outgoing)).toBe("missed");
    expect(
      outgoingOutcome(expireRings(calling, RING_TIMEOUT_MS)?.outgoing),
    ).toBe("missed");
  });

  it("an answer is not an outcome (the call goes on)", () => {
    const state = applyRingEvent(
      { ...calling, outgoing: { ...calling.outgoing!, ringing: [LINA] } },
      ringEnd(LINA, "Answered"),
      ME,
      1,
    );
    expect(outgoingOutcome(state.outgoing)).toBeUndefined();
  });

  it("ends with the call", () => {
    const state = applyRingEvent(calling, { ...start(ME), ended: true }, ME, 1);
    expect(state.outgoing).toBeUndefined();
  });
});
