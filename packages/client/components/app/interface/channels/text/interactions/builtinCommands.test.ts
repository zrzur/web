import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import {
  applyBuiltin,
  builtinCommand,
  builtinMatches,
} from "./builtinCommands";

/** The text a message shows, Markdown read */
const shown = (content: string) =>
  String(
    unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeStringify)
      .processSync(content),
  ).replace(/<\/?p>/g, "");

describe("built-in commands", () => {
  it("adds the faces after the text, or sends them alone", () => {
    expect(shown(applyBuiltin("/shrug")!)).toBe("¯\\_(ツ)_/¯");
    expect(shown(applyBuiltin("/shrug ok then")!)).toBe("ok then ¯\\_(ツ)_/¯");
    expect(applyBuiltin("/tableflip no")).toBe("no (╯°□°)╯︵ ┻━┻");
    expect(shown(applyBuiltin("/unflip")!)).toBe("┬─┬ノ( º _ ºノ)");
  });

  it("says /me in italics and hides /spoiler", () => {
    expect(applyBuiltin("/me waves")).toBe("_waves_");
    expect(shown(applyBuiltin("/me waves")!)).toBe("<em>waves</em>");
    expect(applyBuiltin("/spoiler the end")).toBe("||the end||");
  });

  it("sends nothing for /me or /spoiler without text", () => {
    expect(applyBuiltin("/me")).toBe("");
    expect(applyBuiltin("/spoiler   ")).toBe("");
  });

  it("leaves other text and other commands alone", () => {
    expect(applyBuiltin("hello /shrug")).toBe(undefined);
    expect(applyBuiltin("/shrugging")).toBe(undefined);
    expect(applyBuiltin("/ban someone")).toBe(undefined);
    expect(builtinCommand("/me\nnext line")?.name).toBe("me");
  });

  it("offers the commands whose name starts with what is typed", () => {
    expect(builtinMatches("").map((c) => c.name)).toEqual([
      "shrug",
      "tableflip",
      "unflip",
      "me",
      "spoiler",
    ]);
    expect(builtinMatches("Sp").map((c) => c.name)).toEqual(["spoiler"]);
  });
});
