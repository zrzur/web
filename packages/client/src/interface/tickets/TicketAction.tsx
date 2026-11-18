import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";

import {
  ContextMenuButton,
  ContextMenuDivider,
} from "@revolt/app/menus/ContextMenu";
import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { IconButton } from "@revolt/ui";
import { type IconName, Icon } from "@revolt/ui/icons/Icon";

import { saveText, ticketTranscript } from "./transcript";

/**
 * A ticket's actions, as rows of a menu:
 * open: "Take ticket" / "Give back" for the staff, "Save the conversation",
 * "Close ticket" for its opener and the staff;
 * closed (only the staff still see it): "Save the conversation", "Reopen
 * ticket", and "Delete ticket" for those who manage channels.
 *
 * Phones: the rows join the header's own More sheet. A computer shows the
 * same actions as icons in the header (`TicketAction` below).
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
 * A ticket's actions in the header of a computer's window: one icon each,
 * beside the header's other icons (owner, 2026-11-18: the three dots are the
 * phone's way; on a computer the actions stand in the row). The same rules
 * as the menu rows above.
 */
export function TicketAction(props: { channel: Channel }) {
  const { t } = useLingui();
  const client = useClient();
  const { openModal, showError } = useModals();
  const [pending, setPending] = createSignal(false);

  const ticket = () => props.channel.ticket;
  const me = () => client().user?.id;
  const mine = () => ticket()?.openerId === me();

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

  /** One icon of the row */
  const Action = (action: {
    label: string;
    icon: IconName;
    testId: string;
    danger?: boolean;
    onPress: () => void;
  }) => (
    <IconButton
      variant="toolbar"
      size="xs"
      aria-label={action.label}
      data-testid={action.testId}
      isDisabled={pending()}
      onPress={action.onPress}
      use:floating={{ tooltip: { placement: "bottom", content: action.label } }}
    >
      <span
        style={{
          display: "contents",
          "--z-icon-color": action.danger ? "var(--z-danger)" : undefined,
        }}
      >
        <Icon name={action.icon} size={20} />
      </span>
    </IconButton>
  );

  return (
    <>
      <Show when={!ticket()?.closed && !mine()}>
        <Show
          when={ticket()?.claimedById === me()}
          fallback={
            <Action
              label={t`Take ticket`}
              icon="clipboard-check"
              testId="ticket-claim"
              onPress={() => void run(() => props.channel.claimTicket())}
            />
          }
        >
          <Action
            label={t`Give back`}
            icon="arrow-u-up-left"
            testId="ticket-unclaim"
            onPress={() => void run(() => props.channel.unclaimTicket())}
          />
        </Show>
      </Show>
      <Action
        label={t`Save the conversation`}
        icon="file-text"
        testId="ticket-save"
        onPress={() =>
          void run(async () =>
            saveText(
              `${props.channel.name}.txt`,
              await ticketTranscript(props.channel),
            ),
          )
        }
      />
      <Show
        when={ticket()?.closed}
        fallback={
          <Action
            label={t`Close ticket`}
            icon="x-circle"
            testId="ticket-close"
            onPress={() =>
              openModal({ type: "close_ticket", channel: props.channel })
            }
          />
        }
      >
        <Action
          label={t`Reopen ticket`}
          icon="lock-simple-open"
          testId="ticket-reopen"
          onPress={() => void run(() => props.channel.reopenTicket())}
        />
        <Show when={props.channel.havePermission("ManageChannel")}>
          <Action
            label={t`Delete ticket`}
            icon="trash"
            testId="ticket-delete"
            danger
            onPress={() =>
              openModal({ type: "delete_channel", channel: props.channel })
            }
          />
        </Show>
      </Show>
    </>
  );
}
