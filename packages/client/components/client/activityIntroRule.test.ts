import { describe, expect, it } from "vitest";

import { shouldAskAboutActivity } from "./activityIntroRule";

describe("the one-time activity question", () => {
  it("asks someone who has never answered and does not share", () => {
    expect(shouldAskAboutActivity({ share_activity: false })).toBe(true);
    expect(shouldAskAboutActivity({})).toBe(true);
  });

  it("never asks again after an answer, Not now included", () => {
    expect(
      shouldAskAboutActivity({
        share_activity: false,
        activity_intro_seen: true,
      }),
    ).toBe(false);
  });

  it("does not ask someone who already shares, or before the answer is in", () => {
    expect(shouldAskAboutActivity({ share_activity: true })).toBe(false);
    expect(shouldAskAboutActivity(undefined)).toBe(false);
  });
});
