/** How a bot's profile names its maker, if at all */
export type Creator =
  | { kind: "self"; id: string }
  | { kind: "name"; name: string };

/**
 * Who made a bot, as its profile shows it. The owner sees their own profile
 * there. Anyone else sees the maker's name only when the owner chose to show
 * it (`show_creator` puts `creator` on the bot's public page); they never get
 * the owner's account id. Nothing while the page loads or for a private bot.
 */
export function creatorShown(
  publicBot:
    | { creator?: { username: string; displayName?: string } }
    | undefined,
  ownerId: string | undefined,
  selfId: string | undefined,
): Creator | undefined {
  if (ownerId && selfId === ownerId) return { kind: "self", id: ownerId };
  const creator = publicBot?.creator;
  if (creator)
    return { kind: "name", name: creator.displayName ?? creator.username };
  return undefined;
}
