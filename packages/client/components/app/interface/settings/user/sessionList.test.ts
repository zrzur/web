import { describe, expect, it } from "vitest";

import {
  byLastUsed,
  isAlreadyClosed,
  isAlreadySignedOut,
  readLastUsed,
} from "./sessionList";

describe("readLastUsed", () => {
  it("reads the time each session was last used", () => {
    const map = readLastUsed([
      { _id: "A", last_seen: "2026-11-01T10:00:00.000Z" },
    ]);
    expect(map.get("A")).toEqual(new Date("2026-11-01T10:00:00.000Z"));
  });

  it("keeps sessions an older server sends without a time", () => {
    const map = readLastUsed([{ _id: "A" }]);
    expect(map.has("A")).toBe(true);
    expect(map.get("A")).toBeUndefined();
  });

  it("treats a time it cannot read as missing", () => {
    expect(
      readLastUsed([{ _id: "A", last_seen: "yesterday" }]).get("A"),
    ).toBeUndefined();
  });
});

describe("byLastUsed", () => {
  const session = (id: string, createdAt: string) => ({
    id,
    createdAt: new Date(createdAt),
  });

  it("puts the most recently used first", () => {
    const used = new Map([
      ["old", new Date("2026-01-01")],
      ["new", new Date("2026-11-01")],
    ]);
    const sorted = byLastUsed(
      [session("old", "2026-10-01"), session("new", "2025-01-01")],
      used,
    );
    expect(sorted.map((entry) => entry.id)).toEqual(["new", "old"]);
  });

  it("falls back to when a session was created", () => {
    const sorted = byLastUsed(
      [session("first", "2026-01-01"), session("second", "2026-02-01")],
      new Map(),
    );
    expect(sorted.map((entry) => entry.id)).toEqual(["second", "first"]);
  });

  it("does not change the list it was given", () => {
    const list = [session("a", "2026-01-01"), session("b", "2026-02-01")];
    byLastUsed(list, new Map());
    expect(list.map((entry) => entry.id)).toEqual(["a", "b"]);
  });
});

describe("isAlreadyClosed", () => {
  it("knows the error the server gives for a session that is gone", () => {
    expect(isAlreadyClosed({ type: "UnknownUser" })).toBe(true);
  });

  it("does not hide other errors", () => {
    expect(isAlreadyClosed({ type: "InvalidToken" })).toBe(false);
    expect(isAlreadyClosed(new Error("offline"))).toBe(false);
    expect(isAlreadyClosed(undefined)).toBe(false);
  });
});

describe("isAlreadySignedOut", () => {
  it("knows the error for this device's own session being gone", () => {
    expect(isAlreadySignedOut({ type: "InvalidSession" })).toBe(true);
  });

  it("does not hide a failure to reach the server", () => {
    expect(isAlreadySignedOut({ type: "InternalError" })).toBe(false);
    expect(isAlreadySignedOut(new Error("offline"))).toBe(false);
  });
});
