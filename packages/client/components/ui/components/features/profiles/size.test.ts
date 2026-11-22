import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PROFILE_BANNER,
  PROFILE_HEIGHT,
  PROFILE_WIDTH,
  profileBox,
} from "./size";

/**
 * Panda reads styles when the app is built and cannot follow a value
 * imported from size.ts, so the profile's size is written out in each style.
 * These tests keep every copy equal to size.ts: one profile size everywhere.
 */
const root = join(__dirname, "..", "..", "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("one profile size", () => {
  it("is about the size of a profile popout", () => {
    expect(PROFILE_WIDTH).toBe(300);
    expect(PROFILE_HEIGHT).toBe(620);
    expect(PROFILE_BANNER).toBe(100);
    expect(profileBox.height).toBe("min(620px, calc(100dvh - 32px))");
  });

  it("the card from a name has it", () => {
    const card = read("components/ui/components/floating/UserCard.tsx");
    expect(card).toContain(`width: "${PROFILE_WIDTH}px"`);
    expect(card).toContain(`height: "${profileBox.height}"`);
  });

  it("the full profile has it, with the card's header", () => {
    const full = read("components/modal/modals/UserProfile.tsx");
    expect(full).toContain("width={PROFILE_WIDTH}");
    // inside the window's 1 px border
    expect(full).toContain(
      `height: "min(${PROFILE_HEIGHT - 2}px, calc(100dvh - 34px))"`,
    );
    expect(full).not.toContain('size="full"');
  });

  it("the banner is a third of it", () => {
    const banner = read(
      "components/ui/components/features/profiles/ProfileBanner.tsx",
    );
    expect(banner).toContain(`"--banner-height": "${PROFILE_BANNER}px"`);
  });

  it("the previews use it", () => {
    const preview = read(
      "components/ui/components/features/profiles/frames/ProfilePreview.tsx",
    );
    expect(preview).toContain("PROFILE_WIDTH");
    expect(preview).toContain("PROFILE_HEIGHT");
  });
});
