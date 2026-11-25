import type { Server } from "@zrzur/sdk/solid";

/**
 * Whether Server settings shows the Verified Server section: to the owner
 * only, and only while the server takes badge applications
 * (`badge_applications`, off by default). Otherwise it shows nothing.
 */
export function showsVerifiedServer(
  server: Pick<Server, "owner">,
  open: boolean,
): boolean {
  return open && !!server.owner?.self;
}
