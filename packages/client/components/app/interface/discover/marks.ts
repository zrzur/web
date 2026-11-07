/** Fields that decide which mark a listing carries */
export type MarkInput = {
  /** In the paid top row */
  promoted?: boolean;
  /** Paid boost (internal kinds, kept as they are) */
  boost?: "Boost" | "SuperBoost" | "MegaBoost";
  /** Hand-picked by the team (free) */
  featured?: boolean;
  /** What the listing is (the ad note names the owner of a server or a bot) */
  kind?: "servers" | "bots";
};

export type ListingMarkKind =
  | "promoted"
  | "headline"
  | "spotlight"
  | "boosted"
  | "picked";

/** The paid or hand-picked mark a listing carries, strongest first */
export function listingMark(listing: MarkInput): ListingMarkKind | undefined {
  if (listing.promoted) return "promoted";
  if (listing.boost === "MegaBoost") return "headline";
  if (listing.boost === "SuperBoost") return "spotlight";
  if (listing.boost) return "boosted";
  if (listing.featured) return "picked";
  return undefined;
}

/**
 * Paid placement: must always carry the "Ad" label and the "Why am I
 * seeing this?" note. Only the free hand-picked mark is exempt.
 */
export function isPaidMark(mark: ListingMarkKind | undefined): boolean {
  return mark !== undefined && mark !== "picked";
}

export const isPaidListing = (listing: MarkInput) =>
  isPaidMark(listingMark(listing));
