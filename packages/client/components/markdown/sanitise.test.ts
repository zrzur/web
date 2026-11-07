import rehypeStringify from "rehype-stringify";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import { remarkHtmlToText } from "./plugins/htmlToText";
import { remarkInsertBreaks, sanitise } from "./sanitise";

const pipeline = unified()
  .use(remarkParse)
  .use(remarkBreaks)
  .use(remarkGfm)
  .use(remarkHtmlToText)
  .use(remarkRehype)
  .use(remarkInsertBreaks)
  .use(rehypeStringify);

const render = (content: string) =>
  String(pipeline.processSync(sanitise(content)));

describe("Markdown line placeholders", () => {
  it("keeps a message that starts with an HTML tag on its first line", () => {
    const html = render("<b>not bold</b> after");
    expect(html).not.toContain("<br>");
    expect(html).toContain("&#x3C;b>not bold&#x3C;/b> after");
  });

  it("still renders explicit empty lines", () => {
    const html = render("first\n\n\nsecond");
    expect(html).toContain("<br>");
    expect(html.indexOf("first")).toBeLessThan(html.indexOf("<br>"));
    expect(html.indexOf("<br>")).toBeLessThan(html.indexOf("second"));
  });
});
