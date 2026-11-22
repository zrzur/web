/**
 * Ctrl+B bold and Ctrl+I italic in the message box (Command on a Mac),
 * matched by key position (`event.code`) so they work on Arabic and German
 * layouts. Markdown has no underline, so there is no Ctrl+U. Listed in
 * Ctrl+/.
 */
import { EditorSelection, Prec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export type FormatMark = "**" | "*";

type KeyLike = Pick<
  KeyboardEvent,
  "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
> & { isComposing?: boolean; keyCode?: number };

/** Which mark this key press puts around the selection, if any */
export function formatFor(
  event: KeyLike,
  mac: boolean,
): FormatMark | undefined {
  if (event.isComposing || event.keyCode === 229) return;
  if (event.shiftKey || event.altKey) return;
  const mod = mac ? event.metaKey : event.ctrlKey;
  const other = mac ? event.ctrlKey : event.metaKey;
  if (!mod || other) return;
  if (event.code === "KeyB") return "**";
  if (event.code === "KeyI") return "*";
}

/**
 * Put the mark around a selection, or take it off when it is already
 * there; with nothing selected, a pair of marks with the cursor between
 * @returns The text to write over `from…to` and where the selection goes
 *   after it
 */
export function toggleMark(
  doc: string,
  from: number,
  to: number,
  mark: FormatMark,
): { from: number; to: number; insert: string; anchor: number; head: number } {
  const n = mark.length;
  const inside = doc.slice(from, to);
  // stars right around the selection: 1 italic, 2 bold, 3 both
  const starsBefore = /\**$/.exec(doc.slice(Math.max(0, from - 3), from))![0]
    .length;
  const starsAfter = /^\**/.exec(doc.slice(to, to + 3))![0].length;
  const around = Math.min(starsBefore, starsAfter);
  const has = mark === "**" ? around >= 2 : around === 1 || around === 3;
  if (has)
    return {
      from: from - n,
      to: to + n,
      insert: inside,
      anchor: from - n,
      head: to - n,
    };
  return {
    from,
    to,
    insert: `${mark}${inside}${mark}`,
    anchor: from + n,
    head: to + n,
  };
}

/**
 * The editor extension. Highest precedence: CodeMirror's own keymap has
 * Mod-i (select the parent syntax node), which must not win.
 */
export function formatKeymap(mac: boolean) {
  return Prec.highest(
    EditorView.domEventHandlers({
      keydown(event, view) {
        const mark = formatFor(event, mac);
        if (!mark) return false;
        event.preventDefault();
        const doc = view.state.doc.toString();
        const result = view.state.changeByRange((range) => {
          const edit = toggleMark(doc, range.from, range.to, mark);
          return {
            changes: { from: edit.from, to: edit.to, insert: edit.insert },
            range: EditorSelection.range(edit.anchor, edit.head),
          };
        });
        view.dispatch(view.state.update(result, { scrollIntoView: true }));
        return true;
      },
    }),
  );
}
