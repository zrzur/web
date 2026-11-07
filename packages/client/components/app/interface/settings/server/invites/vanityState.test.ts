import { describe, expect, it } from "vitest";

import { VANITY_GRACE_DAYS, vanityState } from "./vanityState";

const DAY = 24 * 60 * 60 * 1000;

describe("vanityState (same timeline as the server)", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  const ago = (days: number) => new Date(now.getTime() - days * DAY);

  it("is active while the server holds the level", () => {
    expect(vanityState(undefined, now)).toEqual({ kind: "active" });
  });

  it("keeps working for 7 days after the drop", () => {
    expect(vanityState(ago(3), now)).toEqual({
      kind: "grace",
      ends: new Date(ago(3).getTime() + VANITY_GRACE_DAYS * DAY),
    });
  });

  it("pauses after that and keeps the name until day 90", () => {
    expect(vanityState(ago(8), now).kind).toBe("paused");
    expect(vanityState(ago(89), now)).toEqual({
      kind: "paused",
      releasedAt: new Date(ago(89).getTime() + 90 * DAY),
    });
  });

  it("releases the name after 90 days", () => {
    expect(vanityState(ago(91), now)).toEqual({ kind: "release" });
  });
});
