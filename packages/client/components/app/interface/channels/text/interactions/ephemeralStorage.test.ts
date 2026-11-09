import { encodeTime } from "ulid";
import { describe, expect, it } from "vitest";

import { EPHEMERAL_LIFETIME_MS, readStoredEphemeral } from "./ephemeralStorage";

const NOW = 1_800_000_000_000;
const id = (at: number) => `${encodeTime(at, 10)}0000000000000000`;
const message = (_id: string, channel_id = "CH") => ({
  _id,
  interaction_id: "I",
  author: "BOT",
  channel_id,
  content: "only you",
});

describe("private answers after a reload", () => {
  it("come back until they expire", () => {
    const fresh = message(id(NOW - 60_000));
    const old = message(id(NOW - EPHEMERAL_LIFETIME_MS - 1));
    const other = message(id(NOW - 1000), "CH2");
    const raw = JSON.stringify({ CH: [fresh, old], CH2: [other] });
    expect(readStoredEphemeral(raw, NOW)).toEqual({
      CH: [fresh],
      CH2: [other],
    });
  });

  it("drop channels with nothing left, and anything unreadable", () => {
    const old = message(id(NOW - EPHEMERAL_LIFETIME_MS - 1));
    expect(readStoredEphemeral(JSON.stringify({ CH: [old] }), NOW)).toEqual({});
    expect(readStoredEphemeral(null, NOW)).toEqual({});
    expect(readStoredEphemeral("{not json", NOW)).toEqual({});
    expect(readStoredEphemeral(JSON.stringify([1, 2]), NOW)).toEqual({});
    expect(
      readStoredEphemeral(JSON.stringify({ CH: [{ _id: "bad" }] }), NOW),
    ).toEqual({});
  });
});
