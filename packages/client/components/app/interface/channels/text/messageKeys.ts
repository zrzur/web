/**
 * Keys on a message: the one under the pointer, or the one with keyboard
 * focus (Up and Down move between messages in the list). Listed in Ctrl+/.
 *
 *   R             reply
 *   E             edit (your own)
 *   Delete        delete (your own; asks first)
 *   Shift+Delete  delete without asking
 *   P             pin or unpin (where you may; asks first)
 *   Ctrl+C        copy the text (Command+C on a Mac), when nothing is selected
 *
 * Keys are matched by their place on the keyboard (`event.code`), so they
 * are the same on Arabic and German layouts. A single key never acts while
 * you type in a text field.
 */
import type { Message } from "@zrzur/sdk/solid";

import { isTypingTarget } from "../../../../keybinds/shortcuts";

export type MessageKeyAction =
  | "reply"
  | "edit"
  | "delete"
  | "delete_now"
  | "pin"
  | "copy";

type KeyLike = Pick<
  KeyboardEvent,
  "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
> & { isComposing?: boolean };

/** The fixed keys, for the shortcuts screen and `aria-keyshortcuts` */
export const MESSAGE_KEYS: Record<MessageKeyAction, string[]> = {
  reply: ["R"],
  edit: ["E"],
  delete: ["Delete"],
  delete_now: ["Shift", "Delete"],
  pin: ["P"],
  copy: ["Mod", "C"],
};

/** What this key press does to a message, if anything */
export function messageKeyAction(
  event: KeyLike,
  mac: boolean,
): MessageKeyAction | undefined {
  if (event.isComposing) return;
  const mod = mac ? event.metaKey : event.ctrlKey;
  // the other one of Ctrl and Command, or Alt: never a message key
  const other = mac ? event.ctrlKey : event.metaKey;
  if (event.altKey || other) return;
  if (mod) return event.code === "KeyC" && !event.shiftKey ? "copy" : undefined;
  if (event.code === "Delete") return event.shiftKey ? "delete_now" : "delete";
  if (event.shiftKey) return;
  switch (event.code) {
    case "KeyR":
      return "reply";
    case "KeyE":
      return "edit";
    case "KeyP":
      return "pin";
  }
}

/** `aria-keyshortcuts` for a message row */
export function messageAriaKeys(mac: boolean) {
  return `R E P Delete Shift+Delete ${mac ? "Meta" : "Control"}+C`;
}

/** The message row a key press is about: focused first, then hovered */
export function targetMessageRow(doc: Document = document) {
  const focused = doc.activeElement?.closest<HTMLElement>("[data-message-row]");
  if (focused) return focused;
  // a row under the pointer, in the open conversation only
  return (
    doc.querySelector<HTMLElement>(
      "[data-message-scroller] [data-message-row]:hover",
    ) ?? undefined
  );
}

export type MessageKeyDeps = {
  mac: boolean;
  /** The message with this id, if loaded */
  message: (id: string) => Message | undefined;
  /** Whether a window is open over the app (then keys go to it) */
  blocked: () => boolean;
  /** Whether you may write in this message's channel */
  canReply: (message: Message) => boolean;
  canEdit: (message: Message) => boolean;
  canPin: (message: Message) => boolean;
  reply: (message: Message) => void;
  edit: (message: Message) => void;
  /** Ask, then delete (`now`: without asking) */
  remove: (message: Message, now: boolean) => void;
  pin: (message: Message) => void;
  copy: (text: string) => void;
};

/**
 * Handle a key press for the targeted message
 * @returns Whether the key did something (then the page's own use is stopped)
 */
export function handleMessageKey(
  event: KeyboardEvent,
  deps: MessageKeyDeps,
): boolean {
  if (event.defaultPrevented || isTypingTarget(event.target)) return false;
  const action = messageKeyAction(event, deps.mac);
  if (!action || deps.blocked()) return false;
  const row = targetMessageRow();
  const id = row?.dataset.messageRow;
  const message = id ? deps.message(id) : undefined;
  if (!message || message.author?.official) return false;

  switch (action) {
    case "reply":
      if (!deps.canReply(message)) return false;
      deps.reply(message);
      return true;
    case "edit":
      if (!deps.canEdit(message)) return false;
      deps.edit(message);
      return true;
    case "delete":
    case "delete_now":
      if (!message.author?.self) return false;
      deps.remove(message, action === "delete_now");
      return true;
    case "pin":
      if (!deps.canPin(message)) return false;
      deps.pin(message);
      return true;
    case "copy": {
      // selected text is copied by the browser as usual
      const selection = document.getSelection();
      if (selection && !selection.isCollapsed) return false;
      if (!message.content) return false;
      deps.copy(message.content);
      return true;
    }
  }
}

/**
 * Up and Down in the message list move the keyboard focus from message to
 * message, so the keys above work without a mouse
 * @returns Whether focus moved
 */
export function moveMessageFocus(event: KeyboardEvent): boolean {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
    return false;
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return false;
  const target = event.target as HTMLElement | null;
  const scroller = target?.closest<HTMLElement>("[data-message-scroller]");
  if (!scroller) return false;
  // only from the list itself or a message row, not a button inside one
  const fromRow = target!.matches("[data-message-row]");
  if (!fromRow && target !== scroller) return false;
  const rows = [
    ...scroller.querySelectorAll<HTMLElement>("[data-message-row]"),
  ];
  if (!rows.length) return false;
  const at = fromRow ? rows.indexOf(target!) : -1;
  const next =
    at < 0
      ? // from the list: the newest message in view
        (lastInView(rows, scroller) ?? rows.at(-1)!)
      : rows[at + (event.key === "ArrowUp" ? -1 : 1)];
  if (!next) return false;
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: "nearest" });
  return true;
}

function lastInView(rows: HTMLElement[], scroller: HTMLElement) {
  const box = scroller.getBoundingClientRect();
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i].getBoundingClientRect();
    if (r.top < box.bottom && r.bottom > box.top) return rows[i];
  }
}

/**
 * Page Up and Page Down scroll the conversation from the message box too
 * (a short draft has nothing of its own to page through)
 * @returns Whether the conversation scrolled
 */
export function pageMessages(event: KeyboardEvent): boolean {
  if (event.code !== "PageUp" && event.code !== "PageDown") return false;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
    return false;
  const target = event.target as HTMLElement | null;
  // the list scrolls itself when it has focus
  if (target?.closest("[data-message-scroller]")) return false;
  const editor = target?.closest(".cm-editor");
  if (target && target !== document.body && !editor) return false;
  const own = editor?.querySelector<HTMLElement>(".cm-scroller");
  if (own && own.scrollHeight > own.clientHeight + 1) return false;
  const scroller = document.querySelector<HTMLElement>(
    "[data-message-scroller]",
  );
  if (!scroller) return false;
  const by = Math.max(40, scroller.clientHeight * 0.85);
  scroller.scrollBy({ top: event.code === "PageUp" ? -by : by });
  return true;
}
