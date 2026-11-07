import { describe, expect, it } from "vitest";

import {
  INVITE_OTHERS,
  membersCanInvite,
  opensAccess,
  withMemberInvites,
} from "./privacy";

describe("server access changes", () => {
  it("asks for confirmation only when more people can get in", () => {
    expect(opensAccess("Approval", "Open")).toBe(true);
    expect(opensAccess("Locked", "Approval")).toBe(true);
    expect(opensAccess("Locked", "Open")).toBe(true);
    expect(opensAccess("Open", "Approval")).toBe(false);
    expect(opensAccess("Approval", "Locked")).toBe(false);
  });
});

describe("server privacy: who can invite", () => {
  const base = 1n | 2n | INVITE_OTHERS;

  it("reads the default permission", () => {
    expect(membersCanInvite(base)).toBe(true);
    expect(membersCanInvite(base & ~INVITE_OTHERS)).toBe(false);
  });

  it("turns only the invite bit off and on", () => {
    const off = withMemberInvites(base, false);
    expect(off).toBe(1n | 2n);
    expect(withMemberInvites(off, true)).toBe(base);
  });

  it("is a no-op when the bit already matches", () => {
    expect(withMemberInvites(base, true)).toBe(base);
  });

  it("is the API's Invite Others bit (2^25)", () => {
    expect(INVITE_OTHERS).toBe(2n ** 25n);
  });
});
