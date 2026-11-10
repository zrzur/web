import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { RNNOISE_FILES } from "../scripts/rnnoiseAssets.mjs";

const vendor = resolve(__dirname, "rnnoise");
const sources = readFileSync(resolve(vendor, "SOURCES.md"), "utf8");

describe("vendored noise filter", () => {
  it("has the bytes recorded in SOURCES.md", () => {
    for (const file of ["RNNoiseWorklet.js", "rnnoise.wasm", "LICENSE"]) {
      const hash = createHash("sha256")
        .update(readFileSync(resolve(vendor, file)))
        .digest("hex");
      expect(sources, file).toContain(hash);
    }
  });

  it("is what copyAssets puts under /assets/rnnoise/", () => {
    expect(RNNOISE_FILES).toEqual([
      "RNNoiseWorklet.js",
      "rnnoise.wasm",
      "LICENSE",
    ]);
  });

  it("loads nothing from another host", () => {
    const worklet = readFileSync(resolve(vendor, "RNNoiseWorklet.js"), "utf8");
    expect(worklet).not.toMatch(/https?:\/\//);
    expect(worklet).not.toMatch(/importScripts/);
  });
});
