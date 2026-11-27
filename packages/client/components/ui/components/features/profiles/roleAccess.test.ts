import { describe, expect, it } from "vitest";

import {
  type RoleMember,
  canEditRoles,
  canGiveRole,
  rolesWith,
} from "./roleAccess";

function member(options: {
  owner?: boolean;
  assign?: boolean;
  self?: boolean;
  below?: boolean;
  myRank?: number;
}): RoleMember {
  const me: RoleMember = {
    roles: [],
    ranking: options.myRank ?? 5,
    inferiorTo: () => false,
  };
  return {
    roles: ["a"],
    ranking: 10,
    user: { self: options.self },
    inferiorTo: () => !!options.below,
    server: {
      owner: { self: options.owner },
      member: me,
      havePermission: () => !!options.assign,
    },
  };
}

describe("canEditRoles", () => {
  it("lets the owner edit anyone", () => {
    expect(canEditRoles(member({ owner: true }))).toBe(true);
  });
  it("needs Assign Roles, and a member below you or yourself", () => {
    expect(canEditRoles(member({}))).toBe(false);
    expect(canEditRoles(member({ assign: true }))).toBe(false);
    expect(canEditRoles(member({ assign: true, below: true }))).toBe(true);
    expect(canEditRoles(member({ assign: true, self: true }))).toBe(true);
  });
});

describe("canGiveRole", () => {
  it("never gives a bot's own role", () => {
    expect(canGiveRole(member({ owner: true }), { isManaged: true })).toBe(
      false,
    );
  });
  it("gives only roles below your highest one", () => {
    const m = member({ assign: true, below: true, myRank: 5 });
    expect(canGiveRole(m, { rank: 6 })).toBe(true);
    expect(canGiveRole(m, { rank: 5 })).toBe(false);
    expect(canGiveRole(m, { rank: 2 })).toBe(false);
  });
});

describe("rolesWith", () => {
  const known = (id: string) => id !== "gone";
  it("adds and removes one role, dropping unknown ids", () => {
    expect(rolesWith(["a", "gone"], "b", true, known)).toEqual(["a", "b"]);
    expect(rolesWith(["a", "b"], "a", false, known)).toEqual(["b"]);
  });
});
