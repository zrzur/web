import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import { remarkLinkify } from "./remarkLinkify";

type Node = { type: string; url?: string; children?: Node[] };

function parse(text: string): Node {
  const pipeline = unified().use(remarkParse).use(remarkGfm).use(remarkLinkify);
  return pipeline.runSync(pipeline.parse(text)) as Node;
}

/** Every link, with the links inside it */
function links(node: Node, depth = 0, out: [string, number][] = []) {
  if (node.type === "link") out.push([node.url!, depth]);
  for (const child of node.children ?? []) {
    links(child, node.type === "link" ? depth + 1 : depth, out);
  }
  return out;
}

// A link inside a link was rendered as an anchor around the invite or bot
// card, so a press on Join or Add bot also followed the outer link.
describe("remarkLinkify", () => {
  it("does not link a URL a second time inside a link", () => {
    expect(links(parse("https://zrzur.cc/Dm8w7T5p"))).toEqual([
      ["https://zrzur.cc/Dm8w7T5p", 0],
    ]);
    expect(
      links(
        parse(
          "[https://example.com](https://zrzur.cc/b/01M70R4TN68KPSV0TYV7GV6K6E)",
        ),
      ),
    ).toEqual([["https://zrzur.cc/b/01M70R4TN68KPSV0TYV7GV6K6E", 0]]);
  });

  it("still links URLs in plain text", () => {
    expect(links(parse("see https://example.com/a and more"))).toEqual([
      ["https://example.com/a", 0],
    ]);
  });
});
