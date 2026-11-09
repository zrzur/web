import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Gap 17, web side: going from one bot to another without the list kept
 * the first bot's view (its intents on the switches) while saves went to
 * the second. The bot's page must be rebuilt for each bot id.
 */
const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "Developers.tsx"),
  "utf8",
);

describe("Developer Portal bot page", () => {
  it("is rebuilt when another bot is opened", () => {
    expect(source).toMatch(/<Show when=\{selectedId\(\)\} keyed>/);
    const keyed = source.indexOf("<Show when={selectedId()} keyed>");
    const view = source.indexOf("<ViewBot");
    expect(keyed).toBeGreaterThan(-1);
    expect(view).toBeGreaterThan(keyed);
  });
});
