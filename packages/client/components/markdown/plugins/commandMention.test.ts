import { describe, expect, it } from "vitest";

import { RE_COMMAND_MENTION } from "./commandMention";

const ID = "01HZX5Q8J9K2M3N4P5R6S7T8V9";

const split = (text: string) => text.split(RE_COMMAND_MENTION);

describe("command mentions", () => {
  it("matches a command, a sub-command and a group", () => {
    expect(split(`try </ping:${ID}> now`)).toEqual([
      "try ",
      "ping",
      ID,
      " now",
    ]);
    expect(split(`</emoji add:${ID}>`)).toEqual(["", "emoji add", ID, ""]);
    expect(split(`</a b c:${ID}>`)).toEqual(["", "a b c", ID, ""]);
  });

  it("matches localized names", () => {
    expect(split(`</مساعدة:${ID}>`)).toEqual(["", "مساعدة", ID, ""]);
  });

  it("ignores html, bad ids and too many words", () => {
    expect(split("</div>")).toHaveLength(1);
    expect(split("</ping:notanid>")).toHaveLength(1);
    expect(split(`</a b c d:${ID}>`)).toHaveLength(1);
    expect(split(`</Ping:${ID}>`)).toHaveLength(1);
  });
});
