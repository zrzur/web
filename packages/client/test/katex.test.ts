import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

// rehype-katex asks for katex ^0.16; the workspace overrides it to 0.18
// for a security fix, so check the pair still renders.
const render = (markdown: string) =>
  String(
    unified()
      .use(remarkParse)
      .use(remarkMath)
      .use(remarkRehype)
      .use(rehypeKatex, { trust: false, throwOnError: false })
      .use(rehypeStringify)
      .processSync(markdown),
  );

describe("math rendering", () => {
  it("renders inline and display math", () => {
    const html = render("Area $\\pi r^2$\n\n$$\n\\frac{a}{b}\n$$");
    expect(html).toContain('class="katex"');
    expect(html).toContain("katex-display");
    expect(html).toContain("mfrac");
  });

  it("does not turn untrusted commands such as \\href into links", () => {
    // the TeX source is kept as text in <annotation>; there must be no link
    const html = render("$\\href{javascript:alert(1)}{x}$");
    expect(html).not.toMatch(/<a\s/i);
    expect(html).not.toMatch(/href="javascript:/i);
  });
});
