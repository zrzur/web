/**
 * Choices for a new invite: how long it lasts and how many people can use
 * it. The server refuses an expiry beyond 30 days; `null` means never.
 */

/** Seconds; the server's default too */
export const DEFAULT_EXPIRY = 7 * 24 * 3600;

/** Seconds until expiry, `null` = never */
export const EXPIRY_CHOICES: (number | null)[] = [
  1800,
  3600,
  6 * 3600,
  12 * 3600,
  86400,
  DEFAULT_EXPIRY,
  null,
];

/** 0 = no limit */
export const USES_CHOICES = [0, 1, 5, 10, 25, 50, 100];

/** The options `Channel.createInvite` takes */
export function inviteRequest(
  expiresIn: number | null,
  maxUses: number,
): { expiresIn: number | null; maxUses?: number } {
  return maxUses ? { expiresIn, maxUses } : { expiresIn };
}

export type TimeLeft =
  | { kind: "never" }
  | { kind: "expired" }
  | { kind: "minutes" | "hours" | "days"; value: number };

/** Time left until an invite expires, rounded up to the largest unit */
export function timeLeft(
  expires: Date | undefined,
  now = new Date(),
): TimeLeft {
  if (!expires) return { kind: "never" };
  const ms = expires.getTime() - now.getTime();
  if (ms <= 0) return { kind: "expired" };
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return { kind: "minutes", value: minutes };
  const hours = Math.ceil(ms / 3600_000);
  if (hours < 24) return { kind: "hours", value: hours };
  return { kind: "days", value: Math.ceil(ms / 86400_000) };
}
