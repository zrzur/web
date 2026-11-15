// relative: the unit tests run without the @revolt aliases
import {
  type OwnLinkOptions,
  parseOwnLink,
} from "../../../../modal/modals/ownLink";

/** The part of an embed the own-link rule looks at */
type PreviewEmbed = { type: string; url?: string; originalUrl?: string };

/**
 * A website preview of one of our own invite or bot links. The link shows
 * the server card or the bot card; the preview (the app's page, read by the
 * link check after zrzur.cc sent it there) only repeats generic text.
 * Read on the client, so old messages are fixed too.
 */
export function isOwnLinkPreview(
  embed: PreviewEmbed,
  options?: OwnLinkOptions,
): boolean {
  if (embed.type !== "Website") return false;
  const posted = embed.originalUrl || embed.url;
  return !!posted && !!parseOwnLink(posted, options);
}

/** The embeds a message shows: all but previews of our own links */
export function shownEmbeds<T extends { type: string }>(
  embeds: readonly T[] | null | undefined,
  options?: OwnLinkOptions,
): T[] {
  return (embeds ?? []).filter(
    (embed) => !isOwnLinkPreview(embed as PreviewEmbed, options),
  );
}

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
