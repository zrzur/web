/**
 * The box that holds the mentions, the saved messages and the reminders:
 * whether it is open and which list it shows. Kept apart from the box itself
 * so a message's menu, the You page and a shortcut can open it.
 */
import { createSignal } from "solid-js";

/** What the box shows */
export type InboxView = "mentions" | "saved" | "reminders";

const [open, setOpen] = createSignal(false);
const [view, setView] = createSignal<InboxView>("mentions");

export const inboxOpen = open;
export const inboxView = view;
export const setInboxView = setView;
export const closeInbox = () => setOpen(false);

/** Open the box on one of its lists */
export function openInbox(next: InboxView) {
  setView(next);
  setOpen(true);
}
