import { onCleanup } from "solid-js";

import { useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { deviceMac } from "@revolt/keybinds/active";
import { announce } from "@revolt/keybinds/announce";
import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import { useSnackbar } from "@revolt/ui";

import {
  handleMessageKey,
  messageAbilities,
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
  const { t } = useLingui();
  const client = useClient();
  const state = useState();
  const snackbar = useSnackbar();
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
      can: messageAbilities,
      reply: (message) => {
        state.draft.addReply(message, client().user!.id);
        const name =
          message.masquerade?.name ??
          message.member?.nickname ??
          message.author?.displayName ??
          message.username ??
          "";
        announce(t`Replying to ${name}`);
      },
      edit: (message) => state.draft.setEditingMessage(message),
      remove: (message, now) =>
        now
          ? void message.delete().catch(showError)
          : openModal({ type: "delete_message", message }),
      pin: (message) => openModal({ type: "pin_message", message }),
      copy: (message) => {
        // the text as it reads: names for mentions, not their ids
        const text = client().markdownToText(message.content ?? "");
        const write = navigator.clipboard?.writeText(text);
        if (!write) {
          snackbar.show({ message: t`The text could not be copied.` });
          return;
        }
        write.then(
          () => announce(t`Copied`),
          () => snackbar.show({ message: t`The text could not be copied.` }),
        );
      },
    });
    if (done) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  document.addEventListener("keydown", onKeyDown, true);
  onCleanup(() => document.removeEventListener("keydown", onKeyDown, true));
}
