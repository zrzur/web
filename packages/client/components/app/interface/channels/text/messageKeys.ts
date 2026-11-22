/**
 * Keys on the message with keyboard focus (Up and Down move between
 * messages in the list, from the list or a clicked message). Never on a
 * message only under the pointer: with no field focused, a typed letter
 * goes into the message box as before. Listed in Ctrl+/.
 *
 *   R             reply
 *   E             edit (your own)
 *   Delete        delete (your own; asks first); on a Mac also Backspace
 *   Shift+Delete  delete without asking
 *   P             pin or unpin (where you may; asks first)
 *   Ctrl+C        copy the text (Command+C on a Mac), when nothing is selected
 *
 * Keys are matched by their place on the keyboard (`event.code`), so they
 * are the same on Arabic and German layouts. A single key never acts while
 * you type in a text field.
 */
import { createSignal } from "solid-js";

import type { Message } from "@zrzur/sdk/solid";

import { isTypingTarget } from "../../../../keybinds/shortcuts";
import { canSend, threadIsReadOnly } from "../threadAccess";
import { editableByMe } from "./editable";

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
> & { isComposing?: boolean; keyCode?: number };

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
  // a character being composed (Chinese, Japanese input), also in browsers
  // that only say so with key code 229
  if (event.isComposing || event.keyCode === 229) return;
  const mod = mac ? event.metaKey : event.ctrlKey;
  // the other one of Ctrl and Command, or Alt: never a message key
  const other = mac ? event.ctrlKey : event.metaKey;
  if (event.altKey || other) return;
  if (mod) return event.code === "KeyC" && !event.shiftKey ? "copy" : undefined;
  // a Mac's Delete key is Backspace; fn+Delete is the forward Delete
  if (event.code === "Delete" || (mac && event.code === "Backspace"))
    return event.shiftKey ? "delete_now" : "delete";
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

/** What a person may do to a message with the keys */
export type MessageAbilities = Record<
  "reply" | "edit" | "remove" | "pin" | "copy",
  boolean
>;

/** The keys a message takes for this person (the same rules as its menu) */
export function messageAbilities(message: Message): MessageAbilities {
  const channel = message.channel;
  const official = !!message.author?.official;
  const writable =
    !official && !!channel && canSend(channel) && !threadIsReadOnly(channel);
  return {
    reply: writable,
    edit: writable && editableByMe(message),
    remove: !official && !!message.author?.self,
    pin:
      !official &&
      !!channel &&
      (channel.type === "DirectMessage" ||
        channel.havePermission("ManageMessages")),
    copy: !!message.content,
  };
}

/** `aria-keyshortcuts` for a message row: only the keys it takes */
export function messageAriaKeys(mac: boolean, can: MessageAbilities) {
  return [
    can.reply && "R",
    can.edit && "E",
    can.pin && "P",
    can.remove && "Delete Shift+Delete",
    can.remove && mac && "Backspace Shift+Backspace",
    can.copy && `${mac ? "Meta" : "Control"}+C`,
  ]
    .filter(Boolean)
    .join(" ");
}

const [rovingRow, setRovingRow] = createSignal<string>();

/**
 * The message the keyboard was on last: the one message in the tab order
 * (a roving tab index), so Tab comes back to it
 */
export { rovingRow };

/** A message row got the focus */
export function noteRowFocus(id: string) {
  setRovingRow(id);
}

/**
 * The message row a key press is about: the one the keyboard moved the
 * focus to (a row a click focused shows no focus ring and takes no keys)
 */
export function targetMessageRow(doc: Document = document) {
  const active = doc.activeElement;
  // the row itself, not a link or button inside it
  if (!(active instanceof HTMLElement) || !active.matches("[data-message-row]"))
    return;
  return keyboardFocused(active) ? active : undefined;
}

function keyboardFocused(element: HTMLElement) {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

export type MessageKeyDeps = {
  mac: boolean;
  /** The message with this id, if loaded */
  message: (id: string) => Message | undefined;
  /** Whether a window is open over the app (then keys go to it) */
  blocked: () => boolean;
  /** What this person may do to the message */
  can: (message: Message) => MessageAbilities;
  reply: (message: Message) => void;
  edit: (message: Message) => void;
  /** Ask, then delete (`now`: without asking) */
  remove: (message: Message, now: boolean) => void;
  pin: (message: Message) => void;
  /** Copy the message's text as it reads (names, not ids) */
  copy: (message: Message) => void;
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
  const can = deps.can(message);

  switch (action) {
    case "reply":
      if (!can.reply) return false;
      deps.reply(message);
      return true;
    case "edit":
      if (!can.edit) return false;
      deps.edit(message);
      return true;
    case "delete":
    case "delete_now":
      if (!can.remove) return false;
      deps.remove(message, action === "delete_now");
      return true;
    case "pin":
      if (!can.pin) return false;
      deps.pin(message);
      return true;
    case "copy": {
      // selected text is copied by the browser as usual
      const selection = document.getSelection();
      if (selection && !selection.isCollapsed) return false;
      if (!can.copy) return false;
      deps.copy(message);
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
