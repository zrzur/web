import type { Server } from "@zrzur/sdk/solid";

/** Permissions that unlock at least one server settings page */
const SETTINGS_PERMISSIONS = [
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
] as const;

/** Whether server settings would show this person at least one page */
export function canOpenServerSettings(server: Server) {
  return (
    !!server.owner?.self ||
    SETTINGS_PERMISSIONS.some((permission) => server.havePermission(permission))
  );
}

/** The member list is for those who act on members */
export function canSeeMembers(server: Server) {
  return (
    [
      "ManageServer",
      "KickMembers",
      "BanMembers",
      "TimeoutMembers",
      "AssignRoles",
      "ManageNicknames",
    ] as const
  ).some((permission) => server.havePermission(permission));
}
