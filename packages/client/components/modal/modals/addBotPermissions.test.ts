import { describe, expect, it } from "vitest";

import {
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
