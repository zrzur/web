import { AnyBadgeId } from "./badges/catalog";

/** Badges the small profile card shows beside the name */
export const CARD_BADGES = 3;

/**
 * Badges on the name row, most important first as given. The small card
 * keeps to the first three so the name always has room; the full profile
 * shows every badge.
 */
export function nameRowBadges(
  ids: AnyBadgeId[],
  size: "card" | "full",
): AnyBadgeId[] {
  return size === "card" ? ids.slice(0, CARD_BADGES) : ids;
}
