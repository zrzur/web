import { For, Match, Show, Switch, createResource } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import type { Channel, Server, ServerMember } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import {
  Avatar,
  Button,
  SettingsRow,
  SettingsSection,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { fetchAllMembers } from "./members/fetchMemberPage";

/**
 * Bots in this server: who they are and a way to remove them. Removing is
 * a kick, which the server checks like any other (Kick Members).
 */
export function ServerBots(props: { server: Server }) {
  const { openModal } = useModals();
  const client = useClient();

  const [bots] = createResource(
    () => props.server.id,
    async () => {
      const members = await fetchAllMembers(client(), props.server);
      return members.filter((member) => member.user?.bot);
    },
  );

  // the same check as the member menu: only bots ranked below you
  const canKick = (member: ServerMember) =>
    props.server.havePermission("KickMembers") &&
    !!props.server.member &&
    member.inferiorTo(props.server.member);

  return (
    <SettingsSection>
      <Switch>
        <Match when={bots.loading}>
          <SettingsRow title={<Trans>Loading…</Trans>} />
        </Match>
        <Match when={bots.error}>
          <SettingsRow
            icon={<Icon name="warning-circle" size={20} />}
            title={<Trans>Couldn't load the bots.</Trans>}
          />
        </Match>
        <Match when={bots()?.length === 0}>
          <SettingsRow
            icon={<Icon name="robot" size={20} />}
            title={<Trans>No bots in this server.</Trans>}
            description={<Trans>Bots you add show up here.</Trans>}
          />
        </Match>
        <Match when={bots()}>
          <For each={bots()}>
            {(member) => (
              <SettingsRow
                icon={<Avatar src={member.user?.animatedAvatarURL} size={24} />}
                title={member.displayName}
                description={`@${member.user?.username ?? ""}`}
                control={() => (
                  <Show when={canKick(member)}>
                    <Button
                      size="sm"
                      variant="tonal"
                      onPress={() => openModal({ type: "kick_member", member })}
                    >
                      <Trans>Remove</Trans>
                    </Button>
                  </Show>
                )}
              />
            )}
          </For>
        </Match>
      </Switch>
    </SettingsSection>
  );
}
