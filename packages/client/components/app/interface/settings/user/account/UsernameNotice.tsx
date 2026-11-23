import { useLingui } from "@lingui/solid/macro";
import { createEffect, createSignal } from "solid-js";

import { useClient } from "@revolt/client";
import { useDevice } from "@revolt/common";
import { hasOldTag } from "@revolt/common/lib/userTag";
import { useModals } from "@revolt/modal";
import { useSnackbar } from "@revolt/ui";

import { usernameNoticeDue, usernameNoticeKey } from "./usernameNoticeDue";

/**
 * Whether the notice is on screen: other one-time questions wait for it
 * (on a phone both would lie over each other)
 */
const [usernameNoticeOpen, setUsernameNoticeOpen] = createSignal(false);
export { usernameNoticeOpen };

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
  const { layout } = useDevice();
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

    setUsernameNoticeOpen(true);
    snackbar.show({
      onClose: () => setUsernameNoticeOpen(false),
      message: t`New: usernames no longer have a number tag. Choose the username that will be yours alone.`,
      action: t`Choose username`,
      closeable: true,
      messageLine: 2,
      placement: "bottom",
      // phones: it lies over the lower rows of a list or a menu, so it
      // leaves by itself; the same choice stays in Settings, My account
      autoCloseDelay: layout() === "phone" ? 12_000 : undefined,
      closeOnAction: true,
      onAction: () => openModal({ type: "edit_username", client: client() }),
    });
  });

  return null;
}
