import { useLingui } from "@lingui/solid/macro";
import { createEffect } from "solid-js";

import { useClient } from "@revolt/client";
import { hasOldTag } from "@revolt/common/lib/userTag";
import { useModals } from "@revolt/modal";
import { useSnackbar } from "@revolt/ui";

import { usernameNoticeDue, usernameNoticeKey } from "./usernameNoticeDue";

/**
 * Tells a signed-in person whose account still has a number tag that
 * usernames are unique now, with a button that opens the dialog to pick
 * one. Bots are not told. Renders nothing.
 */
export function UsernameNotice() {
  const client = useClient();
  const snackbar = useSnackbar();
  const { openModal } = useModals();
  const { t } = useLingui();
  let told = false;

  createEffect(() => {
    const user = client().user;
    if (told || !user || user.bot || !hasOldTag(user)) return;

    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      storage = undefined;
    }
    if (!usernameNoticeDue(user.id, Date.now(), storage)) return;

    told = true;
    try {
      storage?.setItem(usernameNoticeKey(user.id), String(Date.now()));
    } catch {
      // storage is full or refused: the notice shows again next visit
    }

    snackbar.show({
      message: t`New: usernames no longer have a number tag. Choose the username that will be yours alone.`,
      action: t`Choose username`,
      closeable: true,
      messageLine: 2,
      placement: "bottom",
      closeOnAction: true,
      onAction: () => openModal({ type: "edit_username", client: client() }),
    });
  });

  return null;
}
