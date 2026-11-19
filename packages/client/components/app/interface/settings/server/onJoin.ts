/**
 * What a server does when someone joins (`/servers/{id}/on_join`): roles
 * given to everyone and a welcome message. The server checks all of it
 * (on_join.rs); this is what the settings screen needs to show it well.
 */

/** As the API stores it */
export type OnJoin = {
  roles?: string[];
  welcome?: { channel: string; content: string };
};

/** What the screen edits */
export type OnJoinDraft = {
  roles: string[];
  welcomeOn: boolean;
  channel: string;
  content: string;
};

export const MAX_ROLES = 5;
export const MAX_WELCOME = 1000;

/** Placeholders the server fills in when it posts the message */
export const MEMBER = "{member}";
export const SERVER = "{server}";

export function draftOf(stored: OnJoin | undefined): OnJoinDraft {
  return {
    roles: [...(stored?.roles ?? [])],
    welcomeOn: !!stored?.welcome,
    channel: stored?.welcome?.channel ?? "",
    content: stored?.welcome?.content ?? "",
  };
}

/** The request body for a draft */
export function bodyOf(draft: OnJoinDraft, confirmPowerful: boolean) {
  return {
    roles: draft.roles,
    ...(draft.welcomeOn
      ? { welcome: { channel: draft.channel, content: draft.content.trim() } }
      : {}),
    ...(confirmPowerful ? { confirm_powerful_roles: true } : {}),
  };
}

/**
 * Permission bits that let a role change the server or act on other
 * members (the same list as the server's): manage channels, server,
 * permissions, roles, customisation; kick, ban, time out; assign roles;
 * manage nicknames, avatars, messages, webhooks; mention everyone or roles;
 * mute, deafen, move; audit log; join requests.
 */
const POWERFUL_BITS = [
  0, 1, 2, 3, 4, 6, 7, 8, 9, 11, 13, 23, 24, 33, 34, 35, 37, 38, 40, 42,
];
const POWERFUL = POWERFUL_BITS.reduce((mask, bit) => mask | (1n << BigInt(bit)), 0n);

/** Whether a role's allowed permissions include a powerful one */
export function isPowerful(allow: number | bigint | undefined) {
  if (allow === undefined) return false;
  try {
    return (BigInt(allow) & POWERFUL) !== 0n;
  } catch {
    // not a whole number: nothing to read
    return false;
  }
}

/** Add or take off a role, keeping the order and the limit */
export function toggleRole(list: string[], id: string) {
  if (list.includes(id)) return list.filter((role) => role !== id);
  return list.length < MAX_ROLES ? [...list, id] : list;
}

/** Put `token` into `text` at the caret, with a space where words would touch */
export function insertAt(text: string, token: string, start: number, end = start) {
  const from = Math.max(0, Math.min(start, text.length));
  const to = Math.max(from, Math.min(end, text.length));
  const before = text.slice(0, from);
  const after = text.slice(to);
  const lead = before && !/\s$/.test(before) ? " " : "";
  const tail = after && !/^[\s.,!?؟،]/.test(after) ? " " : "";
  const value = before + lead + token + tail + after;
  return { value, caret: (before + lead + token).length };
}

/** A channel as a real link in a message */
export const channelLink = (id: string) => `<#${id}>`;

/**
 * The message as a new member will see it, with the viewer standing in for
 * the member
 */
export function previewOf(content: string, viewerId: string, serverName: string) {
  return content
    .split(MEMBER)
    .join(`<@${viewerId}>`)
    .split(SERVER)
    .join(serverName);
}

/** Why the draft cannot be saved yet, if anything */
export function problemOf(
  draft: OnJoinDraft,
): "channel" | "empty" | "long" | undefined {
  if (!draft.welcomeOn) return undefined;
  if (!draft.channel) return "channel";
  const length = [...draft.content.trim()].length;
  if (length === 0) return "empty";
  if (length > MAX_WELCOME) return "long";
  return undefined;
}

/** A channel written as `#name` is dead text: find the ones typed that way */
export function deadChannelNames(content: string, names: string[]) {
  const known = new Set(names.map((name) => name.toLowerCase()));
  const found = new Set<string>();
  // not the id form <#…>, and not part of a longer word
  for (const match of content.matchAll(/(?<![<\p{L}\p{N}_-])#([\p{L}\p{N}_-]+)/gu)) {
    if (known.has(match[1].toLowerCase())) found.add(match[1]);
  }
  return [...found];
}
