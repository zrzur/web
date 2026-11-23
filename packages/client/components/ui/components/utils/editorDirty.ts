/**
 * Whether the text in a form's editor differs from the value it started
 * with. The editor hands over its text trimmed, so the start value is
 * trimmed too: a stored bio that ends in a new line is not an edit
 * (bug #13 of 2026-11-22: the unsaved-changes bar showed on its own).
 */
export function editorTextChanged(
  text: string,
  initialValue?: readonly [string],
): boolean {
  return text !== (initialValue?.[0] ?? "").trim();
}
