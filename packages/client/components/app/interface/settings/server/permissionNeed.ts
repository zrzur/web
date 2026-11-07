import type { Server } from "@zrzur/sdk/solid";

/** The permissions a settings section can ask for */
export type NeededPermission =
  | "ManageServer"
  | "ManageChannel"
  | "ManageRole"
  | "ManageCustomisation"
  | "BanMembers"
  | "ManageWebhooks"
  | "ViewAuditLogs";

/**
 * What to put on a section's `needs`: the permission it takes to change it,
 * or nothing when this person has it (owner always has it).
 */
export const missing = (
  server: Server,
  permission: NeededPermission,
): NeededPermission | undefined =>
  server.havePermission(permission) ? undefined : permission;
