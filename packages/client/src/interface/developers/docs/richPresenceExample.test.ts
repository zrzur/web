import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// The rich presence page shows a game, not a bot, so its example is not in
// the bot examples (those run live as bots). The page's code must still be
// the file, word for word, in all three languages; the SDK's own unit test
// runs `ZrzurRpc` against a pipe like the desktop app's.
const here = __dirname;
const file = readFileSync(
  join(here, "../../../../scripts/rpc-examples/rich-presence.mjs"),
  "utf8",
).trim();

function firstJsBlock(source: string) {
  const match = /```js\n([\s\S]*?)\n```/.exec(source);
  return match?.[1].trim();
}

describe("rich presence example", () => {
  for (const path of ["rich-presence.md", "ar/rich-presence.md", "de/rich-presence.md"])
    it(`is the example file in ${path}`, () => {
      const page = readFileSync(join(here, "content", path), "utf8");
      expect(firstJsBlock(page)).toBe(file);
    });

  it("uses the RPC entry point and no token", () => {
    expect(file).toContain('from "@zrzur/sdk/rpc"');
    expect(file).not.toMatch(/token/i);
  });
});
