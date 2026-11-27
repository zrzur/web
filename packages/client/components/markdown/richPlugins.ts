/**
 * Maths (KaTeX), code highlighting and coloured code blocks: most messages have neither, so they
 * load with the first message that does (see `needsRichMarkdown`)
 */
import "katex/dist/katex.min.css";

export { common } from "lowlight";
export { default as rehypeHighlight } from "rehype-highlight";
export { default as rehypeKatex } from "rehype-katex";
export { default as remarkMath } from "remark-math";
export { rehypeCodeTones } from "./plugins/codeTones";
