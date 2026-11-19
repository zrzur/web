import { describe, expect, it } from "vitest";

import {
  PENDING_MS,
  arrivalPath,
  deadReason,
  forgetInvite,
  memberCount,
  rememberInvite,
  takePendingInvite,
  timeLeft,
} from "./inviteLogic";

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("deadReason", () => {
  it("reads an unknown, used-up or expired link as ended", () => {
    expect(deadReason({ type: "NotFound" })).toBe("ended");
    expect(deadReason("NotFound")).toBe("ended");
    expect(deadReason({ type: "InvalidOperation" })).toBe("ended");
  });

  it("tells a paused server apart", () => {
    expect(deadReason({ type: "InvitesPaused" })).toBe("paused");
  });

  it("does not blame the link for a lost connection", () => {
    expect(deadReason(new TypeError("Failed to fetch"))).toBe("offline");
    expect(deadReason({ type: "InternalError" })).toBe("offline");
    expect(deadReason(undefined)).toBe("offline");
  });
});

describe("arrivalPath", () => {
  it("leads into the invite's channel", () => {
    expect(arrivalPath("S1", "C1")).toBe("/server/S1/channel/C1");
  });
});

describe("memberCount", () => {
  it("groups digits and never goes below zero", () => {
    expect(memberCount(1284, "en")).toBe("1,284");
    expect(memberCount(-3, "en")).toBe("0");
  });

  it("falls back for a locale the browser refuses", () => {
    expect(memberCount(12, "not a locale")).toBe("12");
  });
});

describe("pending invite", () => {
  it("is given back once", () => {
    const s = memory();
    rememberInvite("game-nights", 1_000, s);
    expect(takePendingInvite(2_000, s)).toBe("game-nights");
    expect(takePendingInvite(2_000, s)).toBeUndefined();
  });

  it("is dropped after a day", () => {
    const s = memory();
    rememberInvite("abc123", 0, s);
    expect(takePendingInvite(PENDING_MS + 1, s)).toBeUndefined();
    expect(s.data.size).toBe(0);
  });

  it("refuses anything that is not an invite code", () => {
    const s = memory();
    rememberInvite("../settings", 0, s);
    rememberInvite("a b", 0, s);
    rememberInvite("", 0, s);
    expect(s.data.size).toBe(0);
  });

  it("ignores a stored value someone else wrote", () => {
    for (const raw of [
      "not json",
      JSON.stringify({ code: "/login", at: 5 }),
      JSON.stringify({ code: "abc", at: "5" }),
      JSON.stringify({ code: "abc", at: 10_000_000 }),
    ]) {
      const s = memory();
      s.setItem("zrzur:pending-invite", raw);
      expect(takePendingInvite(10, s)).toBeUndefined();
    }
  });

  it("can be forgotten", () => {
    const s = memory();
    rememberInvite("abc", 0, s);
    forgetInvite(s);
    expect(takePendingInvite(1, s)).toBeUndefined();
  });

  it("works without storage", () => {
    expect(() => rememberInvite("abc", 0, undefined)).not.toThrow();
    expect(takePendingInvite(0, undefined)).toBeUndefined();
  });
});

describe("timeLeft", () => {
  const at = (hours: number) => new Date(hours * 3_600_000).toISOString();

  it("counts whole days while a day or more is left", () => {
    expect(timeLeft(at(72), 0)).toEqual({ unit: "days", count: 3 });
    expect(timeLeft(at(25), 0)).toEqual({ unit: "days", count: 2 });
    expect(timeLeft(at(24), 0)).toEqual({ unit: "days", count: 1 });
  });

  it("counts hours on the last day, and never says zero", () => {
    expect(timeLeft(at(23), 0)).toEqual({ unit: "hours", count: 23 });
    expect(timeLeft(at(0.2), 0)).toEqual({ unit: "hours", count: 1 });
    expect(timeLeft(at(-5), 0)).toEqual({ unit: "hours", count: 1 });
  });
});
