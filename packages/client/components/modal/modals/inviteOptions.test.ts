import { describe, expect, it } from "vitest";

import {
  DEFAULT_EXPIRY,
  EXPIRY_CHOICES,
  USES_CHOICES,
  inviteRequest,
  timeLeft,
} from "./inviteOptions";

describe("invite options", () => {
  it("defaults to 7 days and no use limit", () => {
    expect(DEFAULT_EXPIRY).toBe(7 * 24 * 3600);
    expect(inviteRequest(DEFAULT_EXPIRY, 0)).toEqual({
      expiresIn: 604800,
    });
  });

  it("sends the chosen values", () => {
    expect(inviteRequest(1800, 10)).toEqual({ expiresIn: 1800, maxUses: 10 });
    expect(inviteRequest(null, 1)).toEqual({ expiresIn: null, maxUses: 1 });
  });

  it("offers Discord-like choices within the 30-day server limit", () => {
    expect(EXPIRY_CHOICES).toEqual([
      1800,
      3600,
      6 * 3600,
      12 * 3600,
      86400,
      DEFAULT_EXPIRY,
      null,
    ]);
    for (const choice of EXPIRY_CHOICES) {
      if (choice !== null) expect(choice).toBeLessThanOrEqual(30 * 86400);
    }
    expect(USES_CHOICES).toEqual([0, 1, 5, 10, 25, 50, 100]);
  });

  it("says how long an invite has left", () => {
    const now = new Date("2026-11-02T12:00:00Z");
    const at = (ms: number) => new Date(now.getTime() + ms);
    expect(timeLeft(undefined, now)).toEqual({ kind: "never" });
    expect(timeLeft(at(-1), now)).toEqual({ kind: "expired" });
    expect(timeLeft(at(90_000), now)).toEqual({ kind: "minutes", value: 2 });
    expect(timeLeft(at(5 * 3600_000), now)).toEqual({
      kind: "hours",
      value: 5,
    });
    expect(timeLeft(at(3 * 86400_000 + 1), now)).toEqual({
      kind: "days",
      value: 4,
    });
  });
});
