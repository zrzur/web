import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { DND_FILE, measureOnlyAfterDrag } from "./dndFlip.mjs";

const require = createRequire(join(__dirname, "../package.json"));
const dist = join(dirname(require.resolve("solid-dnd-directive")), "..");
const files = ["source/index.js", "esm/index.js"].map((f) => join(dist, f));

describe("drag zone measures only after a drag", () => {
  it("matches both files of the library the builds load", () => {
    for (const file of files)
      expect(DND_FILE.test(file.replace(/\\/g, "/"))).toBe(true);
  });

  it("flips only after the zone read the rows for a drag", () => {
    for (const file of files) {
      const code = measureOnlyAfterDrag(readFileSync(file, "utf8"));
      expect(code).toContain("let flipPending = false;");
      expect(code).toMatch(
        /if \(flipPending\) \{\s*flipPending = false;\s*flipper\?\.flip/,
      );
      expect(code.match(/flipPending = true/g)).toHaveLength(2);
    }
  });

  it("fails loudly when a new version of the library changed the file", () => {
    expect(() => measureOnlyAfterDrag("export function dndzone() {}")).toThrow(
      /solid-dnd-directive/,
    );
  });
});
