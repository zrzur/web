/**
 * The message formatting people know from Discord, on top of Markdown:
 *
 * - `__text__` underlines (Markdown would make it bold; `**text**` is bold)
 * - `-# text` at the start of a line is small, muted text
 * - ```` ```ansi ```` code blocks colour text with ANSI codes (ESC[31m…)
 * - ```` ```fix ```` code blocks are written in yellow
 */
import type { ElementContent, Properties } from "hast";
import type { Code, Paragraph, PhrasingContent, Root, Strong } from "mdast";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

type Data = {
  hName?: string;
  hProperties?: Properties;
  hChildren?: ElementContent[];
};

/** `__text__` is underlined: a strong made with underscores becomes <u> */
export function remarkUnderline() {
  return (tree: Root, file: VFile) => {
    const source = String(file.value ?? "");
    visit(tree, "strong", (node: Strong) => {
      const at = node.position?.start.offset;
      if (at === undefined || source[at] !== "_") return;
      (node.data as Data | undefined) ??= {};
      (node.data as Data).hName = "u";
    });
  };
}

/** The mark of a small line */
const SUBTEXT = /^-#[^\S\r\n]+/;

/**
 * A line starting with `-# ` is small, muted text. remark-breaks has already
 * cut a paragraph into lines at `break` nodes, so each line is looked at on
 * its own and a paragraph is split where small lines start and end.
 */
export function remarkSubtext() {
  return (tree: Root) => {
    visit(tree, "paragraph", (node: Paragraph, index, parent) => {
      if (index === undefined || !parent) return;

      // the lines of the paragraph, without the breaks between them
      const lines: PhrasingContent[][] = [[]];
      for (const child of node.children) {
        if (child.type === "break") lines.push([]);
        else lines[lines.length - 1].push(child);
      }
      const small = (line: PhrasingContent[]) =>
        line[0]?.type === "text" && SUBTEXT.test(line[0].value);
      if (!lines.some(small)) return;

      // runs of lines of the same kind become one paragraph each
      const blocks: Paragraph[] = [];
      const smallBlocks: boolean[] = [];
      for (const line of lines) {
        const isSmall = small(line);
        if (isSmall) {
          const first = line[0] as { value: string };
          first.value = first.value.replace(SUBTEXT, "");
        }
        const last = blocks.length - 1;
        if (last >= 0 && smallBlocks[last] === isSmall) {
          blocks[last].children.push({ type: "break" }, ...line);
        } else {
          smallBlocks.push(isSmall);
          blocks.push({
            type: "paragraph",
            children: [...line],
            ...(isSmall
              ? { data: { hProperties: { dataSubtext: "" } } as Data }
              : {}),
          });
        }
      }

      parent.children.splice(index, 1, ...blocks);
      return index + blocks.length;
    });
  };
}

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
    if (!part) return;
    runs.push({ text: part, ...state });
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

/** The ANSI and fix code blocks, drawn as coloured text */
export function remarkCodeTones() {
  return (tree: Root) => {
    visit(tree, "code", (node: Code) => {
      const lang = node.lang?.toLowerCase();
      if (lang === "ansi") {
        const data = ((node.data as Data | undefined) ??= {}) as Data;
        data.hChildren = ansiRuns(node.value).map(
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
        // drawn here: the code highlighter does not know the language
        node.lang = "ansi-text";
      } else if (lang === "fix") {
        const data = ((node.data as Data | undefined) ??= {}) as Data;
        data.hProperties = { ...data.hProperties, dataTone: "fix" };
        node.lang = "fix-text";
      }
    });
  };
}
