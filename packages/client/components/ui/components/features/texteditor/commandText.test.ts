import { describe, expect, it } from "vitest";

import { parseCommandOptions, spanAtCursor } from "./commandText";

const text =
  "/play game:Tic Tac Toe difficulty: opponent:<@01HZX5Q8J9K2M3N4P5R6S7T8V9>";
const prefix = "/play ".length;
const names = ["game", "difficulty", "opponent"];

describe("inline command options", () => {
  it("reads each option's value up to the next option", () => {
    const spans = parseCommandOptions(text, prefix, names);
    expect(spans.map((s) => [s.name, s.value])).toEqual([
      ["game", "Tic Tac Toe"],
      ["difficulty", ""],
      ["opponent", "<@01HZX5Q8J9K2M3N4P5R6S7T8V9>"],
    ]);
    expect(text.slice(spans[0].valueFrom, spans[0].valueTo)).toBe(
      "Tic Tac Toe",
    );
  });

  it("needs a space before a name and ignores the command itself", () => {
    expect(parseCommandOptions("/game game:x", 6, ["game"])).toHaveLength(1);
    expect(parseCommandOptions("/play endgame:x", 6, ["game"])).toHaveLength(0);
  });

  it("prefers the longer name and keeps a repeated name as value text", () => {
    const spans = parseCommandOptions("/p game_mode:a game:b game:c", 3, [
      "game",
      "game_mode",
    ]);
    expect(spans.map((s) => [s.name, s.value])).toEqual([
      ["game_mode", "a"],
      ["game", "b game:c"],
    ]);
  });

  it("works with Arabic names", () => {
    const spans = parseCommandOptions("/العب اللعبة:إكس أو", "/العب ".length, [
      "اللعبة",
    ]);
    expect(spans[0].value).toBe("إكس أو");
  });

  it("finds the option the cursor is in", () => {
    const spans = parseCommandOptions(text, prefix, names);
    expect(spanAtCursor(spans, text.indexOf("Tac"))?.name).toBe("game");
    expect(spanAtCursor(spans, text.indexOf("difficulty:") + 11)?.name).toBe(
      "difficulty",
    );
    expect(spanAtCursor(spans, 2)).toBeUndefined();
  });
});
