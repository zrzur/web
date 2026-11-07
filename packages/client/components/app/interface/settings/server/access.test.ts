import type { Server } from "@zrzur/sdk/solid";
import { describe, expect, it } from "vitest";

import { canOpenServerSettings, canSeeMembers } from "./access";

/** A server where this person holds exactly the given permissions */
const server = (permissions: string[], owner = false) =>
  ({
    owner: owner ? { self: true } : undefined,
    havePermission: (permission: string) => permissions.includes(permission),
  }) as unknown as Server;

describe("server settings access", () => {
  it("opens for owners and for every permission that has a page", () => {
    expect(canOpenServerSettings(server([], true))).toBe(true);
    for (const permission of [
      "ManageServer",
      "ManageChannel",
      "ManageRole",
      "ManagePermissions",
      "ManageCustomisation",
      "KickMembers",
      "BanMembers",
      "TimeoutMembers",
      "AssignRoles",
      "ManageNicknames",
      "ViewAuditLogs",
    ])
      expect(canOpenServerSettings(server([permission])), permission).toBe(
        true,
      );
  });

  it("stays closed when no page would show, e.g. webhooks only", () => {
    expect(canOpenServerSettings(server([]))).toBe(false);
    expect(
      canOpenServerSettings(server(["ManageWebhooks", "SendMessage"])),
    ).toBe(false);
  });

  it("shows the member list only to those who act on members", () => {
    expect(canSeeMembers(server(["TimeoutMembers"]))).toBe(true);
    expect(canSeeMembers(server(["ViewAuditLogs"]))).toBe(false);
  });
});
