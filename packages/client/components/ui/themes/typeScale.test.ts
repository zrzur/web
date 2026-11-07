import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * One type scale for the whole app (brand.md section 5). Styled components
 * may only use these pixel sizes; anything in between is a drift.
 */
const TYPE_SCALE = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28];

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return ["node_modules", "i18n"].includes(entry.name) ? [] : sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)
      ? [path]
      : [];
  });
}

describe("type scale", () => {
  it("uses only sizes from the scale", () => {
    const off: string[] = [];
    for (const file of [...sources("components"), ...sources("src")]) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/fontSize:\s*"(\d+(?:\.\d+)?)px"/g))
        if (!TYPE_SCALE.includes(Number(match[1])))
          off.push(`${file}: ${match[1]}px`);
    }
    expect(off).toEqual([]);
  });
});
