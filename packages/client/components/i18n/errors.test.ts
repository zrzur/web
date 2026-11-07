import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import errorTypes from "./errorTypes.json";

const here = import.meta.dirname;
const source = readFileSync(resolve(here, "errors.tsx"), "utf8");

/** Every error type `useError` gives its own words to */
function handledTypes() {
  const names = new Set<string>();
  for (const match of source.matchAll(/case "(\w+)":/g)) names.add(match[1]);
  for (const match of source.matchAll(/=== "(\w+)"/g)) names.add(match[1]);
  for (const match of source.matchAll(/^\s+(\w+): \(\) =>/gm))
    names.add(match[1]);
  return names;
}

describe("error messages", () => {
  it("has plain words for every error the server can send", () => {
    const handled = handledTypes();
    const missing = errorTypes.filter((type) => !handled.has(type));
    expect(missing).toEqual([]);
  });

  it("never shows the raw error type or location as the message", () => {
    expect(source).not.toMatch(/return err\.type \+/);
    expect(source).not.toMatch(/\$\{err\.(type|location|error)\}/);
  });

  // the list is copied from the backend; when both are checked out side by
  // side, it must match the backend's ErrorType enum
  const backend = resolve(
    here,
    "../../../../../backend/crates/core/result/src/lib.rs",
  );
  // TODO(sdk): the SDK stream will generate the route table and an error
  // schema from OpenAPI; compare against that instead of a Rust checkout, so
  // this runs in worktrees and CI too.
  if (!existsSync(backend)) {
    console.warn(
      `[errors.test] SKIPPED backend error-type comparison: ${backend} not found (backend not checked out next to web).`,
    );
  }
  it.skipIf(!existsSync(backend))("matches the backend's error types", () => {
    const rust = readFileSync(backend, "utf8");
    const body = rust.slice(rust.indexOf("pub enum ErrorType"));
    const enumBody = body.slice(0, body.indexOf("\n}"));
    const types = [
      ...new Set([...enumBody.matchAll(/^ {4}([A-Z]\w+)/gm)].map((m) => m[1])),
    ].sort();
    expect(types).toEqual(errorTypes);
  });
});
