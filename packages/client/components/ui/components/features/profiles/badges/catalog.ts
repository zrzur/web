/**
 * Zrzur badge catalogue: the bits of `User.badges` and how each badge
 * looks. Mirrors `BADGE_CATALOGUE` in the backend
 * (crates/core/database/src/models/badges/logic.rs); the backend decides
 * who holds what, this only draws it.
 */

export type BadgeShape =
  | "square"
  | "hex"
  | "rosette"
  | "circle"
  | "gem"
  | "banner";

export type BadgeId =
  | "staff"
  | "founder"
  | "developer"
  | "platform_moderator"
  | "partner"
  | "one_year"
  | "three_years"
  | "community_builder"
  | "big_community"
  | "verified_server_owner"
  | "verified_bot_developer"
  | "saha_champion"
  | "community_helper"
  | "super_creator"
  | "creator"
  | "elite_bug_hunter"
  | "bug_hunter"
  | "beta_tester"
  | "beta_veteran"
  | "plus"
  | "early_supporter"
  | "early_adopter"
  | "translator"
  | "responsible_disclosure"
  | "supporter"
  | "reserved_1"
  | "reserved_2";

/** Badges that come from the place you are in, not from `User.badges` */
export type ContextBadgeId =
  | "server_owner"
  | "server_official"
  | "server_verified"
  | "bot_verified";

export type AnyBadgeId = BadgeId | ContextBadgeId;

/** The one size scale for badge art, in px, on the 4 px grid */
export const BADGE_SIZES = {
  /** dense rows: member rows, the server header, Discover cards */
  xs: 16,
  /** next to names, in tooltips and small lists */
  sm: 20,
  /** the profile card: a little larger than next to a name */
  card: 24,
  /** settings row icons */
  md: 32,
  /** tiles and page headings */
  lg: 40,
  /** the collection shelf */
  xl: 48,
} as const;

export type BadgeSize = keyof typeof BADGE_SIZES;

export type BadgeMeta = {
  id: AnyBadgeId;
  /** 0 for contextual badges */
  bit: number;
  /** 0 regular, 1 rare, 2 top tier */
  tier: 0 | 1 | 2;
  /** lower is shown first */
  priority: number;
  shape: BadgeShape;
  /** two stops: lit, then deep */
  colours: [string, string];
  /** ring around rare badges */
  ring?: string;
  /** no longer given out */
  retired?: boolean;
};

export const BADGE_BITS = {
  developer: 1,
  translator: 2,
  early_supporter: 4,
  responsible_disclosure: 8,
  founder: 16,
  platform_moderator: 32,
  supporter: 64,
  // 128 was the old Revolt "Paw" joke badge: removed for good (owner, 2026-11-12); the bit is never shown or reused
  early_adopter: 256,
  reserved_1: 512,
  reserved_2: 1024,
  plus: 2048,
  creator: 4096,
  super_creator: 8192,
  bug_hunter: 16384,
  elite_bug_hunter: 32768,
  beta_tester: 65536,
  beta_veteran: 131072,
  staff: 262144,
  partner: 524288,
  one_year: 1048576,
  three_years: 2097152,
  community_builder: 4194304,
  big_community: 8388608,
  verified_server_owner: 16777216,
  verified_bot_developer: 33554432,
  saha_champion: 67108864,
  community_helper: 134217728,
} as const satisfies Record<BadgeId, number>;

const meta = (
  id: BadgeId,
  tier: BadgeMeta["tier"],
  priority: number,
  shape: BadgeShape,
  colours: BadgeMeta["colours"],
  extra: Partial<BadgeMeta> = {},
): BadgeMeta => ({
  id,
  bit: BADGE_BITS[id],
  tier,
  priority,
  shape,
  colours,
  ...extra,
});

/**
 * Families: the team in violet and ink, builders in blues, creators in
 * orchid, bug hunters in copper and gold, beta in sky and bronze, Feather
 * in its crimson. Every badge has two stops (lit
 * top-left, deeper bottom-right); top-tier rosettes carry a light ring.
 */
export const BADGES: BadgeMeta[] = [
  meta("founder", 2, 5, "hex", ["#454B6E", "#1F2338"], { ring: "#D9DCEB" }),
  meta("staff", 2, 10, "rosette", ["#9F88FF", "#5E46C8"], { ring: "#E4DDFF" }),
  meta("developer", 1, 20, "hex", ["#5C9BEA", "#2F63B8"]),
  meta("platform_moderator", 1, 25, "hex", ["#4F8DB8", "#2C5D80"]),
  meta("partner", 1, 30, "hex", ["#4A9DB3", "#2A6C83"], { ring: "#A7DCE6" }),
  meta("super_creator", 2, 40, "gem", ["#CF7BEB", "#7A52E0"], {
    ring: "#F1DDFF",
  }),
  meta("creator", 1, 45, "hex", ["#A783F0", "#6E4FC9"]),
  meta("verified_server_owner", 1, 46, "hex", ["#5E86C4", "#3A5F9A"]),
  meta("verified_bot_developer", 1, 47, "hex", ["#6FB0C9", "#3F7890"]),
  meta("saha_champion", 1, 48, "hex", ["#E3B93F", "#A97F1C"]),
  meta("elite_bug_hunter", 2, 50, "banner", ["#E8B04A", "#B0702A"], {
    ring: "#FFE3A6",
  }),
  meta("community_helper", 1, 52, "hex", ["#E08A7A", "#B0503F"]),
  meta("bug_hunter", 1, 55, "hex", ["#D4924A", "#9C5F27"]),
  meta("big_community", 1, 57, "hex", ["#7C8FD0", "#4A5BA0"]),
  meta("community_builder", 0, 58, "square", ["#C97F6A", "#8F4B3A"]),
  meta("beta_tester", 0, 60, "square", ["#5DB0D4", "#2F7899"]),
  meta("beta_veteran", 1, 65, "hex", ["#C09A5E", "#7D5F31"], {
    ring: "#EAD39E",
  }),
  meta("plus", 1, 70, "hex", ["#D92654", "#AD1A40"]),
  meta("early_supporter", 1, 75, "hex", ["#DD6F88", "#9E4058"]),
  meta("early_adopter", 0, 80, "square", ["#7DAA62", "#4C7240"]),
  meta("three_years", 1, 82, "hex", ["#4F9A7A", "#2C6A4F"]),
  meta("one_year", 0, 83, "square", ["#6FA8A0", "#3D746C"]),
  meta("translator", 0, 90, "square", ["#7290B3", "#4B6687"], {
    retired: true,
  }),
  meta("responsible_disclosure", 1, 91, "hex", ["#6E7890", "#474F63"], {
    retired: true,
  }),
  meta("supporter", 0, 92, "square", ["#A6819A", "#755467"], { retired: true }),
  meta("reserved_1", 0, 94, "square", ["#7E8396", "#555A6B"], {
    retired: true,
  }),
  meta("reserved_2", 0, 95, "square", ["#7E8396", "#555A6B"], {
    retired: true,
  }),
];

const context = (
  id: ContextBadgeId,
  priority: number,
  shape: BadgeShape,
  colours: BadgeMeta["colours"],
  extra: Partial<BadgeMeta> = {},
): BadgeMeta => ({ id, bit: 0, tier: 1, priority, shape, colours, ...extra });

/** Drawn from who owns what and from server or bot flags */
export const CONTEXT_BADGES: BadgeMeta[] = [
  context("server_owner", 35, "hex", ["#C79A4C", "#8F6A2C"]),
  context("server_official", 0, "rosette", ["#454B6E", "#1F2338"], {
    ring: "#D9DCEB",
  }),
  context("server_verified", 1, "rosette", ["#5E86C4", "#3A5F9A"]),
  context("bot_verified", 1, "rosette", ["#5E86C4", "#3A5F9A"]),
];

export function badgeMeta(id: string): BadgeMeta | undefined {
  return (
    BADGES.find((badge) => badge.id === id) ??
    CONTEXT_BADGES.find((badge) => badge.id === id)
  );
}

/** Badges set in a bitfield, in display order */
export function badgesFromBits(bits: number): BadgeMeta[] {
  return BADGES.filter((badge) => (bits & badge.bit) !== 0).sort(
    (a, b) => a.priority - b.priority,
  );
}
