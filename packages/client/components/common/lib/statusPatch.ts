import type { API } from "@zrzur/sdk/solid";

// Only the "Set your status" dialog (lazy) needs these, so they stay out of
// the shell that statusWrite.ts is part of.

/** When a custom status clears itself */
export type StatusExpiry = "never" | "30m" | "1h" | "4h" | "today";

export const STATUS_EXPIRIES: StatusExpiry[] = [
  "never",
  "30m",
  "1h",
  "4h",
  "today",
];

const MINUTE = 60_000;

/**
 * The time a status set now with this choice runs out ("today" is the next
 * local midnight, at least a minute away)
 */
export function statusExpiresAt(
  expiry: StatusExpiry,
  now = new Date(),
): string | undefined {
  const at = (minutes: number) =>
    new Date(now.getTime() + minutes * MINUTE).toISOString();
  switch (expiry) {
    case "30m":
      return at(30);
    case "1h":
      return at(60);
    case "4h":
      return at(240);
    case "today": {
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      return new Date(
        Math.max(midnight.getTime(), now.getTime() + MINUTE),
      ).toISOString();
    }
    default:
      return undefined;
  }
}

/**
 * The edit that sets a custom status. Text, emoji and expiry go together
 * and always replace the old ones (remove StatusText, then set); nothing at
 * all clears it.
 */
export function customStatusPatch(
  text: string,
  options: {
    emoji?: string;
    expiry?: StatusExpiry;
    /** Keep this expiry (the one already set) instead of a new choice */
    keepExpiresAt?: string;
    now?: Date;
  } = {},
): API.DataEditUser {
  const value = text.trim();
  const emoji = options.emoji || undefined;
  if (!value && !emoji) return { remove: ["StatusText"] };

  const status: NonNullable<API.DataEditUser["status"]> = {};
  if (value) status.text = value;
  if (emoji) status.emoji = emoji;
  const kept =
    options.keepExpiresAt &&
    Date.parse(options.keepExpiresAt) > (options.now ?? new Date()).getTime()
      ? options.keepExpiresAt
      : undefined;
  const expiresAt =
    kept ?? statusExpiresAt(options.expiry ?? "never", options.now);
  if (expiresAt) status.expires_at = expiresAt;

  // always an explicit replacement: the old text, emoji and expiry go first,
  // so removing the emoji or choosing Never with the same text takes effect
  // (the server keeps them for a bare repeat of the same text)
  return { status, remove: ["StatusText"] };
}
