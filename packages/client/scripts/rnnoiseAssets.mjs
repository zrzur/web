import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

/** The noise filter's files (vendor/rnnoise/SOURCES.md), served at /assets/rnnoise/ */
export const RNNOISE_FILES = ["RNNoiseWorklet.js", "rnnoise.wasm", "LICENSE"];

/**
 * Copy the vendored files into `<assets>/rnnoise/`. `assets` is the folder
 * public/assets points to (the real assets or scripts/assets_fallback);
 * both ignore rnnoise/ in git.
 */
export function copyRnnoise(assets, vendor = resolve("vendor", "rnnoise")) {
  const target = resolve(assets, "rnnoise");
  mkdirSync(target, { recursive: true });
  for (const file of RNNOISE_FILES)
    copyFileSync(resolve(vendor, file), resolve(target, file));
  return target;
}
