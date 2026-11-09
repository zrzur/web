import { describe, expect, it } from "vitest";

import {
  checkSiteCatalog,
  messageKeysIn,
  readCatalog,
  siteModules,
  subsetCatalog,
} from "./siteCatalogs.mjs";

describe("site catalogs", () => {
  it("finds the message ids a module's code uses", () => {
    const keys = new Set(["-4imON", "abc123", "[Today at] LT", "unused"]);
    const code =
      'const a = i18n._({ id: "-4imON" }); t(`x`); const b = { id: \'abc123\' }; c("[Today at] LT"); "-4imONx";';
    expect([...messageKeysIn(code, keys)].sort()).toEqual([
      "-4imON",
      "[Today at] LT",
      "abc123",
    ]);
  });

  it("follows static imports from the site pages, and their lazily opened pages one step", () => {
    const graph: Record<
      string,
      { importedIds: string[]; dynamicallyImportedIds: string[] }
    > = {
      "/src/sites.tsx": {
        importedIds: ["/src/mount.tsx"],
        dynamicallyImportedIds: ["/src/interface/Discover.tsx"],
      },
      "/src/mount.tsx": {
        importedIds: ["/components/ui.ts"],
        dynamicallyImportedIds: ["/components/auth/Flow.tsx"],
      },
      "/components/ui.ts": { importedIds: [], dynamicallyImportedIds: [] },
      "/src/interface/Discover.tsx": {
        importedIds: ["/components/cards.ts"],
        dynamicallyImportedIds: ["/components/modal/Big.tsx"],
      },
      "/components/cards.ts": { importedIds: [], dynamicallyImportedIds: [] },
    };
    const modules = siteModules(["/src/sites.tsx"], (id: string) => graph[id]);
    expect([...modules].sort()).toEqual([
      "/components/cards.ts",
      "/components/ui.ts",
      "/src/interface/Discover.tsx",
      "/src/mount.tsx",
      "/src/sites.tsx",
    ]);
  });

  it("keeps only the used messages", () => {
    expect(
      subsetCatalog({ a: ["A"], b: ["B"], c: ["C"] }, new Set(["a", "c"])),
    ).toEqual({ a: ["A"], c: ["C"] });
  });

  it("reads a compiled catalog file", () => {
    const ts =
      '/*eslint-disable*/import type{Messages}from"@lingui/core";export const messages=JSON.parse("{\\"x\\":[\\"Hallo \\\\\\"Welt\\\\\\"\\"]}") as Messages;';
    expect(readCatalog(ts)).toEqual({ x: ['Hallo "Welt"'] });
  });

  it("reads the escapes a compiled catalog uses that JSON does not", () => {
    const ts =
      'export const messages=JSON.parse("{\\"x\\":[\\"vérifié\xA0!\\"]}")as Messages;';
    expect(readCatalog(ts)).toEqual({ x: ["vérifié !"] });
  });

  it("reads every catalog of the app", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const dir = new URL("../components/i18n/catalogs/", import.meta.url);
    for (const code of readdirSync(dir)) {
      const file = new URL(`${code}/messages.ts`, dir);
      let ts: string;
      try {
        ts = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      expect(Object.keys(readCatalog(ts)).length, code).toBeGreaterThan(100);
    }
    // 45 catalogs of about 250 KB each: slow on a busy machine
  }, 60_000);

  it("stops the build when the site pages were not found or use almost no messages", () => {
    expect(() => checkSiteCatalog([], 900)).toThrow(/sites\.tsx/);
    expect(() =>
      checkSiteCatalog(["/a/sites.tsx", "/b/sites.tsx"], 900),
    ).toThrow(/sites\.tsx/);
    expect(() => checkSiteCatalog(["/src/sites.tsx"], 12)).toThrow(/12/);
    expect(() => checkSiteCatalog(["/src/sites.tsx"], 900)).not.toThrow();
  });
});
