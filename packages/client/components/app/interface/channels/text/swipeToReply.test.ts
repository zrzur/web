import { describe, expect, it } from "vitest";

import {
  PULL_ARMED,
  PULL_MAX,
  PULL_START,
  nextPhase,
  pullDistance,
  rowOffset,
} from "./swipeToReply";

describe("pull a message to reply", () => {
  it("pulls to the left in English and to the right in Arabic", () => {
    expect(pullDistance(200, 140, false)).toBe(60);
    expect(pullDistance(200, 260, true)).toBe(60);
    // the other way is the menu's slide: no pull at all
    expect(pullDistance(200, 260, false)).toBe(0);
    expect(pullDistance(200, 140, true)).toBe(0);
  });

  it("the row follows the finger, then gets harder to pull and stops", () => {
    expect(rowOffset(30)).toBe(30);
    expect(rowOffset(PULL_ARMED)).toBe(PULL_ARMED);
    expect(rowOffset(PULL_ARMED + 20)).toBeCloseTo(PULL_ARMED + 7);
    expect(rowOffset(1000)).toBe(PULL_MAX);
  });

  it("a touch that moves up or down first is a scroll, and stays one", () => {
    expect(nextPhase("idle", 0, 14)).toBe("scroll");
    expect(nextPhase("scroll", 200, 0)).toBe("scroll");
  });

  it("a pull starts only once the finger has clearly gone sideways", () => {
    expect(nextPhase("idle", PULL_START, 0)).toBe("idle");
    expect(nextPhase("idle", PULL_START + 1, 2)).toBe("pull");
    // a diagonal drag is not a pull
    expect(nextPhase("idle", 14, 10)).toBe("idle");
    // once it is a pull it stays one, however the finger wanders
    expect(nextPhase("pull", 0, 40)).toBe("pull");
  });
});
