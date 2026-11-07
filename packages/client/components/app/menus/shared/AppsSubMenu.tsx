import { For, Show, createMemo, createResource } from "solid-js";

import { i18n } from "@lingui/core";
import { Trans } from "@lingui/solid/macro";

import {
  loadServerCommands,
  runCommand,
} from "@revolt/app/interface/channels/text/interactions/store";
import { localized } from "@revolt/app/interface/channels/text/interactions/types";
import { useClient } from "@revolt/client";
import { Avatar } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { ContextMenuButton, ContextMenuSubMenu } from "../ContextMenu";

/**
 * "Apps": user and message commands of the bots in this server, run on the
 * user or message the menu was opened for
 */
export function AppsSubMenu(props: {
  kind: "User" | "Message";
  serverId?: string;
  channelId?: string;
  targetId: string;
  onClose?: () => void;
}) {
  const client = useClient();
  const [commands] = createResource(
    () => props.serverId,
    (serverId) => loadServerCommands(client(), serverId).catch(() => undefined),
  );

  const entries = createMemo(() => {
    const data = commands();
    if (!data || !props.channelId) return [];
    return data.commands
      .filter((command) => command.type === props.kind)
      .map((command) => ({
        command,
        app: data.applications.find((a) => a._id === command.application_id),
        name: localized(command.name, command.name_localizations, i18n.locale),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  return (
    <Show when={entries().length}>
      <ContextMenuSubMenu
        icon={<Icon name="robot" size={18} />}
        buttonContent={<Trans>Apps</Trans>}
      >
        <For each={entries()}>
          {(entry) => (
            <ContextMenuButton
              icon={
                <Avatar
                  size={18}
                  src={
                    client().users.get(entry.command.application_id)?.avatarURL
                  }
                  fallback={entry.app?.display_name ?? entry.app?.username}
                />
              }
              onClick={() => {
                runCommand(
                  client(),
                  props.channelId!,
                  entry.command,
                  [],
                  props.targetId,
                ).catch(() => {});
                props.onClose?.();
              }}
            >
              {entry.name}
            </ContextMenuButton>
          )}
        </For>
      </ContextMenuSubMenu>
    </Show>
  );
}
