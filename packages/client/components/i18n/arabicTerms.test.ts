import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const catalog = readFileSync(
  resolve(import.meta.dirname, "catalogs/ar/messages.po"),
  "utf8",
);

describe("Arabic catalog terms", () => {
  it("says «سيرفر», never «خادم»", () => {
    expect(catalog).not.toMatch(/خادم|خوادم/);
  });
});
