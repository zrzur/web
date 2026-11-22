import { onCleanup } from "solid-js";

import { useClient } from "@revolt/client";
import { deviceMac } from "@revolt/keybinds/active";
import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";

import { canSend, threadIsReadOnly } from "../threadAccess";
import { editableByMe } from "./editable";
import {
  handleMessageKey,
  moveMessageFocus,
  pageMessages,
} from "./messageKeys";

/**
 * Keys on messages while a conversation is open (see messageKeys.ts): the
 * keys on a message, Up and Down between messages, Page Up and Page Down
 * from the message box. Heard before the app's "start typing" key, so R on
 * a message replies instead of typing an "r".
 */
export function useMessageKeys() {
  const client = useClient();
  const state = useState();
  const { openModal, isOpen, showError } = useModals();
  const mac = deviceMac();

  const onKeyDown = (event: KeyboardEvent) => {
    if (moveMessageFocus(event)) {
      event.preventDefault();
      return;
    }
    if (pageMessages(event)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.repeat) return;
    const done = handleMessageKey(event, {
      mac,
      message: (id) => client().messages.get(id),
      blocked: () =>
        isOpen() || !!document.querySelector("[role=dialog][aria-modal=true]"),
      canReply: (message) =>
        !!message.channel &&
        canSend(message.channel) &&
        !threadIsReadOnly(message.channel),
      canEdit: (message) =>
        editableByMe(message) && !!message.channel && canSend(message.channel),
      canPin: (message) =>
        message.channel?.type === "DirectMessage" ||
        !!message.channel?.havePermission("ManageMessages"),
      reply: (message) => state.draft.addReply(message, client().user!.id),
      edit: (message) => state.draft.setEditingMessage(message),
      remove: (message, now) =>
        now
          ? void message.delete().catch(showError)
          : openModal({ type: "delete_message", message }),
      pin: (message) => openModal({ type: "pin_message", message }),
      copy: (text) => void navigator.clipboard?.writeText(text),
    });
    if (done) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  document.addEventListener("keydown", onKeyDown, true);
  onCleanup(() => document.removeEventListener("keydown", onKeyDown, true));
}
