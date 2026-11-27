/**
 * Coloured code blocks, as in Discord:
 *
 * - ```` ```ansi ```` colours text with ANSI codes (ESC[31m…)
 * - ```` ```fix ```` writes the block in yellow
 *
 * A rehype step of the rich pipeline: it loads with code highlighting, for
 * the first message with a fenced block in a language (richPlugins.ts), so
 * the app shell stays small.
 */
import type { Element, ElementContent, Root } from "hast";
import { visit } from "unist-util-visit";

/** One run of text in an ANSI block, with its colours */
export interface AnsiRun {
  text: string;
  fg?: number;
  bg?: number;
  bold?: boolean;
  underline?: boolean;
}

// ESC [ codes m; also the "\u001b" a person pastes as text from a generator
// eslint-disable-next-line no-control-regex -- ESC is what ANSI codes start with
const ANSI = /(?:\u001b|\\u001b|\\x1b|\\e)\[([0-9;]*)m/g;

/**
 * Cut ANSI text into runs. Only what Discord draws is kept: 0 resets, 1 is
 * bold, 4 underlines, 30–37 colour the text and 40–47 the background
 */
export function ansiRuns(text: string): AnsiRun[] {
  const runs: AnsiRun[] = [];
  let state: Omit<AnsiRun, "text"> = {};
  let at = 0;
  const push = (part: string) => {
    if (part) runs.push({ text: part, ...state });
  };
  for (const match of text.matchAll(ANSI)) {
    push(text.slice(at, match.index));
    at = match.index! + match[0].length;
    const codes = match[1] === "" ? [0] : match[1].split(";").map(Number);
    for (const code of codes) {
      if (code === 0) state = {};
      else if (code === 1) state = { ...state, bold: true };
      else if (code === 4) state = { ...state, underline: true };
      else if (code >= 30 && code <= 37) state = { ...state, fg: code };
      else if (code >= 40 && code <= 47) state = { ...state, bg: code };
    }
  }
  push(text.slice(at));
  return runs;
}

/** The language of a `<code class="language-…">`, lower case */
function languageOf(node: Element) {
  const classes = node.properties?.className;
  const list = Array.isArray(classes) ? classes : [];
  const found = list.find(
    (name) => typeof name === "string" && name.startsWith("language-"),
  );
  return typeof found === "string"
    ? found.slice("language-".length).toLowerCase()
    : undefined;
}

/** The text inside an element */
function textOf(node: Element): string {
  return node.children
    .map((child) =>
      child.type === "text"
        ? child.value
        : child.type === "element"
          ? textOf(child)
          : "",
    )
    .join("");
}

/** Draw `ansi` and `fix` code blocks in colour */
export function rehypeCodeTones() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "code") return;
      const lang = languageOf(node);
      if (lang === "ansi") {
        node.children = ansiRuns(textOf(node)).map(
          (run): ElementContent =>
            run.fg || run.bg || run.bold || run.underline
              ? {
                  type: "element",
                  tagName: "span",
                  properties: {
                    dataFg: run.fg,
                    dataBg: run.bg,
                    dataBold: run.bold ? "" : undefined,
                    dataUnderline: run.underline ? "" : undefined,
                  },
                  children: [{ type: "text", value: run.text }],
                }
              : { type: "text", value: run.text },
        );
      } else if (lang === "fix") {
        node.properties = { ...node.properties, dataTone: "fix" };
      }
    });
  };
}
