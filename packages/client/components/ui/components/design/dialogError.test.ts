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
 * Dialog draws its red error banner whenever `error` is set. A <Show> (or
 * any element) is always set, so the banner showed empty with no error at
 * all. Pass the message itself, or undefined when there is none.
 */
describe("dialog error", () => {
  it("is never an always-present element", () => {
    const offenders: string[] = [];
    for (const dir of ["src", "components"]) {
      for (const file of sources(join(root, dir))) {
        const alwaysSet = new RegExp("\\berror=\\{\\s*<(Show|Switch|Match)\\b");
        if (alwaysSet.test(readFileSync(file, "utf8")))
          offenders.push(relative(root, file).replace(/\\/g, "/"));
      }
    }
    expect(offenders).toEqual([]);
  }, 30_000);
});
