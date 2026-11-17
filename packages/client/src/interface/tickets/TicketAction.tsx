import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";

import {
  ContextMenu,
  ContextMenuButton,
  ContextMenuDivider,
} from "@revolt/app/menus/ContextMenu";
import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { IconButton } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { saveText, ticketTranscript } from "./transcript";

/**
 * A ticket's actions, as rows of a menu:
 * open: "Take ticket" / "Give back" for the staff, "Save the conversation",
 * "Close ticket" for its opener and the staff;
 * closed (only the staff still see it): "Save the conversation", "Reopen
 * ticket", and "Delete ticket" for those who manage channels.
 *
 * The header keeps one button for all of them (owner, 2026-11-17: only
 * Search stays in the header, the rest goes behind the three dots); on
 * phones the rows join the header's own More sheet.
 */
export function TicketMenuItems(props: { channel: Channel }) {
  const client = useClient();
  const { openModal, showError } = useModals();
  const [pending, setPending] = createSignal(false);

  const ticket = () => props.channel.ticket;
  const me = () => client().user?.id;
  const mine = () => ticket()?.openerId === me();
  const claimedBy = () => ticket()?.claimedById;

  async function run(action: () => Promise<unknown>) {
    if (pending()) return;
    setPending(true);
    try {
      await action();
    } catch (error) {
      showError(error);
    } finally {
      setPending(false);
    }
  }

  const save = () =>
    run(async () =>
      saveText(
        `${props.channel.name}.txt`,
        await ticketTranscript(props.channel),
      ),
    );

  return (
    <>
      <Show when={!ticket()?.closed && !mine()}>
        <Show
          when={claimedBy() === me()}
          fallback={
            <ContextMenuButton
              icon={<Icon name="clipboard-check" size={20} />}
              data-testid="ticket-claim"
              onClick={() => void run(() => props.channel.claimTicket())}
            >
              <Trans>Take ticket</Trans>
            </ContextMenuButton>
          }
        >
          <ContextMenuButton
            icon={<Icon name="arrow-u-up-left" size={20} />}
            data-testid="ticket-unclaim"
            onClick={() => void run(() => props.channel.unclaimTicket())}
          >
            <Trans>Give back</Trans>
          </ContextMenuButton>
        </Show>
      </Show>
      <ContextMenuButton
        icon={<Icon name="file-text" size={20} />}
        data-testid="ticket-save"
        onClick={() => void save()}
      >
        <Trans>Save the conversation</Trans>
      </ContextMenuButton>
      <ContextMenuDivider />
      <Show
        when={ticket()?.closed}
        fallback={
          <ContextMenuButton
            icon={<Icon name="x-circle" size={20} />}
            data-testid="ticket-close"
            onClick={() =>
              openModal({ type: "close_ticket", channel: props.channel })
            }
          >
            <Trans>Close ticket</Trans>
          </ContextMenuButton>
        }
      >
        <ContextMenuButton
          icon={<Icon name="lock-simple-open" size={20} />}
          data-testid="ticket-reopen"
          onClick={() => void run(() => props.channel.reopenTicket())}
        >
          <Trans>Reopen ticket</Trans>
        </ContextMenuButton>
        {/* a closed ticket goes for good: for those who manage channels */}
        <Show when={props.channel.havePermission("ManageChannel")}>
          <ContextMenuButton
            destructive
            icon={<Icon name="trash" size={20} />}
            data-testid="ticket-delete"
            onClick={() =>
              openModal({ type: "delete_channel", channel: props.channel })
            }
          >
            <Trans>Delete ticket</Trans>
          </ContextMenuButton>
        </Show>
      </Show>
    </>
  );
}

/**
 * The one header button that opens a ticket's actions (desktop)
 */
export function TicketAction(props: { channel: Channel }) {
  const { t } = useLingui();

  return (
    <div
      style={{ display: "contents" }}
      use:floating={{
        contextMenu: () => (
          <ContextMenu>
            <TicketMenuItems channel={props.channel} />
          </ContextMenu>
        ),
        contextMenuHandler: "click",
      }}
    >
      <IconButton
        variant="toolbar"
        size="xs"
        aria-label={t`Ticket actions`}
        aria-haspopup="menu"
        data-testid="ticket-menu"
        use:floating={{
          tooltip: { placement: "bottom", content: t`Ticket actions` },
        }}
      >
        <Icon name="dots-three" size={20} />
      </IconButton>
    </div>
  );
}
