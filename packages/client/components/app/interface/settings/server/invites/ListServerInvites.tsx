import { For, Match, Show, Switch, createEffect, createSignal, on } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useQuery, useQueryClient } from "@tanstack/solid-query";
import { Channel, Server, ServerInvite } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import { HIDDEN } from "@revolt/state/streamer";
import { getInviteLink } from "@revolt/modal/modals/CreateInvite";
import { timeLeft } from "@revolt/modal/modals/inviteOptions";
import {
  Avatar,
  Button,
  IconButton,
  SettingsRow,
  SettingsSection,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { ConfirmDialog } from "../ConfirmDialog";

/**
 * List and invalidate server invites
 */
export function ListServerInvites(props: { server: Server }) {
  const { t } = useLingui();
  const client = useQueryClient();
  const instance = useInstance();
  const state = useState();
  const { openModal } = useModals();
  const query = useQuery(() => ({
    queryKey: ["invites", props.server.id],
    queryFn: () => props.server.fetchInvites() as Promise<ServerInvite[]>,
  }));

  const defaultChannel = () =>
    (props.server.defaultChannel || props.server.channels[0]) as
      | Channel
      | undefined;

  const [removing, setRemoving] = createSignal<ServerInvite>();

  async function deleteInvite(invite: ServerInvite) {
    await invite.delete();
    client.setQueryData(
      ["invites", props.server.id],
      query.data!.filter((entry) => entry.id !== invite.id),
    );
  }

  // a new invite shows up as soon as the "Create invite" window closes
  const modals = useModals();
  createEffect(
    on(
      () => modals.isOpen("create_invite"),
      (open, wasOpen) => {
        if (wasOpen && !open) query.refetch();
      },
      { defer: true },
    ),
  );

  async function createInvite() {
    const channel = defaultChannel();
    if (channel) openModal({ type: "create_invite", channel });
  }

  const usesLabel = (invite: ServerInvite) =>
    invite.maxUses
      ? t`${invite.uses} of ${invite.maxUses} uses`
      : t`${invite.uses} uses`;

  const leftLabel = (invite: ServerInvite) => {
    const left = timeLeft(invite.expires);
    switch (left.kind) {
      case "never":
        return t`Never expires`;
      case "expired":
        return t`Expired`;
      case "minutes":
        return t`${left.value} min left`;
      case "hours":
        return t`${left.value} h left`;
      case "days":
        return t`${left.value} days left`;
    }
  };

  // the custom link has its own page (Wings · Custom link)
  const invites = () =>
    query.data?.filter((entry) => entry.id !== props.server.vanityInvite?.code);

  return (
    <SettingsSection
      title={<Trans>Active invites</Trans>}
      description={
        <Trans>
          Anyone with one of these links can join. Delete a link to stop it
          working.
        </Trans>
      }
      aside={
        <Button
          size="sm"
          shape="square"
          onPress={createInvite}
          isDisabled={!defaultChannel()}
          use:floating={{
            tooltip: !defaultChannel()
              ? {
                  content: t`Create a channel before inviting others!`,
                  placement: "bottom",
                }
              : undefined,
          }}
        >
          <Icon name="plus" size={16} />
          <Trans>Create invite</Trans>
        </Button>
      }
    >
      <Switch>
        <Match when={query.isLoading}>
          <SettingsRow
            icon={<Icon name="link" size={20} />}
            title={<Trans>Loading invites…</Trans>}
          />
        </Match>
        <Match when={query.isError}>
          <SettingsRow
            icon={<Icon name="warning-circle" size={20} />}
            danger
            title={<Trans>Invites couldn't be loaded</Trans>}
          />
        </Match>
        <Match when={!invites()?.length}>
          <SettingsRow
            icon={<Icon name="link" size={20} />}
            title={<Trans>No active invites</Trans>}
            description={
              <Trans>Create one to bring people into this server.</Trans>
            }
          />
        </Match>
        <Match when={invites()}>
          <For each={invites()}>
            {(item) => (
              <SettingsRow
                icon={
                  <Avatar
                    src={item.creator?.animatedAvatarURL}
                    fallback={item.creator?.displayName}
                    size={32}
                  />
                }
                title={
                  <Code data-testid="invite-code">
                    {state.settings.streamerMode ? HIDDEN : item.id}
                  </Code>
                }
                description={
                  <>
                    #{item.channel?.name} ·{" "}
                    {item.creator?.displayName ?? t`Unknown user`} ·{" "}
                    {usesLabel(item)} · {leftLabel(item)}
                  </>
                }
                secondary={
                  <IconButton
                    variant="toolbar"
                    size="xs"
                    aria-label={t`Copy invite link`}
                    use:floating={{
                      tooltip: {
                        placement: "top",
                        content: t`Copy invite link`,
                      },
                    }}
                    onPress={() =>
                      navigator.clipboard.writeText(
                        getInviteLink(item.id, instance),
                      )
                    }
                  >
                    <Icon name="copy" size={18} />
                  </IconButton>
                }
                control={() => (
                  <Danger>
                    <IconButton
                      variant="toolbar"
                      size="xs"
                      aria-label={t`Delete invite`}
                      use:floating={{
                        tooltip: {
                          placement: "top",
                          content: t`Delete invite`,
                        },
                      }}
                      onPress={() => setRemoving(item)}
                    >
                      <Icon name="trash" size={18} />
                    </IconButton>
                  </Danger>
                )}
              />
            )}
          </For>
        </Match>
      </Switch>
      <Show when={removing()}>
        {(invite) => (
          <ConfirmDialog
            title={<Trans>Delete this invite?</Trans>}
            confirm={<Trans>Delete invite</Trans>}
            onConfirm={() => deleteInvite(invite())}
            onClose={() => setRemoving(undefined)}
          >
            <Trans>
              The link stops working at once for everyone who has it.
            </Trans>
          </ConfirmDialog>
        )}
      </Show>
    </SettingsSection>
  );
}

const Code = styled("span", {
  base: {
    fontFamily: "var(--fonts-monospace)",
    fontSize: "13px",
    letterSpacing: "0.02em",
  },
});

/** Delete turns red on hover, colour only */
const Danger = styled("span", {
  base: {
    "& button:hover": {
      "--z-icon-color": "var(--z-icon-danger) !important",
      "--colour": "var(--z-danger) !important",
    },
  },
});
