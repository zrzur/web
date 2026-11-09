import { encodeTime } from "ulid";
import { describe, expect, it } from "vitest";

import {
  EPHEMERAL_LIFETIME_MS,
  ephemeralKey,
  forgetStoredEphemeral,
  readStoredEphemeral,
  takeStoredEphemeral,
} from "./ephemeralStorage";

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

/** A Storage in memory */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  };
}

describe("private answers belong to one account", () => {
  it("are kept per user and never shown to another account in the tab", () => {
    const storage = memoryStorage();
    const answer = message(id(NOW - 1000));
    storage.setItem(ephemeralKey("ALICE"), JSON.stringify({ CH: [answer] }));
    expect(takeStoredEphemeral(storage, "ALICE", NOW)).toEqual({
      CH: [answer],
    });
    // another account signs in: nothing of Alice's, and her answers are gone
    expect(takeStoredEphemeral(storage, "BOB", NOW)).toEqual({});
    expect(storage.getItem(ephemeralKey("ALICE"))).toBeNull();
  });

  it("are all forgotten on log out", () => {
    const storage = memoryStorage();
    storage.setItem(ephemeralKey("ALICE"), "{}");
    storage.setItem("other-app-key", "kept");
    forgetStoredEphemeral(storage);
    expect(storage.getItem(ephemeralKey("ALICE"))).toBeNull();
    expect(storage.getItem("other-app-key")).toBe("kept");
  });
});
