import rehypeStringify from "rehype-stringify";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import { remarkInsertBreaks, sanitise } from "../sanitise";
import { remarkHtmlToText } from "./htmlToText";
import {
  ansiRuns,
  remarkCodeTones,
  remarkSubtext,
  remarkUnderline,
} from "./textMarks";

// the message pipeline, in the order the app uses it
const pipeline = unified()
  .use(remarkParse)
  .use(remarkBreaks)
  .use(remarkGfm)
  .use(remarkUnderline)
  .use(remarkSubtext)
  .use(remarkCodeTones)
  .use(remarkHtmlToText)
  .use(remarkRehype)
  .use(remarkInsertBreaks)
  .use(rehypeStringify);

const render = (content: string) =>
  String(pipeline.processSync(sanitise(content)));

describe("Discord text formatting", () => {
  it("underlines __text__ and keeps **text** bold", () => {
    expect(render("__u__ **b**")).toBe("<p><u>u</u> <strong>b</strong></p>");
    expect(render("__*ui*__")).toBe("<p><u><em>ui</em></u></p>");
    expect(render("__**ub**__")).toBe("<p><u><strong>ub</strong></u></p>");
    expect(render("___x___")).toContain("<u>x</u>");
  });

  it("makes -# lines small, and only those lines", () => {
    const html = render("normal\n-# small\n-# smaller\nnormal again");
    expect(html).toContain("<p>normal</p>");
    expect(html).toContain('<p data-subtext="">small<br>\nsmaller</p>');
    expect(html).toContain("<p>normal again</p>");
    expect(render("-# **bold** small")).toBe(
      '<p data-subtext=""><strong>bold</strong> small</p>',
    );
    // a mark in the middle of a line is only text
    expect(render("a -# b")).toBe("<p>a -# b</p>");
    expect(render("-#nospace")).toBe("<p>-#nospace</p>");
  });

  it("quotes the rest of the message after >>>", () => {
    const html = render("before\n>>> one\ntwo\nthree");
    expect(html).toContain("<p>before</p>");
    expect(html.match(/<blockquote>/g)).toHaveLength(1);
    expect(html).toMatch(/<blockquote>\s*<p>one<br>\ntwo<br>\nthree<\/p>/);
    // a single > still quotes one line
    expect(render("> one\nafter")).toMatch(
      /<blockquote>\s*<p>one<\/p>\s*<\/blockquote>\s*<p>after<\/p>/,
    );
    // what comes before it stays, code blocks too
    const after = render("```\ncode\n```\nbefore\n>>> quoted");
    expect(after).toContain("<pre><code>code\n</code></pre>");
    expect(after).toContain("<p>before</p>");
    expect(after).toMatch(/<blockquote>\s*<p>quoted<\/p>/);
    // inside code it is only text
    expect(render("```\n>>> not a quote\n```")).not.toContain("blockquote");
  });

  it("keeps + lines in a diff block as they are", () => {
    const html = render("```diff\n- red\n+ green\n```");
    expect(html).toContain("- red\n+ green");
    expect(html).not.toContain("​");
    // outside code a + line is still not a list
    expect(render("+ plus")).not.toContain("<li>");
  });

  it("colours ANSI code blocks", () => {
    const html = render(
      "```ansi\n\u001b[1;31mred\u001b[0m plain \u001b[4;44mblue\u001b[0m\n```",
    );
    expect(html).toContain(
      '<span data-fg="31" data-bold="">red</span> plain <span data-bg="44" data-underline="">blue</span>',
    );
    expect(html).not.toContain("\u001b");
  });

  it("writes fix blocks in yellow", () => {
    expect(render("```fix\nyellow\n```")).toContain('data-tone="fix"');
  });

  it("keeps Markdown escapes as plain marks", () => {
    expect(render("\\*\\*Text\\*\\* \\_\\_u\\_\\_ \\# no")).toBe(
      "<p>**Text** __u__ # no</p>",
    );
  });
});

describe("ansiRuns", () => {
  it("reads codes typed as text by a generator too", () => {
    expect(ansiRuns("\\u001b[2;32mok\\u001b[0m")).toEqual([
      { text: "ok", fg: 32 },
    ]);
  });

  it("resets on an empty code and ignores ones Discord does not draw", () => {
    expect(ansiRuns("\u001b[31ma\u001b[mb\u001b[95mc")).toEqual([
      { text: "a", fg: 31 },
      { text: "b" },
      { text: "c" },
    ]);
  });
});
