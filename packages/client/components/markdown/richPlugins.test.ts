import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import { rehypeKatex, remarkMath } from "./richPlugins";

describe("rich markdown plugins", () => {
  it("parse and draw $$ maths even when added after remark-rehype", () => {
    // index.tsx adds remarkMath to a copy of the finished html pipeline
    const pipeline = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(remarkMath, { singleDollarTextMath: false })
      .use(rehypeKatex, { output: "html" });
    const file = "a $$x^2$$ b";
    const tree = pipeline.runSync(pipeline.parse(file), file);
    expect(JSON.stringify(tree)).toContain("katex");
  });

  it("leaves a single dollar as text", () => {
    const pipeline = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(remarkMath, { singleDollarTextMath: false })
      .use(rehypeKatex, { output: "html" });
    const file = "costs $5 and $6";
    const tree = pipeline.runSync(pipeline.parse(file), file);
    expect(JSON.stringify(tree)).not.toContain("katex");
  });
});
