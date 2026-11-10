import { Show, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";

import { TranslatedError } from "@revolt/i18n/errors";
import { Dialog, DialogProps } from "@revolt/ui";

import { Modals } from "../types";

/**
 * Ask before ending a poll early: votes stop and the results are final
 */
export function EndPollModal(
  props: DialogProps & Modals & { type: "end_poll" },
) {
  const [error, setError] = createSignal<unknown>();
  const [ending, setEnding] = createSignal(false);

  async function end() {
    setEnding(true);
    setError(undefined);
    try {
      await props.message.endPoll();
      props.onClose();
    } catch (err) {
      setError(err);
    } finally {
      setEnding(false);
    }
  }

  return (
    <Dialog
      tone="warning"
      iconName="stop"
      size="sm"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>End poll now?</Trans>}
      actions={[
        { variant: "text", text: <Trans>Cancel</Trans> },
        {
          text: <Trans>End poll</Trans>,
          onClick: () => {
            void end();
            return false;
          },
          isLoading: ending(),
        },
      ]}
      isDisabled={ending()}
      error={
        <Show when={error()}>
          <TranslatedError error={error()} />
        </Show>
      }
    >
      <Trans>
        Voting stops for everyone and the results become final. This can't be
        undone.
      </Trans>
    </Dialog>
  );
}
