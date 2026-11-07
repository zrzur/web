/**
 * Whether a message needs maths or code highlighting: `$$` maths, or a
 * fenced code block with a language (blocks without one stay plain)
 * @param content Markdown source
 */
export function needsRichMarkdown(content: string) {
  return content.includes("$$") || /```[ \t]*[\w+#-]/.test(content);
}
