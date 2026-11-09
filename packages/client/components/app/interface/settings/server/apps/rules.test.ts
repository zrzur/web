import { describe, expect, it } from "vitest";

import { EVERYONE, removeRule, setRule, sortRules } from "./rules";

const role = (id: string, permission: boolean) =>
  ({ id, type: "Role", permission }) as const;

describe("command permission rules in the editor", () => {
  it("adds a rule, and replaces the one for the same target", () => {
    let rules = setRule([], role("mods", true));
    rules = setRule(rules, role("muted", false));
    rules = setRule(rules, role("mods", false));
    expect(rules).toEqual([role("mods", false), role("muted", false)]);
  });

  it("keeps a role and a member with the same id apart", () => {
    const rules = setRule([role("x", true)], {
      id: "x",
      type: "Member",
      permission: false,
    });
    expect(rules).toHaveLength(2);
  });

  it("removes one rule", () => {
    const rules = [role("a", true), role("b", false)];
    expect(removeRule(rules, "Role", "a")).toEqual([role("b", false)]);
  });

  it("lists everyone and every channel first, then roles, members, channels", () => {
    const rules = sortRules(
      [
        { id: "c1", type: "Channel", permission: true },
        { id: "u1", type: "Member", permission: true },
        role("r1", true),
        { id: "SERVER", type: "Channel", permission: false },
        role("SERVER", false),
      ],
      "SERVER",
    );
    expect(rules.map((r) => `${r.type}:${r.id}`)).toEqual([
      "Role:SERVER",
      "Channel:SERVER",
      "Role:r1",
      "Member:u1",
      "Channel:c1",
    ]);
    expect(EVERYONE).toBe("everyone");
  });
});
