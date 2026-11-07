import { describe, expect, it } from "vitest";

import { DANGEROUS, isAdminLike, isDangerous } from "./dangerous";

describe("dangerous permissions", () => {
  it("flags manage server, permissions, roles and ban", () => {
    expect(isDangerous("BanMembers")).toBe(true);
    expect(isDangerous("ManageRole")).toBe(true);
    expect(isDangerous("SendMessage")).toBe(false);
  });

  it("calls a role admin-like only with all three manage permissions", () => {
    const all =
      DANGEROUS.ManageServer |
      DANGEROUS.ManagePermissions |
      DANGEROUS.ManageRole;
    expect(isAdminLike(all | (2n ** 22n))).toBe(true);
    expect(isAdminLike(DANGEROUS.ManageServer | DANGEROUS.ManageRole)).toBe(
      false,
    );
  });
});
