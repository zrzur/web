/**
 * Whether a bot's profile says who made it. Only when the owner chose to
 * show it (`show_creator`, which gives the bot's public page a `creator`),
 * or to the owner on their own bot. While the public page is loading, or for
 * a private bot the reader cannot see, nothing is shown.
 */
export function showsCreator(
  publicBot: { creator?: unknown } | undefined,
  ownerId: string,
  selfId: string | undefined,
) {
  if (!ownerId) return false;
  return !!publicBot?.creator || selfId === ownerId;
}
