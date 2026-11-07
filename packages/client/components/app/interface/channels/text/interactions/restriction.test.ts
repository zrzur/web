import { describe, expect, it } from "vitest";

import { restrictionAllows } from "./restriction";

describe("restrictionAllows", () => {
  it("lets anyone use an unrestricted component", () => {
    expect(restrictionAllows(undefined, "u1", [])).toBe(true);
    expect(restrictionAllows({}, "u1", [])).toBe(true);
    expect(restrictionAllows({ users: [], roles: [] }, "u1", [])).toBe(true);
  });

  it("allows listed people and holders of listed roles", () => {
    expect(restrictionAllows({ users: ["u1"] }, "u1", [])).toBe(true);
    expect(restrictionAllows({ roles: ["r1"] }, "u2", ["r0", "r1"])).toBe(true);
  });

  it("refuses everyone else", () => {
    expect(restrictionAllows({ users: ["u1"] }, "u2", [])).toBe(false);
    expect(restrictionAllows({ roles: ["r1"] }, "u2", ["r2"])).toBe(false);
    expect(
      restrictionAllows({ users: ["u1"], roles: ["r1"] }, undefined, []),
    ).toBe(false);
  });
});
