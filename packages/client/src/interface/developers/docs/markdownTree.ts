import type { Content, Heading, Root, RootContent } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

const parser = unified().use(remarkParse).use(remarkGfm);

/** Parse Markdown into its syntax tree */
export function parseMarkdown(source: string) {
  return parser.runSync(parser.parse(source)) as Root;
}

/** Plain text of a node */
export function textOf(node: RootContent | Content | Root): string {
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("children" in node)
    return (node.children as Content[]).map(textOf).join("");
  return "";
}

/** Anchor id of a heading */
export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[`'"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Translated pages keep the English anchor: `## عنوان {#intents}` */
const FIXED_ANCHOR = /\s*\{#([a-z0-9-]+)\}\s*$/;

/** Anchor id of a heading node */
export function headingId(node: Heading) {
  const text = textOf(node);
  return FIXED_ANCHOR.exec(text)?.[1] ?? slugify(text);
}

/** Heading text without its fixed anchor */
export const headingText = (text: string) => text.replace(FIXED_ANCHOR, "");

/** Second-level headings of a page, for search */
export function headingsOf(source: string) {
  return parseMarkdown(source)
    .children.filter(
      (node): node is Heading => node.type === "heading" && node.depth === 2,
    )
    .map((node) => ({ text: headingText(textOf(node)), id: headingId(node) }));
}

/** Every heading id of a page */
export function anchorsOf(source: string) {
  return parseMarkdown(source)
    .children.filter((node): node is Heading => node.type === "heading")
    .map(headingId);
}

/** Link targets of a page */
export function linksOf(source: string) {
  const links: string[] = [];
  const visit = (node: RootContent | Root) => {
    if (node.type === "link") links.push(node.url);
    if ("children" in node) (node.children as RootContent[]).forEach(visit);
  };
  visit(parseMarkdown(source));
  return links;
}

/** Inline code of a page (to check `METHOD /path` mentions) */
export function inlineCodeOf(source: string) {
  const codes: string[] = [];
  const visit = (node: RootContent | Root) => {
    if (node.type === "inlineCode") codes.push(node.value);
    if ("children" in node) (node.children as RootContent[]).forEach(visit);
  };
  visit(parseMarkdown(source));
  return codes;
}

/** Fenced blocks of a page */
export function codeBlocksOf(source: string) {
  return parseMarkdown(source)
    .children.filter((node) => node.type === "code")
    .map((node) => {
      const code = node as {
        lang?: string | null;
        meta?: string | null;
        value: string;
      };
      return {
        lang: code.lang ?? "",
        meta: code.meta ?? "",
        value: code.value,
      };
    });
}
