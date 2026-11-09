import { describe, expect, it } from "vitest";

import {
  PERMISSION_GROUPS,
  askedGroups,
  askedPermissions,
  hasBit,
  inviteQuery,
  toggleBit,
} from "./addBotPermissions";

const SEND = 2 ** 22;
const MANAGE_MESSAGES = 2 ** 23;
const BAN = 2 ** 7;

describe("askedPermissions", () => {
  it("uses the bot's default permissions when the dialog is opened without a link (Discover, profile)", () => {
    // the bug: Discover and the profile opened the dialog with no
    // permissions, so the bot joined without a role
    expect(askedPermissions({ defaultPermissions: SEND + BAN })).toBe(
      SEND + BAN,
    );
  });

  it("prefers what an invite link asks for", () => {
    expect(askedPermissions({ defaultPermissions: SEND + BAN }, SEND)).toBe(
      SEND,
    );
  });

  it("asks for nothing when neither is set or the value is not usable", () => {
    expect(askedPermissions({})).toBeUndefined();
    expect(askedPermissions({ defaultPermissions: 0 })).toBeUndefined();
    expect(askedPermissions({ defaultPermissions: -4 })).toBeUndefined();
    expect(askedPermissions({ defaultPermissions: 1.5 })).toBeUndefined();
  });
});

describe("permission bits", () => {
  it("reads and unticks single bits above 2^31", () => {
    const all = SEND + MANAGE_MESSAGES + 2 ** 37;
    expect(hasBit(all, 2 ** 37)).toBe(true);
    expect(hasBit(all, BAN)).toBe(false);
    const without = toggleBit(all, 2 ** 37);
    expect(hasBit(without, 2 ** 37)).toBe(false);
    expect(without).toBe(SEND + MANAGE_MESSAGES);
    expect(toggleBit(without, 2 ** 37)).toBe(all);
  });
});

describe("inviteQuery", () => {
  it("grants permissions only on a server, and only when there are any", () => {
    expect(inviteQuery(true, SEND)).toBe(`?permissions=${SEND}`);
    expect(inviteQuery(true, 0)).toBe("");
    expect(inviteQuery(true, undefined)).toBe("");
    expect(inviteQuery(false, SEND)).toBe("");
  });
});

describe("listing what a bot asks for", () => {
  it("shows every bit that is asked for, in its group or under Other", () => {
    const asked = 2 ** 1 + 2 ** 22 + 2 ** 41 + 2 ** 45 + 2 ** 50;
    const listed = askedGroups(asked);
    const shown = listed.flatMap((group) => group.bits);
    expect(shown.sort((a, b) => a - b)).toEqual(
      [2 ** 1, 2 ** 22, 2 ** 41, 2 ** 45, 2 ** 50].sort((a, b) => a - b),
    );
    expect(listed.find((group) => group.id === "other")?.bits).toEqual([
      2 ** 50,
    ]);
  });

  it("knows a name for every permission the server has", () => {
    const named = PERMISSION_GROUPS.flatMap((group) => group.bits);
    for (const bit of [
      0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 20, 21, 22, 23, 24, 25, 26, 27,
      28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45,
    ]) {
      expect(named).toContain(2 ** bit);
    }
  });
});
