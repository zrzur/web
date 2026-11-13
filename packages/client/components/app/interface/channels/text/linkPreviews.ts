/** The part of a message the link-preview rules look at */
export type PreviewMessage = {
  embeds?: readonly { type: string }[] | null;
  author?: { self?: boolean; official?: boolean } | null;
  channel?: { havePermission(permission: "ManageMessages"): boolean } | null;
};

/**
 * Whether the message has previews the link check made. A bot's or a
 * webhook's own cards (Text embeds) are part of the message, not previews.
 */
export function hasLinkPreviews(message: PreviewMessage): boolean {
  return (message.embeds ?? []).some((embed) => embed.type !== "Text");
}

/**
 * The author removes the previews of their own message, and anyone who may
 * manage messages removes them from anyone's (not from official messages).
 * Removed previews are gone for everyone and do not come back on edit.
 */
export function canRemoveLinkPreviews(message: PreviewMessage): boolean {
  if (!hasLinkPreviews(message) || message.author?.official) return false;
  return (
    !!message.author?.self ||
    !!message.channel?.havePermission("ManageMessages")
  );
}
