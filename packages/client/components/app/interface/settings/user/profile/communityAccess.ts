import type { Client } from "@zrzur/sdk/solid";
import { withoutNull } from "@zrzur/sdk/solid";

import type { CommunityPermissions, PlatformPermission } from "./communityApi";

/**
 * Who may do what with community designs. Kept apart from `communityApi.ts`
 * (the gallery, the studio, the review queue) because the app's sidebar asks
 * on every start whether to show the studio: this small file is all the
 * first load carries.
 */

/** The signed-in person's design permissions */
export const fetchCommunityPermissions = (client: Client) =>
  client.api.get("/community/permissions").then(withoutNull);

/** Whether the permission list allows something */
export function can(
  perms: CommunityPermissions | undefined,
  permission: PlatformPermission,
) {
  return !!perms?.permissions.includes(permission);
}

/**
 * May publish designs: an active creator. The right to submit alone is not
 * the rank: privileged accounts hold every permission with no creator record.
 */
export function mayCreate(perms: CommunityPermissions | undefined) {
  return perms?.creator === "Active" && can(perms, "cosmetics.submit");
}

/**
 * May open the studio: active creators to work, and suspended creators to
 * see their own designs, read-only. Revoked
 * creators stay out.
 */
export function maySeeStudio(perms: CommunityPermissions | undefined) {
  return mayCreate(perms) || perms?.creator === "Suspended";
}
