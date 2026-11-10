import { ulid } from "ulid";
import { describe, expect, it } from "vitest";

import {
  BULK_DELETE_MAX,
  BULK_DELETE_MAX_AGE_MS,
  pickAll,
  pickRecent,
  selectRange,
  splitByAge,
  toggleSelected,
} from "./messageSelection";

const NOW = Date.UTC(2026, 10, 9, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const at = (msAgo: number) => ulid(NOW - msAgo);

describe("pickAll", () => {
  it("takes every loaded message a bulk delete still takes", () => {
    const fresh = [at(3_000), at(2_000), at(1_000)];
    const old = at(8 * DAY);
    const result = pickAll([old, ...fresh], NOW);
    expect([...result.ids].sort()).toEqual([...fresh].sort());
    expect(result.full).toBe(false);
  });

  it("keeps the newest when there are more than the limit", () => {
    const ordered = Array.from({ length: BULK_DELETE_MAX + 5 }, (_, i) =>
      at((BULK_DELETE_MAX + 5 - i) * 1000),
    );
    const result = pickAll(ordered, NOW);
    expect(result.ids.size).toBe(BULK_DELETE_MAX);
    expect(result.full).toBe(true);
    expect(result.ids.has(ordered.at(-1)!)).toBe(true);
    expect(result.ids.has(ordered[0])).toBe(false);
  });
});

describe("toggleSelected", () => {
  it("adds and removes one message", () => {
    const one = toggleSelected(new Set(), "a");
    expect([...one.ids]).toEqual(["a"]);
    expect(one.full).toBe(false);
    expect([...toggleSelected(one.ids, "a").ids]).toEqual([]);
  });

  it("stops at the backend limit and says so", () => {
    const ids = new Set(
      Array.from({ length: BULK_DELETE_MAX }, (_, i) => `m${i}`),
    );
    const result = toggleSelected(ids, "extra");
    expect(result.full).toBe(true);
    expect(result.ids.size).toBe(BULK_DELETE_MAX);
    expect(result.ids.has("extra")).toBe(false);
  });

  it("removing still works when full", () => {
    const ids = new Set(
      Array.from({ length: BULK_DELETE_MAX }, (_, i) => `m${i}`),
    );
    expect(toggleSelected(ids, "m0").ids.size).toBe(BULK_DELETE_MAX - 1);
  });
});

describe("selectRange", () => {
  const ordered = ["a", "b", "c", "d", "e"];

  it("adds everything between the anchor and the target, either way", () => {
    expect(
      [...selectRange(new Set(["b"]), ordered, "b", "d").ids].sort(),
    ).toEqual(["b", "c", "d"]);
    expect(
      [...selectRange(new Set(["d"]), ordered, "d", "a").ids].sort(),
    ).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps what was selected before", () => {
    expect(
      [...selectRange(new Set(["e"]), ordered, "a", "b").ids].sort(),
    ).toEqual(["a", "b", "e"]);
  });

  it("toggles only the target without a known anchor", () => {
    expect([...selectRange(new Set(), ordered, undefined, "c").ids]).toEqual([
      "c",
    ]);
    expect([...selectRange(new Set(), ordered, "zz", "c").ids]).toEqual(["c"]);
  });

  it("never goes past the limit", () => {
    const many = Array.from({ length: BULK_DELETE_MAX + 20 }, (_, i) =>
      String(i).padStart(4, "0"),
    );
    const result = selectRange(new Set(), many, many[0], many[many.length - 1]);
    expect(result.ids.size).toBe(BULK_DELETE_MAX);
    expect(result.full).toBe(true);
  });
});

describe("splitByAge", () => {
  it("leaves out messages the server refuses (older than 7 days)", () => {
    const fresh = at(DAY);
    const old = at(8 * DAY);
    const { deletable, tooOld } = splitByAge([fresh, old], NOW);
    expect(deletable).toEqual([fresh]);
    expect(tooOld).toEqual([old]);
  });

  it("keeps a margin before the limit so a slow request is not refused", () => {
    const edge = at(BULK_DELETE_MAX_AGE_MS - 30_000);
    expect(splitByAge([edge], NOW).tooOld).toEqual([edge]);
  });

  it("treats ids that are not ULIDs as too old", () => {
    expect(splitByAge(["not-an-id"], NOW).tooOld).toEqual(["not-an-id"]);
  });
});

describe("pickRecent", () => {
  const messages = [
    { id: at(5 * 60_000), authorId: "x" },
    { id: at(4 * 60_000), authorId: "y" },
    { id: at(3 * 60_000), authorId: "x" },
    { id: at(2 * 60_000), authorId: "y" },
    { id: at(60_000), authorId: "x" },
  ];

  it("takes the newest messages first", () => {
    expect(pickRecent(messages, 2, undefined, NOW)).toEqual([
      messages[4].id,
      messages[3].id,
    ]);
  });

  it("only from one member when asked", () => {
    expect(pickRecent(messages, 10, "y", NOW)).toEqual([
      messages[3].id,
      messages[1].id,
    ]);
  });

  it("skips messages too old to delete and never passes the limit", () => {
    const old = { id: at(9 * DAY), authorId: "x" };
    expect(pickRecent([old, ...messages], 10, "x", NOW)).not.toContain(old.id);
    const many = Array.from({ length: 150 }, (_, i) => ({
      id: at((i + 1) * 1000),
      authorId: "x",
    }));
    expect(pickRecent(many, 500, undefined, NOW)).toHaveLength(BULK_DELETE_MAX);
  });
});
