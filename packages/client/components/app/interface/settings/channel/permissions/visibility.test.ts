import { DEFAULT_PERMISSION_SERVER, Permission } from "@zrzur/sdk";
import { describe, expect, it } from "vitest";

import {
  everyoneOverride,
  hasOwnAccess,
  isEmptyOverride,
  isHiddenFrom,
  listedPeople,
  memberAdd,
  memberRemove,
  roleOverride,
  sees,
} from "./visibility";

const VIEW = Permission.ViewChannel;
const server = DEFAULT_PERMISSION_SERVER;
const open = { a: 0n, d: 0n };
const closed = { a: 0n, d: VIEW };
const plainRole = { permissions: { a: 0n, d: 0n } };
const manager = {
  permissions: { a: Permission.ManageServer | Permission.ManageRole, d: 0n },
};
const wideView = { permissions: { a: VIEW, d: 0n } };

describe("who can see a channel", () => {
  it("an open channel is seen by everyone", () => {
    expect(sees(server, open)).toBe(true);
    expect(sees(server, open, plainRole)).toBe(true);
  });

  it("a private channel is hidden from roles with View on inherit, managers too", () => {
    expect(sees(server, closed)).toBe(false);
    expect(sees(server, closed, manager)).toBe(false);
  });

  it("a role with View allowed server-wide sees private channels, as the API says", () => {
    expect(sees(server, closed, wideView)).toBe(true);
  });

  it("a role let in on the channel sees it", () => {
    expect(
      sees(server, closed, { ...manager, override: { a: VIEW, d: 0n } }),
    ).toBe(true);
  });
});

describe("changing it", () => {
  it("making it private keeps the other bits of the @everyone override", () => {
    const before = { a: Permission.SendMessage, d: Permission.React };
    const after = everyoneOverride(before, true);
    expect(after).toEqual({
      a: Permission.SendMessage,
      d: Permission.React | VIEW,
    });
    expect(everyoneOverride(after, false)).toEqual(before);
  });

  it("letting a role in allows View on the channel and keeps its other bits", () => {
    const override = { a: Permission.SendMessage, d: VIEW };
    const next = roleOverride(server, closed, { ...manager, override }, true);
    expect(next).toEqual({ a: Permission.SendMessage | VIEW, d: 0n });
    expect(sees(server, closed, { ...manager, override: next })).toBe(true);
  });

  it("hiding from a role in a private channel only removes its allow", () => {
    const next = roleOverride(
      server,
      closed,
      { ...manager, override: { a: VIEW, d: 0n } },
      false,
    );
    expect(next).toEqual({ a: 0n, d: 0n });
    expect(sees(server, closed, { ...manager, override: next })).toBe(false);
  });

  it("hiding from a role that would still see it denies View on the channel", () => {
    const next = roleOverride(server, open, plainRole, false);
    expect(next).toEqual({ a: 0n, d: VIEW });
    expect(sees(server, open, { ...plainRole, override: next })).toBe(false);

    const wide = roleOverride(server, closed, wideView, false);
    expect(sees(server, closed, { ...wideView, override: wide })).toBe(false);
  });
});

describe("Administrator", () => {
  const admin = { permissions: { a: Permission.Administrator, d: 0n } };

  it("an administrator role sees a private channel, even one that denies it", () => {
    expect(sees(server, closed, admin)).toBe(true);
    expect(
      sees(server, closed, { ...admin, override: { a: 0n, d: VIEW } }),
    ).toBe(true);
  });

  it("Administrator on a channel override gives nothing", () => {
    expect(
      sees(server, closed, {
        ...plainRole,
        override: { a: Permission.Administrator, d: 0n },
      }),
    ).toBe(false);
  });
});

describe("one person's own access", () => {
  const SEND = Permission.SendMessage;
  const REACT = Permission.React;

  it("adding a person allows View, as letting a role in does", () => {
    expect(memberAdd()).toEqual({ a: VIEW, d: 0n });
    expect(memberAdd()).toEqual(roleOverride(server, closed, plainRole, true));
    expect(memberAdd({ a: SEND, d: VIEW | REACT })).toEqual({
      a: SEND | VIEW,
      d: REACT,
    });
  });

  it("adding then removing gives back the bits there were before", () => {
    const before = { a: SEND, d: REACT };
    const added = memberAdd(before);
    expect(hasOwnAccess(added)).toBe(true);
    expect(memberRemove(added)).toEqual(before);
    expect(hasOwnAccess(memberRemove(added))).toBe(false);
  });

  it("removing the last bit leaves allow 0 / deny 0, which deletes the override", () => {
    const removed = memberRemove(memberAdd());
    expect(removed).toEqual({ a: 0n, d: 0n });
    expect(isEmptyOverride(removed)).toBe(true);
    expect(memberRemove({ a: 0n, d: VIEW })).toEqual({ a: 0n, d: 0n });
  });

  it("removing keeps every bit but View", () => {
    expect(memberRemove({ a: VIEW | SEND, d: REACT })).toEqual({
      a: SEND,
      d: REACT,
    });
    expect(isEmptyOverride({ a: SEND, d: 0n })).toBe(false);
  });

  it("knows who is let in and who is kept out", () => {
    expect(hasOwnAccess({ a: VIEW, d: 0n })).toBe(true);
    expect(hasOwnAccess({ a: SEND, d: 0n })).toBe(false);
    expect(hasOwnAccess(undefined)).toBe(false);
    expect(isHiddenFrom({ a: 0n, d: VIEW })).toBe(true);
    expect(isHiddenFrom({ a: 0n, d: SEND })).toBe(false);
  });

  it("lists people let in on a private channel, and kept out of an open one", () => {
    const overrides = {
      in: { a: VIEW, d: 0n },
      out: { a: 0n, d: VIEW },
      other: { a: SEND, d: 0n },
    };
    expect(listedPeople(overrides, true)).toEqual(["in"]);
    expect(listedPeople(overrides, false)).toEqual(["out"]);
    expect(listedPeople(undefined, true)).toEqual([]);
  });
});
