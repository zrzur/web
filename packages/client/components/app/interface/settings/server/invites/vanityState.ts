/**
 * Where a custom invite link stands, from when its server fell below the
 * level that unlocks it. Mirrors the server (billing/vanity.rs): the link
 * keeps working for 7 days, then pauses; the name stays reserved until
 * day 90 and is released after that.
 */
export const VANITY_GRACE_DAYS = 7;
export const VANITY_RESERVE_DAYS = 90;

const DAY = 24 * 60 * 60 * 1000;

export type VanityState =
  | { kind: "active" }
  | { kind: "grace"; ends: Date }
  | { kind: "paused"; releasedAt: Date }
  | { kind: "release" };

export function vanityState(
  belowLevelSince: Date | undefined,
  now: Date = new Date(),
): VanityState {
  if (!belowLevelSince) return { kind: "active" };
  const since = belowLevelSince.getTime();
  const ends = new Date(since + VANITY_GRACE_DAYS * DAY);
  if (now < ends) return { kind: "grace", ends };
  const releasedAt = new Date(since + VANITY_RESERVE_DAYS * DAY);
  if (now < releasedAt) return { kind: "paused", releasedAt };
  return { kind: "release" };
}
