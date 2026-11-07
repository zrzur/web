// Loads the shared e2e helpers (stack.mjs, catalog.mjs) from the folder named
// in ZRZUR_E2E_LIB (the private test-env/e2e/lib), so nothing in this public
// repository imports a private path.
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = process.env.ZRZUR_E2E_LIB;
if (!dir) {
  throw new Error(
    "Set ZRZUR_E2E_LIB to the folder that holds stack.mjs and catalog.mjs",
  );
}
export const stack = await import(pathToFileURL(join(dir, "stack.mjs")).href);
export const { tr } = await import(
  pathToFileURL(join(dir, "catalog.mjs")).href
);
