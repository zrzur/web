import { Show } from "solid-js";

import { lazyRetry } from "@revolt/ui/components/utils/lazyRetry";

import { closeModal, interactionState } from "./store";

// The form loads with the first one a bot opens: kept out of the files the
// app installs up front (scripts/precacheShell.mjs). A file that does not
// arrive is asked for again; if it still fails the form is dropped, so the
// next one the bot sends can open (nothing reloads the page)
const ModalForm = lazyRetry(
  () =>
    import("./InteractionModalForm").then((m) => ({ default: m.ModalForm })),
  () => {
    queueMicrotask(closeModal);
    return null;
  },
);

/**
 * Form a bot opened for this user. Answers go to that bot only and are
 * never logged here.
 */
export function InteractionModal() {
  const current = () => interactionState.modal;
  return (
    <Show when={current()} keyed>
      {(modal) => <ModalForm {...modal} />}
    </Show>
  );
}
