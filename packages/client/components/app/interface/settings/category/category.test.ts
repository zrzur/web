import { describe, expect, it } from "vitest";

import { Permission } from "@zrzur/sdk";

import {
  isPrivateCategory,
  openToEveryone,
  seenByRoleOutside,
} from "./category";

const VIEW = Number(Permission.ViewChannel);

describe("category visibility", () => {
  it("a category with no permissions of its own is open", () => {
    expect(isPrivateCategory(VIEW, {})).toBe(false);
    expect(isPrivateCategory(VIEW, { default_permissions: null })).toBe(false);
  });

  it("denying View Channel to everyone makes it private", () => {
    expect(
      isPrivateCategory(VIEW, { default_permissions: { a: 0, d: VIEW } }),
    ).toBe(true);
  });

  it("a server that hides channels by default hides the category too", () => {
    expect(isPrivateCategory(0, {})).toBe(true);
    expect(
      isPrivateCategory(0, { default_permissions: { a: VIEW, d: 0 } }),
    ).toBe(false);
  });

  it("a channel with its own permissions is open unless it denies View", () => {
    expect(openToEveryone(VIEW, {})).toBe(true);
    expect(
      openToEveryone(VIEW, { defaultPermissions: { a: 0, d: VIEW } }),
    ).toBe(false);
  });

  it("a role kept out of the category but let into a channel is found", () => {
    const view = BigInt(VIEW);
    const hidden = { everyone: { a: 0n, d: view }, roles: {} };
    const role = { id: "r", permissions: { a: 0n, d: 0n } };
    // the channel hides itself from everyone and lets the role in
    expect(
      seenByRoleOutside(
        VIEW,
        hidden,
        { everyone: { a: 0n, d: view }, roles: { r: { a: view, d: 0n } } },
        role,
      ),
    ).toBe(true);
    // the category lets the role in as well: nobody outside sees more
    expect(
      seenByRoleOutside(
        VIEW,
        { ...hidden, roles: { r: { a: view, d: 0n } } },
        { everyone: { a: 0n, d: view }, roles: { r: { a: view, d: 0n } } },
        role,
      ),
    ).toBe(false);
  });
});
