import { Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { useMutation } from "@tanstack/solid-query";

import { useClient } from "@revolt/client";
import { Dialog, DialogProps } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Modal to close a ticket
 *
 * [ticket] Close this ticket?
 *           (what happens, for its opener or for the staff)
 * [                      Cancel   [ Close ticket ] ]
 */
export function CloseTicketModal(
  props: DialogProps & Modals & { type: "close_ticket" },
) {
  const { showError } = useModals();
  const client = useClient();

  const close = useMutation(() => ({
    mutationFn: () => props.channel.closeTicket(),
    onError: showError,
  }));

  const mine = () => props.channel.ticket?.openerId === client().user?.id;

  return (
    <Dialog
      size="sm"
      iconName="ticket"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Close this ticket?</Trans>}
      description={
        <Show
          when={mine()}
          fallback={
            <Trans>
              The member who opened it will no longer see it. You can reopen
              it or delete it later.
            </Trans>
          }
        >
          <Trans>
            You will no longer see this ticket. The staff keep it and can
            open it again for you.
          </Trans>
        </Show>
      }
      actions={[
        { text: <Trans>Cancel</Trans>, variant: "text" },
        {
          text: <Trans>Close ticket</Trans>,
          isLoading: close.isPending,
          onClick: () => close.mutateAsync(),
        },
      ]}
      isDisabled={close.isPending}
    >
      {null}
    </Dialog>
  );
}
