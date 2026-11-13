import { describe, expect, it } from "vitest";

import { AnyBadgeId } from "./badges/catalog";
import { CARD_BADGES, nameRowBadges } from "./nameRowBadges";

const five: AnyBadgeId[] = [
  "founder",
  "staff",
  "developer",
  "platform_moderator",
  "community_helper",
];

describe("nameRowBadges", () => {
  it("keeps the first three on the small card, in order", () => {
    expect(CARD_BADGES).toBe(3);
    expect(nameRowBadges(five, "card")).toEqual([
      "founder",
      "staff",
      "developer",
    ]);
  });

  it("shows every badge on the full profile", () => {
    expect(nameRowBadges(five, "full")).toEqual(five);
  });

  it("leaves a short list as it is", () => {
    expect(nameRowBadges(["staff"], "card")).toEqual(["staff"]);
    expect(nameRowBadges([], "card")).toEqual([]);
  });
});
