/**
 * What other parts of the app may do with a mounted text editor, without
 * loading CodeMirror themselves (the editor is a lazy chunk). TextEditor2
 * registers its root element (.cm-editor) here.
 */
export interface EditorHooks {
  /** Document position under a point on screen, or null */
  posAt(x: number, y: number): number | null;
  /** Focus the editor and put the caret at `pos` (when given) */
  focusAt(pos: number | null): void;
}

export const editorHooks = new WeakMap<Element, EditorHooks>();
