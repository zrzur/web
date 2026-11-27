/** How a bot's profile names its maker, if at all */
export type Creator =
  | { kind: "self"; id: string }
  | { kind: "name"; name: string; avatar?: string; id?: string };

/**
 * Who made a bot, as its profile shows it. The owner sees their own profile
 * there. Anyone else sees the maker (name, picture, a way to their profile)
 * only when the owner chose to show them (`show_creator` puts `creator` on
 * the bot's public page). Nothing while the page loads or for a private bot.
 */
export function creatorShown(
  publicBot:
    | {
        creator?: {
          id?: string;
          username: string;
          displayName?: string;
          avatar?: { createFileURL(): string | undefined };
        };
      }
    | undefined,
  ownerId: string | undefined,
  selfId: string | undefined,
): Creator | undefined {
  if (ownerId && selfId === ownerId) return { kind: "self", id: ownerId };
  const creator = publicBot?.creator;
  if (creator)
    return {
      kind: "name",
      name: creator.displayName ?? creator.username,
      // their own face beside their name, not a letter
      avatar: creator.avatar?.createFileURL(),
      // the owner chose to be shown: their profile opens from here
      id: creator.id,
    };
  return undefined;
}

/**
 * The first fact about a bot. A bot Zrzur runs itself is never called "not
 * verified": the official mark stands above the review of other people's bots.
 */
export function botStanding(
  official: boolean | undefined,
  verified: boolean | undefined,
): "official" | "verified" | "unverified" {
  if (official) return "official";
  return verified ? "verified" : "unverified";
}
