import { describe, expect, it } from "vitest";

import { mayWarm } from "./warmScreens";

describe("warmScreens: when a phone may fetch screens ahead", () => {
  it("fetches ahead when the browser says nothing about the connection", () => {
    expect(mayWarm(undefined)).toBe(true);
  });

  it("fetches ahead on an ordinary connection", () => {
    expect(mayWarm({ effectiveType: "4g" })).toBe(true);
    expect(mayWarm({ effectiveType: "3g", saveData: false })).toBe(true);
  });

  it("does not when the person asked to save data", () => {
    expect(mayWarm({ effectiveType: "4g", saveData: true })).toBe(false);
  });

  it("does not on a very slow connection", () => {
    expect(mayWarm({ effectiveType: "2g" })).toBe(false);
    expect(mayWarm({ effectiveType: "slow-2g" })).toBe(false);
  });
});
