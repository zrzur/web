import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import { EMITTER_FILE, stripEmitterInspect } from "./emitterInspect.mjs";

// the SDK's dependency, resolved the way the build resolves it
const sdkRequire = createRequire(
  join(__dirname, "../../stoat.js/package.json"),
);
const emitterFile = sdkRequire
  .resolve("@vladfrangu/async_event_emitter")
  .replace(/index\.cjs$/, "index.mjs");
const original = readFileSync(emitterFile, "utf8");

async function load(code: string) {
  const dir = mkdtempSync(join(tmpdir(), "zrzur-emitter-"));
  const file = join(dir, "index.mjs");
  writeFileSync(file, code);
  return import(/* @vite-ignore */ pathToFileURL(file).href);
}

describe("async event emitter without node-inspect", () => {
  it("matches the file the build loads", () => {
    expect(EMITTER_FILE.test(emitterFile.replace(/\\/g, "/"))).toBe(true);
  });

  it("drops the bundled copy of node's util.inspect", () => {
    const code = stripEmitterInspect(original);
    expect(original).toContain("node-inspect-extracted");
    expect(code).not.toContain("node-inspect-extracted");
    // most of the file was the inspect copy
    expect(code.length).toBeLessThan(original.length / 3);
  });

  it("fails loudly when a new version of the library changed the file", () => {
    expect(() =>
      stripEmitterInspect("export class AsyncEventEmitter {}"),
    ).toThrow(/async_event_emitter/);
  });

  it("still emits, once, off and reports unhandled errors", async () => {
    const { AsyncEventEmitter } = await load(stripEmitterInspect(original));
    const emitter = new AsyncEventEmitter();
    const seen: unknown[] = [];
    const listener = (value: unknown) => seen.push(value);
    emitter.on("a", listener);
    emitter.once("a", (value: unknown) => seen.push(`once:${value}`));
    expect(emitter.emit("a", 1)).toBe(true);
    emitter.emit("a", 2);
    emitter.off("a", listener);
    expect(emitter.emit("a", 3)).toBe(false);
    expect(seen).toEqual([1, "once:1", 2]);
    expect(emitter.listenerCount("a")).toBe(0);

    const boom = new Error("boom");
    expect(() => emitter.emit("error", boom)).toThrow(boom);
    expect(() => emitter.emit("error", { code: 7 })).toThrow(
      /Unhandled 'error' event emitted, received .*code.*7/,
    );
  });
});
