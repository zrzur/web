/**
 * Regex for matching execessive recursion of blockquotes and lists
 */
const RE_RECURSIVE =
  /(^(?:[>*+-][^\S\r\n]*){4})(?:[>][^\S\r\n]*|[*+-]+\s)+(.*$)/gm;

/**
 * Regex for matching multi-line blockquotes
 */
const RE_BLOCKQUOTE = /^(?:[^\S\r\n]*>[^\n]+\n?)+/gm;

/**
 * Regex for matching HTML tags
 */
const RE_HTML_TAGS = /^(?:<\/?[a-zA-Z0-9]+>)(?:.*$)/gm;

/**
 * Regex for matching empty lines
 */
const RE_EMPTY_LINE = /^\s*?$/gm;

/**
 * Regex for matching line starting with plus
 */
const RE_PLUS = /^\s*\+(?:$|[^+])/gm;

/**
 * Regex for matching non-breaking spaces in code blocks
 */
const RE_CODEBLOCK_EMPTY_LINE_FIX =
  /(?<=`{3}[\s\S]*)\n\u200B\n(?=[\s\S]*`{3})/gm;

const RE_SPOILER_URL = /(https?:\/\/[\w_.~!*''();:@&=+$,/?#[%-]+)\|\|/;

/** Fenced code blocks, which the line rules below leave alone */
const RE_FENCE =
  /(^[^\S\r\n]*```[\s\S]*?(?:^[^\S\r\n]*```[^\n]*$|(?![\s\S])))/m;

/** `>>> ` quotes the line it starts on and every line after it */
const RE_QUOTE_REST = /^[^\S\r\n]*>>>[^\S\r\n]+/m;

/**
 * `>>> text`: everything from there to the end of the message is quoted, as
 * in Discord (Markdown would read three nested quotes). Code blocks after it
 * are quoted with the rest; a `>>>` inside a code block is only text.
 */
function quoteRest(content: string) {
  const parts = content.split(RE_FENCE);
  for (let i = 0; i < parts.length; i += 2) {
    const match = RE_QUOTE_REST.exec(parts[i]);
    if (!match) continue;
    const quoted =
      parts[i].slice(match.index + match[0].length) +
      parts.slice(i + 1).join("");
    const lines = quoted.split("\n").map((line) => `> ${line}`);
    return (
      parts.slice(0, i).join("") +
      parts[i].slice(0, match.index) +
      lines.join("\n")
    );
  }
  return content;
}

/** Run a rule on the text outside fenced code blocks only */
function outsideCode(content: string, rule: (text: string) => string) {
  return content
    .split(RE_FENCE)
    .map((part, i) => (i % 2 ? part : rule(part)))
    .join("");
}

/**
 * Sanitise Markdown input before rendering
 * @param content Input string
 * @returns Sanitised string
 */
export function sanitise(content: string) {
  const text = quoteRest(content)
    // Strip excessive blockquote or list indentation
    .replace(RE_RECURSIVE, (_, m0, m1) => m0 + m1)

    // Append empty character if string starts with html tag
    // This is to avoid inconsistencies in rendering Markdown inside/after HTML tags
    // https://github.com/revoltchat/revite/issues/733
    .replace(RE_HTML_TAGS, "\u200B$&");

  return (
    // Append empty character if line starts with a plus
    // which would usually open a new list but we want
    // to avoid that behaviour in our case (not in code,
    // where `+ line` is a diff)
    outsideCode(text, (part) => part.replace(RE_PLUS, "\u200B$&"))
      // Replace empty lines with non-breaking space
      // because remark renderer is collapsing empty
      // or otherwise whitespace-only lines of text
      .replace(RE_EMPTY_LINE, "\n\u200B\n")

      // Reverts previous empty line operation specifically for codeblocks.
      // Hacky solution, I know, but so far I haven't found a more elegant
      // way of achieving this.
      .replace(RE_CODEBLOCK_EMPTY_LINE_FIX, "")

      // Ensure empty line after blockquotes for correct rendering
      .replace(RE_BLOCKQUOTE, "$&\n")

      // Prevent spoilers from breaking on links at end
      .replace(RE_SPOILER_URL, "$1 ||")
  );
}

/**
 * Replace \u200B with break elements
 */
export function remarkInsertBreaks() {
  return (tree: import("hast").Root) => {
    /**
     * Process element and sub-tree
     * @param element Element
     * @returns Element
     */
    type RecurseNode = Record<string, unknown> & { children: unknown[] };
    function recurse(element: RecurseNode, onlyChild = true): unknown {
      if (element.type === "text") {
        // only a placeholder that fills a whole line stands for an empty
        // line; one that sits before inline content (e.g. a line starting
        // with an HTML tag) must not push that content onto a new line
        if (element.value === "\u200B" && onlyChild) {
          return {
            type: "element",
            tagName: "br",
            properties: {},
            children: [],
          };
        }
      }

      return {
        ...element,
        children: element.children?.map((child) =>
          recurse(child as RecurseNode, element.children.length === 1),
        ),
      };
    }

    return recurse(tree as unknown as RecurseNode) as typeof tree;
  };
}
