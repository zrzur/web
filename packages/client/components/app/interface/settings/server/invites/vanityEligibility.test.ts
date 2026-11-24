import { describe, expect, it } from "vitest";

import { eligibilityFromError } from "./vanityEligibility";

const refused = {
  type: "VanityNotEligible",
  missing: "Members",
  members: 12,
  min_members: 1000,
  messages: 340,
  min_messages: 100,
  authors: 25,
  min_authors: 20,
  days: 30,
};

describe("eligibilityFromError", () => {
  it("reads the numbers of a refused claim", () => {
    expect(eligibilityFromError(refused)).toEqual({
      eligible: false,
      missing: "Members",
      members: 12,
      minMembers: 1000,
      messages: 340,
      minMessages: 100,
      authors: 25,
      minAuthors: 20,
      days: 30,
      linkEndsAt: undefined,
    });
  });

  it("reads the body inside an SDK error", () => {
    expect(eligibilityFromError({ data: refused })?.members).toBe(12);
  });

  it("ignores every other error", () => {
    expect(eligibilityFromError({ type: "VanityTaken" })).toBeUndefined();
    expect(eligibilityFromError(new Error("offline"))).toBeUndefined();
    expect(eligibilityFromError(undefined)).toBeUndefined();
  });

  it("never invents a missing part it does not know", () => {
    expect(
      eligibilityFromError({ ...refused, missing: "Something" })?.missing,
    ).toBe("Both");
  });
});
