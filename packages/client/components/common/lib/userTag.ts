/**
 * Usernames are unique: an account that owns its name carries this tag and
 * the apps show the name alone. An account made before unique usernames keeps
 * its four-digit tag (`name#1234`) until its owner picks a username.
 */
export const UNIQUE_TAG = "0000";

type Named = { username?: string; discriminator?: string } | null | undefined;

/**
 * Whether the account still has a number tag from before unique usernames
 */
export function hasOldTag(user: Named): boolean {
  return !!user?.discriminator && user.discriminator !== UNIQUE_TAG;
}

/**
 * The part after the name: `#1234` for an account with an old tag, nothing
 * for an account that owns its username. `hidden` keeps the digits off screen
 * (streamer mode).
 */
export function userTag(user: Named, hidden = false): string {
  if (!hasOldTag(user)) return "";
  return `#${hidden ? "••••" : user!.discriminator}`;
}

/**
 * What someone types to find the account: `name`, or `name#1234` for an
 * account with an old tag
 */
export function userHandle(user: Named, hidden = false): string {
  return `${user?.username ?? ""}${userTag(user, hidden)}`;
}
