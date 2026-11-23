import { describe, expect, it } from "vitest";

import {
  STAGE_DEFAULT,
  STAGE_MIN,
  STAGE_STEP,
  callDuration,
  clampStageHeight,
  phoneCallView,
  reopenPhoneCall,
  setPhoneCallView,
  stageHeightAfterKey,
  stageMax,
  waitingMembers,
} from "./dmCallView";

describe("DM call stage height", () => {
  it("stays between the minimum and 70 % of the view", () => {
    expect(clampStageHeight(40, 800)).toBe(STAGE_MIN);
    expect(clampStageHeight(400, 800)).toBe(400);
    expect(clampStageHeight(900, 800)).toBe(560);
    expect(stageMax(800)).toBe(560);
  });

  it("never goes below the minimum, even in a very short view", () => {
    expect(stageMax(100)).toBe(STAGE_MIN);
    expect(clampStageHeight(500, 100)).toBe(STAGE_MIN);
  });

  it("falls back to the default for a stored value that is not a number", () => {
    expect(clampStageHeight(Number.NaN, 800)).toBe(STAGE_DEFAULT);
  });

  it("moves one step per arrow key and to the ends with Home and End", () => {
    expect(stageHeightAfterKey(300, "ArrowDown", 800)).toBe(300 + STAGE_STEP);
    expect(stageHeightAfterKey(300, "ArrowUp", 800)).toBe(300 - STAGE_STEP);
    expect(stageHeightAfterKey(300, "Home", 800)).toBe(STAGE_MIN);
    expect(stageHeightAfterKey(300, "End", 800)).toBe(560);
    expect(stageHeightAfterKey(300, "Enter", 800)).toBeUndefined();
  });
});

describe("people on the stage who are not in the call", () => {
  it("lists the others, never oneself or who is already in", () => {
    expect(
      waitingMembers(["me", "sara", "omar"], ["me", "omar"], "me"),
    ).toEqual([{ id: "sara", ringing: false }]);
  });

  it("marks who is being rung and puts them first", () => {
    expect(
      waitingMembers(["me", "sara", "omar"], ["me"], "me", ["omar"]),
    ).toEqual([
      { id: "omar", ringing: true },
      { id: "sara", ringing: false },
    ]);
  });
});

describe("phone call view", () => {
  it("starts full screen and follows the room it was set for", () => {
    const first = {};
    const second = {};
    expect(phoneCallView(first)).toBe("full");
    setPhoneCallView(first, "minimised");
    expect(phoneCallView(first)).toBe("minimised");
    // a new call starts full screen again
    expect(phoneCallView(second)).toBe("full");
    setPhoneCallView(first, "chat");
    expect(phoneCallView(first)).toBe("chat");
  });

  it("returns to full screen from the floating card", () => {
    const room = {};
    setPhoneCallView(room, "minimised");
    reopenPhoneCall();
    expect(phoneCallView(room)).toBe("full");
  });
});

describe("call time", () => {
  it("shows minutes and seconds, and hours after an hour", () => {
    expect(callDuration(0)).toBe("0:00");
    expect(callDuration(65_000)).toBe("1:05");
    expect(callDuration(3_725_000)).toBe("1:02:05");
    expect(callDuration(-5)).toBe("0:00");
  });
});
