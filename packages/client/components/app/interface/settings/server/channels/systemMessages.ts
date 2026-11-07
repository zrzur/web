/** The automatic messages a server can post, by their API key */
export const SYSTEM_MESSAGE_KEYS = [
  "user_joined",
  "user_left",
  "user_kicked",
  "user_banned",
] as const;

export type SystemMessageKey = (typeof SYSTEM_MESSAGE_KEYS)[number];

export type SystemMessages = Partial<Record<SystemMessageKey, string | null>>;

/**
 * The `system_messages` to save: each message posts to its chosen channel,
 * "none" turns it off. Messages not in `next` keep their current channel.
 */
export function systemMessagesPatch(
  current: SystemMessages | null | undefined,
  next: Record<SystemMessageKey, string>,
): SystemMessages {
  const result: SystemMessages = { ...(current ?? {}) };
  for (const key of SYSTEM_MESSAGE_KEYS) {
    if (next[key] === "none") delete result[key];
    else result[key] = next[key];
  }
  return result;
}
