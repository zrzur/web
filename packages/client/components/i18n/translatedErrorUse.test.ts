import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "dist", "styled-system", "catalogs"].includes(name))
      continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) yield path;
  }
}

describe("translated errors", () => {
  // `new Error(t`…`)` looks translated but `useError` only shows messages
  // made with `translatedError(...)`; anything else is hidden under Details.
  it("never builds an Error from a translated message directly", () => {
    const offenders: string[] = [];
    for (const dir of ["src", "components"]) {
      for (const file of sources(join(root, dir))) {
        if (/new\s+\w*Error\(\s*t`/.test(readFileSync(file, "utf8")))
          offenders.push(relative(root, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
