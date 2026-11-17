import { Match, Show, Switch, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";
import type { JSX } from "solid-js";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useDevice } from "@revolt/common";
import { useModals } from "@revolt/modal";
import { Button, IconButton } from "@revolt/ui";
import { type IconName, Icon } from "@revolt/ui/icons/Icon";

import { saveText, ticketTranscript } from "./transcript";

/**
 * A ticket's actions, in its channel header.
 * Open: who is on it, "Take ticket" / "Give back" for the staff, "Save the
 * conversation", "Close ticket" for its opener and the staff.
 * Closed (only the staff still see it): what the opener gave the help,
 * "Save the conversation", "Reopen ticket".
 */
export function TicketAction(props: { channel: Channel }) {
  const { t } = useLingui();
  const client = useClient();
  const { layout } = useDevice();
  const { openModal, showError } = useModals();
  const [pending, setPending] = createSignal(false);

  const ticket = () => props.channel.ticket;
  const me = () => client().user?.id;
  const mine = () => ticket()?.openerId === me();
  const claimedBy = () => ticket()?.claimedById;
  const nameOf = (id: string) =>
    client().serverMembers.getByKey({
      server: props.channel.serverId!,
      user: id,
    })?.displayName ??
    client().users.get(id)?.displayName ??
    "";

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

  const phone = () => layout() === "phone";

  /** A named button; on a phone its icon alone, so the header keeps its width */
  const act = (
    testId: string,
    icon: IconName,
    label: string,
    text: JSX.Element,
    onPress: () => void,
    disabled = false,
  ) => (
    <Show
      when={phone()}
      fallback={
        <Button
          size="sm"
          variant="tonal"
          data-testid={testId}
          isDisabled={disabled}
          onPress={onPress}
        >
          {text}
        </Button>
      }
    >
      <IconButton
        variant="toolbar"
        size="xs"
        isDisabled={disabled}
        aria-label={label}
        data-testid={testId}
        onPress={onPress}
      >
        <Icon name={icon} size={20} />
      </IconButton>
    </Show>
  );

  return (
    <Bar>
      <Show when={ticket()?.rating}>
        {(rating) => (
          <Note
            data-testid="ticket-rating"
            aria-label={t`Rated ${rating()} out of 5`}
          >
            <Icon name="star" size={16} />
            {rating()}/5
          </Note>
        )}
      </Show>
      <Show when={!ticket()?.closed && claimedBy() && claimedBy() !== me()}>
        <Show when={layout() !== "phone"}>
          <Note data-testid="ticket-claimed">
            <Trans>{nameOf(claimedBy()!)} is on it</Trans>
          </Note>
        </Show>
      </Show>
      <IconButton
        variant="toolbar"
        size="xs"
        isDisabled={pending()}
        aria-label={t`Save the conversation`}
        data-testid="ticket-save"
        onPress={() => void save()}
        use:floating={{
          tooltip: {
            placement: "bottom",
            content: t`Save the conversation`,
          },
        }}
      >
        <Icon name="download-simple" size={20} />
      </IconButton>
      <Switch>
        <Match when={ticket()?.closed}>
          {act(
            "ticket-reopen",
            "arrow-counter-clockwise",
            t`Reopen ticket`,
            <Trans>Reopen ticket</Trans>,
            () => void run(() => props.channel.reopenTicket()),
            pending(),
          )}
          {/* a closed ticket goes for good: for those who manage channels */}
          <Show when={props.channel.havePermission("ManageChannel")}>
            {act(
              "ticket-delete",
              "trash",
              t`Delete ticket`,
              <Trans>Delete ticket</Trans>,
              () =>
                openModal({ type: "delete_channel", channel: props.channel }),
            )}
          </Show>
        </Match>
        <Match when={true}>
          <Show when={!mine()}>
            <Show
              when={claimedBy() === me()}
              fallback={act(
                "ticket-claim",
                "clipboard-check",
                t`Take ticket`,
                <Trans>Take ticket</Trans>,
                () => void run(() => props.channel.claimTicket()),
                pending(),
              )}
            >
              {act(
                "ticket-unclaim",
                "arrow-u-up-left",
                t`Give back`,
                <Trans>Give back</Trans>,
                () => void run(() => props.channel.unclaimTicket()),
                pending(),
              )}
            </Show>
          </Show>
          {act(
            "ticket-close",
            "x",
            t`Close ticket`,
            <Trans>Close ticket</Trans>,
            () => openModal({ type: "close_ticket", channel: props.channel }),
          )}
        </Match>
      </Switch>
    </Bar>
  );
}

const Bar = styled("div", {
  base: {
    // never squeezed: squeezed buttons end up on top of each other
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    _phone: { gap: "4px" },
  },
});

const Note = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    paddingInline: "8px",
    height: "28px",
    borderRadius: "999px",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-secondary)",
    fontSize: "13px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    "--z-icon-color": "var(--z-warning)",
  },
});
