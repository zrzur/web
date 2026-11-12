import { describe, expect, it } from "vitest";

import type { AccountAge } from "@zrzur/sdk/solid";

import {
  isAgeRefusal,
  isUnderMinimumAge,
  accountAge,
  canViewMature,
  directMessagesFriendsOnly,
  fromBirthMonth,
  matureAccess,
  resetAccountAge,
  setAccountAge,
  setAgePromptDismissed,
  shouldAskForAge,
  toBirthMonth,
} from "./age";

const adult: AccountAge = {
  birth_month: "1990-03",
  band: "adult_declared",
  mature_access: "allowed",
  can_raise: true,
};

const unknown: AccountAge = {
  band: "unknown",
  mature_access: "age_unknown",
  can_raise: false,
};

describe("birth month", () => {
  it("formats as YYYY-MM", () => {
    expect(toBirthMonth(1990, 3)).toBe("1990-03");
    expect(toBirthMonth(2008, 12)).toBe("2008-12");
  });

  it("round-trips", () => {
    expect(fromBirthMonth(toBirthMonth(2001, 7))).toEqual({
      year: 2001,
      month: 7,
    });
  });
});

describe("mature content", () => {
  it("stays closed while the age is loading or unknown", () => {
    resetAccountAge();
    expect(accountAge()).toBeUndefined();
    expect(canViewMature()).toBe(false);
    expect(matureAccess()).toBe("age_unknown");

    setAccountAge(null);
    expect(canViewMature()).toBe(false);

    setAccountAge(unknown);
    expect(canViewMature()).toBe(false);
  });

  it("follows the server's answer only", () => {
    setAccountAge(adult);
    expect(canViewMature()).toBe(true);

    setAccountAge({ ...adult, band: "teen", mature_access: "minor" });
    expect(canViewMature()).toBe(false);

    // a declared adult on an instance that needs a real age check
    setAccountAge({ ...adult, mature_access: "verification_required" });
    expect(canViewMature()).toBe(false);
  });
});

describe("age prompt", () => {
  it("never asks by itself after signing in", () => {
    resetAccountAge();
    setAccountAge(unknown);
    expect(shouldAskForAge()).toBe(false);
  });

  it("asks unknown ages only once opened, and closes again", () => {
    resetAccountAge();
    setAccountAge(unknown);

    // e.g. "Add month and year" on the age gate
    setAgePromptDismissed(false);
    expect(shouldAskForAge()).toBe(true);

    setAgePromptDismissed(true);
    expect(shouldAskForAge()).toBe(false);

    // signing out closes it
    setAgePromptDismissed(false);
    resetAccountAge();
    setAccountAge(unknown);
    expect(shouldAskForAge()).toBe(false);
  });

  it("does not ask when an age is on record", () => {
    resetAccountAge();
    setAccountAge(adult);
    setAgePromptDismissed(false);
    expect(shouldAskForAge()).toBe(false);
  });
});

describe("isUnderMinimumAge", () => {
  const now = new Date(2026, 10, 3); // November 2026

  it("is true below 16 and false from 16", () => {
    expect(isUnderMinimumAge("2014-05", now)).toBe(true);
    expect(isUnderMinimumAge("2010-12", now)).toBe(true);
    // born this month 16 years ago still counts as under 16 (the server
    // counts a birthday once its month is over)
    expect(isUnderMinimumAge("2010-11", now)).toBe(true);
    expect(isUnderMinimumAge("2010-10", now)).toBe(false);
    expect(isUnderMinimumAge("1990-01", now)).toBe(false);
  });

  it("ignores a value that is not a month", () => {
    expect(isUnderMinimumAge("", now)).toBe(false);
  });
});

describe("isAgeRefusal", () => {
  it("recognises the refusal as text or as an object", () => {
    expect(isAgeRefusal('{"type":"AgeRequirementNotMet"}')).toBe(true);
    expect(isAgeRefusal({ type: "AgeRequirementNotMet" })).toBe(true);
    expect(isAgeRefusal({ type: "AgeNotDeclared" })).toBe(false);
    expect(isAgeRefusal(undefined)).toBe(false);
  });
});

describe("direct messages under 18 (PR-9)", () => {
  it("offers friends only to people aged 16 or 17 and below the minimum", () => {
    const teen: AccountAge = { ...adult, band: "teen", mature_access: "minor" };
    const under: AccountAge = { ...teen, band: "under_minimum" };
    expect(directMessagesFriendsOnly(teen)).toBe(true);
    expect(directMessagesFriendsOnly(under)).toBe(true);
    expect(directMessagesFriendsOnly(adult)).toBe(false);
    expect(directMessagesFriendsOnly(unknown)).toBe(false);
    expect(directMessagesFriendsOnly(null)).toBe(false);
    expect(directMessagesFriendsOnly(undefined)).toBe(false);
  });
});
