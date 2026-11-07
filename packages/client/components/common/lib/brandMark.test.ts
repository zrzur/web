import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { brandMarkSrc } from "./brandMark";

describe("brandMarkSrc", () => {
  it("shows the white B mark on dark surfaces", () => {
    expect(brandMarkSrc(true, "/")).toBe("/brand/mark-white.svg?v=b-1");
  });

  it("shows the ink B mark on light surfaces", () => {
    expect(brandMarkSrc(false, "/")).toBe("/brand/mark-ink.svg?v=b-1");
  });

  it("keeps the deployment base path", () => {
    expect(brandMarkSrc(false, "/app/")).toBe("/app/brand/mark-ink.svg?v=b-1");
  });
});

describe("logo files", () => {
  // A's eye. The look-up and look-down moods reuse it, as supplied in the expression pack.
  const A_EYE = "M 68 113";
  const B_EYE = "M 68 126";

  it.each([
    "public/brand/mark-ink.svg",
    "public/brand/mark-white.svg",
    "public/brand/zrzur-mark.svg",
    "scripts/assets_fallback/web/favicon.svg",
    "scripts/assets_fallback/web/loader-glide.svg",
    "scripts/assets_fallback/web/monochrome.svg",
    "scripts/assets_fallback/web/zrzur-app-mark.svg",
    "scripts/assets_fallback/web/zrzur-mark.svg",
  ])("%s is version B", (file) => {
    const svg = readFileSync(resolve(process.cwd(), file), "utf8");
    expect(svg.replace(/\s+/g, " ")).not.toContain(A_EYE);
    expect(svg).toContain(B_EYE);
  });
});
