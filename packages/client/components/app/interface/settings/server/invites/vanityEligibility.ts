import type { VanityEligibility } from "@zrzur/sdk/solid";

/** The body of a `VanityNotEligible` error from `PUT /servers/{id}/vanity` */
type NotEligible = {
  type: "VanityNotEligible";
  missing?: string;
  members?: number;
  min_members?: number;
  messages?: number;
  min_messages?: number;
  authors?: number;
  min_authors?: number;
  days?: number;
};

function body(err: unknown): NotEligible | undefined {
  if (!err || typeof err !== "object") return undefined;
  const value = err as { type?: unknown; data?: unknown };
  if (value.type === "VanityNotEligible") return value as NotEligible;
  // the SDK's ApiError keeps the body under `data`
  if (
    value.data &&
    typeof value.data === "object" &&
    (value.data as { type?: unknown }).type === "VanityNotEligible"
  )
    return value.data as NotEligible;
  return undefined;
}

/**
 * The numbers a refused claim came back with, as an eligibility the panel
 * can show (the claim field then gives way to what is missing). Anything
 * else gives undefined.
 */
export function eligibilityFromError(
  err: unknown,
  previous?: VanityEligibility,
): VanityEligibility | undefined {
  const refused = body(err);
  if (!refused) return undefined;
  const missing =
    refused.missing === "Members" ||
    refused.missing === "Activity" ||
    refused.missing === "Both"
      ? refused.missing
      : "Both";
  return {
    eligible: false,
    missing,
    members: refused.members ?? previous?.members ?? 0,
    minMembers: refused.min_members ?? previous?.minMembers ?? 1000,
    messages: refused.messages ?? previous?.messages ?? 0,
    minMessages: refused.min_messages ?? previous?.minMessages ?? 100,
    authors: refused.authors ?? previous?.authors ?? 0,
    minAuthors: refused.min_authors ?? previous?.minAuthors ?? 20,
    days: refused.days ?? previous?.days ?? 30,
    linkEndsAt: previous?.linkEndsAt,
  };
}
