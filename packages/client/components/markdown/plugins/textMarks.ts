/**
 * The message formatting people know from Discord, on top of Markdown:
 *
 * - `__text__` underlines (Markdown would make it bold; `**text**` is bold)
 * - `-# text` at the start of a line is small, muted text
 *
 * The coloured ```` ```ansi ```` and ```` ```fix ```` code blocks are in
 * codeTones.ts: they load with code highlighting (see richPlugins.ts)
 */
import type { Properties } from "hast";
import type { Paragraph, PhrasingContent, Root, Strong } from "mdast";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

type Data = {
  hName?: string;
  hProperties?: Properties;
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
