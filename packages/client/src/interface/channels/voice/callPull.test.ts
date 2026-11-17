import { describe, expect, it } from "vitest";

import { CALL_PULL_DOWN, CALL_PULL_START, nextCallPull } from "./callPull";

describe("drag the call down to put it aside", () => {
  it("starts once the finger has clearly gone down", () => {
    expect(nextCallPull("idle", 0, CALL_PULL_START)).toBe("idle");
    expect(nextCallPull("idle", 2, CALL_PULL_START + 1)).toBe("pull");
  });

  it("a sideways drag is the menu's slide, for the whole touch", () => {
    expect(nextCallPull("idle", 20, 4)).toBe("other");
    expect(nextCallPull("idle", -20, 4)).toBe("other");
    expect(nextCallPull("other", 0, 200)).toBe("other");
  });

  it("a drag up is a scroll of the people, not a pull", () => {
    expect(nextCallPull("idle", 0, -20)).toBe("other");
  });

  it("a diagonal drag waits until it is clearly one or the other", () => {
    expect(nextCallPull("idle", 14, 16)).toBe("idle");
  });

  it("a pull stays a pull, and needs a real distance to count", () => {
    expect(nextCallPull("pull", 60, 5)).toBe("pull");
    expect(CALL_PULL_DOWN).toBeGreaterThanOrEqual(80);
  });
});
