import { createStore } from "solid-js/store";

import type { Client } from "@zrzur/sdk/solid";

/**
 * Linked channels: a channel tied to a channel on another platform through
 * a bridge bot that the server's owner runs himself. Zrzur never connects to
 * the other platform and takes no token or webhook address of it; a link
 * only names the bot whose messages are the bridge's.
 *
 * The types mirror `GET|PUT|DELETE /channels/{id}/link`. They live here
 * until the SDK's generated contract carries the routes; the calls go
 * through the client's plain request for the same reason.
 */
export type ChannelLink = {
  channel: string;
  bot: string;
  platform: string;
  by: string;
  at: string;
};

/** `MessageFlags.Bridged` (bit 5): set by the server only */
export const BRIDGED_FLAG = 32;

/** Written on the other platform and carried here by the bridge bot */
export const isBridged = (flags: number | undefined | null) =>
  ((flags ?? 0) & BRIDGED_FLAG) !== 0;

/** Whether this server offers linked channels at all */
export function linkedChannelsOpen(features: unknown) {
  return (features as { linked_channels?: boolean })?.linked_channels === true;
}

/** Why a channel could not be linked, as the settings page words it */
export type LinkRefusal =
  | "not_text"
  | "mature"
  | "private"
  | "not_a_bot"
  | "not_your_bot"
  | "bot_not_member"
  | "not_confirmed"
  | "already_linked"
  | "too_many"
  | "no_permission"
  | "off"
  | "other";

const REASONS: LinkRefusal[] = [
  "not_text",
  "mature",
  "private",
  "not_a_bot",
  "not_your_bot",
  "bot_not_member",
  "not_confirmed",
  "already_linked",
  "too_many",
];

function apiError(error: unknown): { type?: string; reason?: string } {
  let current = error as Record<string, unknown> | undefined;
  for (let depth = 0; depth < 4 && current; depth++) {
    if (typeof current.type === "string")
      return current as { type: string; reason?: string };
    current = (current.cause ?? current.response ?? current.data) as
      | Record<string, unknown>
      | undefined;
  }
  return {};
}

export function linkRefusal(error: unknown): LinkRefusal {
  const { type, reason } = apiError(error);
  switch (type) {
    case "ChannelLinkRefused":
      return REASONS.find((known) => known === reason) ?? "other";
    case "MissingPermission":
      return "no_permission";
    case "FeatureDisabled":
      return "off";
    default:
      return "other";
  }
}

/**
 * The SDK shows a system message it does not know as the text
 * "<kind> is not supported.". Until it knows the two kinds of a link, they
 * are read back out of that text.
 */
export function linkNoticeKind(
  text: string,
): "linked" | "unlinked" | undefined {
  if (text === "channel_linked is not supported.") return "linked";
  if (text === "channel_unlinked is not supported.") return "unlinked";
  return undefined;
}

/**
 * The four things the owner confirms. None is ticked for him; the link is
 * made only with all four.
 */
export const CONFIRMATIONS = [
  "runs_it",
  "notice_posted",
  "not_age_restricted",
  "new_messages_only",
] as const;
export type Confirmation = (typeof CONFIRMATIONS)[number];

export const allConfirmed = (ticked: Partial<Record<Confirmation, boolean>>) =>
  CONFIRMATIONS.every((key) => ticked[key] === true);

// ----- what the app knows about each channel's link -----

/** `null`: asked, not linked. Missing: not asked yet. */
const [links, setLinks] = createStore<Record<string, ChannelLink | null>>({});
const asking = new Set<string>();

/** The link of a channel as far as it is known (reactive) */
export const knownLink = (channelId: string) => links[channelId] ?? undefined;

/** Ask the server once; later calls answer from what is known */
export function loadLink(client: Client, channelId: string, again = false) {
  if (asking.has(channelId)) return;
  if (!again && channelId in links) return;
  asking.add(channelId);
  client.api
    .raw<ChannelLink>("get", `/channels/${channelId}/link`)
    .then((link) => setLinks(channelId, link))
    // not linked, or the answer did not arrive: nothing is claimed
    .catch(() => setLinks(channelId, null))
    .finally(() => asking.delete(channelId));
}

export async function linkChannel(
  client: Client,
  channelId: string,
  bot: string,
) {
  const link = await client.api.raw<ChannelLink>(
    "put",
    `/channels/${channelId}/link`,
    {
      bot,
      runs_it: true,
      notice_posted: true,
      not_age_restricted: true,
      new_messages_only: true,
    },
  );
  setLinks(channelId, link);
  return link;
}

export async function unlinkChannel(client: Client, channelId: string) {
  const result = await client.api.raw<{ removed: number }>(
    "delete",
    `/channels/${channelId}/link`,
  );
  setLinks(channelId, null);
  return result;
}

/** For tests */
export function forgetLinks() {
  for (const id of Object.keys(links)) setLinks(id, undefined!);
}
