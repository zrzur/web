import { DEFAULT_PERMISSION_SERVER, Permission } from "@zrzur/sdk";
import { describe, expect, it } from "vitest";

import { everyoneOverride, roleOverride, sees } from "./visibility";

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
