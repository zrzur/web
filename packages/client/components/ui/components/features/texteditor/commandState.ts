import { createSignal } from "solid-js";

/**
 * Bridge between the message box and the slash command bar: the bar reads
 * the text and cursor, tells the editor which option names to show as
 * chips, and edits the text. It has no CodeMirror code, so the command bar
 * does not load the text editor (codeMirrorCommand.ts connects it).
 */
export type CommandLayout = {
  /** End of `/command sub ` */
  prefix: number;
  options: { name: string; required: boolean }[];
  /** Mark required options that are still empty (after a failed send) */
  showMissing: boolean;
};

/** The message box being typed in, as seen by the command bar */
export interface CommandTarget {
  /** Draw the chips again */
  refresh(): void;
  /** Replace part of the text and put the cursor at `cursorAt` */
  edit(from: number, to: number, insert: string, cursorAt?: number): void;
  /** Move the cursor */
  move(position: number): void;
}

const [layout, setLayoutSignal] = createSignal<CommandLayout>();
const [text, setText] = createSignal("");
const [cursor, setCursor] = createSignal(0);

let target: CommandTarget | undefined;

/** Text and cursor of the message box being typed in */
export const commandEditor = { text, cursor, layout };

/**
 * Follow a message box (called by the editor)
 * @param next Box being typed in
 * @param doc Its text
 * @param head Its cursor
 */
export function trackCommandTarget(
  next: CommandTarget,
  doc: string,
  head: number,
) {
  target = next;
  setText(doc);
  setCursor(head);
}

/** Show these options as chips (undefined: no command chosen) */
export function setCommandLayout(next: CommandLayout | undefined) {
  setLayoutSignal(next);
  // may be called while the editor is updating (from an effect on its text)
  queueMicrotask(() => target?.refresh());
}

/** Replace part of the text and put the cursor at `cursorAt` (or after the insert) */
export function editCommandText(
  from: number,
  to: number,
  insert: string,
  cursorAt?: number,
) {
  target?.edit(from, to, insert, cursorAt);
}

/** Move the cursor */
export function moveCommandCursor(position: number) {
  target?.move(position);
}
