/**
 * Where a custom invite link stands, from when its server stopped meeting
 * the rule. Mirrors the server (billing/vanity.rs):
 * - a link held by the Wings level keeps working for 7 days, then pauses;
 *   the name stays reserved until day 90 and is released after that;
 * - any other link (the member and activity rule, official, partner, or
 *   from before the rule) keeps working for 30 days and is then released.
 */
export const VANITY_GRACE_DAYS = 7;
export const VANITY_RESERVE_DAYS = 90;
export const VANITY_NOTICE_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

export type VanityState =
  | { kind: "active" }
  | { kind: "grace"; ends: Date }
  | { kind: "paused"; releasedAt: Date }
  | { kind: "release" };

export function vanityState(
  belowLevelSince: Date | undefined,
  now: Date = new Date(),
  via?: string,
  noticeDays: number = VANITY_NOTICE_DAYS,
): VanityState {
  if (!belowLevelSince) return { kind: "active" };
  const wings = via === "Wings";
  const grace = wings ? VANITY_GRACE_DAYS : noticeDays;
  const reserve = wings ? VANITY_RESERVE_DAYS : noticeDays;
  const since = belowLevelSince.getTime();
  const ends = new Date(since + grace * DAY);
  if (now < ends) return { kind: "grace", ends };
  const releasedAt = new Date(since + reserve * DAY);
  if (now < releasedAt) return { kind: "paused", releasedAt };
  return { kind: "release" };
}
