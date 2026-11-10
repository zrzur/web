import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../../../..");

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "dist", "styled-system", "catalogs"].includes(name))
      continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.tsx$/.test(name) && !/\.test\./.test(name)) yield path;
  }
}

/**
 * Button's "warning" variant paints the unset debug colours (red text on a
 * red-to-blue gradient) so a forgotten use stands out: no screen may use it.
 * A destructive action is "_error".
 */
describe("button variants", () => {
  it("never uses the debug warning variant", () => {
    const offenders: string[] = [];
    for (const dir of ["src", "components"]) {
      for (const file of sources(join(root, dir))) {
        if (/variant=["']warning["']/.test(readFileSync(file, "utf8")))
          offenders.push(relative(root, file).replace(/\\/g, "/"));
      }
    }
    expect(offenders).toEqual([]);
  }, 30_000);
});
