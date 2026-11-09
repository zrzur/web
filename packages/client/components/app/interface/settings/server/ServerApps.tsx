import { For, Match, Show, Switch, createResource } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import type { Server, ServerMember } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { Avatar, Button, SettingsRow, SettingsSection } from "@revolt/ui";
import { BotLabel } from "@revolt/ui/components/features/profiles/BotLabel";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSettingsNavigation } from "../Settings";

import { serverAppsApi } from "./apps/api";
import { fetchAllMembers } from "./members/fetchMemberPage";

/**
 * Bots in this server. With Manage Server each one opens its own page (who
 * added it, its permissions, its commands and who may use them, Remove).
 * With Kick Members only, a bot can be kicked like any member.
 */
export function ServerBots(props: { server: Server }) {
  const { openModal } = useModals();
  const { navigate } = useSettingsNavigation();
  const client = useClient();
  const manage = () => props.server.havePermission("ManageServer");

  const [bots] = createResource(
    () => props.server.id,
    async () => {
      const members = await fetchAllMembers(client(), props.server);
      const bots = members.filter((member) => member.user?.bot);
      // who added each one, when the server kept a record
      const installs = manage()
        ? await serverAppsApi
            .installed(client(), props.server.id)
            .catch(() => [])
        : [];
      return bots.map((member) => ({
        member,
        install: installs.find(
          (entry) => entry.application._id === member.id.user,
        ),
      }));
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
            {({ member, install }) => (
              <SettingsRow
                icon={<Avatar src={member.user?.animatedAvatarURL} size={24} />}
                title={
                  <span data-bot-row={member.id.user}>
                    <bdi>{member.displayName}</bdi>{" "}
                    <BotLabel verified={member.user?.verifiedBot} />
                  </span>
                }
                description={
                  <Show
                    when={install?.installed_at}
                    fallback={`@${member.user?.username ?? ""}`}
                  >
                    {`@${member.user?.username ?? ""} · `}
                    <Trans>
                      Added{" "}
                      {new Date(install!.installed_at).toLocaleDateString()}
                    </Trans>
                  </Show>
                }
                navigational={manage()}
                onClick={
                  manage()
                    ? () => navigate(`apps/bot/${member.id.user}`)
                    : undefined
                }
                control={
                  manage()
                    ? undefined
                    : () => (
                        <Show when={canKick(member)}>
                          <Button
                            size="sm"
                            variant="tonal"
                            onPress={() =>
                              openModal({ type: "kick_member", member })
                            }
                          >
                            <Trans>Remove</Trans>
                          </Button>
                        </Show>
                      )
                }
              />
            )}
          </For>
        </Match>
      </Switch>
    </SettingsSection>
  );
}
