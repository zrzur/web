import { Show, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";

import { useModals } from "@revolt/modal";
import { Button } from "@revolt/ui";

/**
 * The action of a ticket, in its channel header: "Close ticket" while it is
 * open (for its opener and the staff), "Reopen ticket" once it is closed
 * (only the staff still see it then).
 */
export function TicketAction(props: { channel: Channel }) {
  const { openModal, showError } = useModals();
  const [pending, setPending] = createSignal(false);

  async function reopen() {
    if (pending()) return;
    setPending(true);
    try {
      await props.channel.reopenTicket();
    } catch (error) {
      showError(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <Show
      when={props.channel.ticket?.closed}
      fallback={
        <Button
          size="sm"
          variant="tonal"
          data-testid="ticket-close"
          onPress={() =>
            openModal({ type: "close_ticket", channel: props.channel })
          }
        >
          <Trans>Close ticket</Trans>
        </Button>
      }
    >
      <Button
        size="sm"
        variant="tonal"
        data-testid="ticket-reopen"
        isDisabled={pending()}
        onPress={() => void reopen()}
      >
        <Trans>Reopen ticket</Trans>
      </Button>
    </Show>
  );
}
