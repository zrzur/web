import { For, Show, createResource } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { SettingsRow, SettingsSection } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { type BotCommand, localizedNames } from "./commands";

/**
 * The global commands the bot registered, read-only: a bot registers its
 * commands itself through the API; this list shows what servers will see.
 */
export function BotCommands(props: { botId: string }) {
  const client = useClient();
  const { t } = useLingui();

  const [commands] = createResource(async () => {
    const response = await client()
      .api.get(
        `/applications/${props.botId as ""}/commands` as "/applications/{application_id}/commands",
      )
      .catch(() => undefined);
    return (response ?? []) as BotCommand[];
  });

  const kind = (command: BotCommand) =>
    command.type === "User"
      ? t`User menu`
      : command.type === "Message"
        ? t`Message menu`
        : t`Slash command`;

  return (
    <SettingsSection
      title={<Trans>Commands</Trans>}
      description={
        <Trans>
          Commands your bot registered for every server. Register them from your
          bot's code; changes show here at once.
        </Trans>
      }
    >
      <Show
        when={(commands() ?? []).length > 0}
        fallback={
          <SettingsRow
            icon={<Icon name="terminal" size={20} />}
            title={<Trans>No commands yet</Trans>}
            description={
              <Trans>Register a command from your bot to see it here.</Trans>
            }
          />
        }
      >
        <For each={commands()}>
          {(command) => (
            <SettingsRow
              icon={<Icon name="terminal" size={20} />}
              title={
                <span dir="auto">
                  {command.type === "User" || command.type === "Message"
                    ? command.name
                    : `/${command.name}`}
                </span>
              }
              description={
                <>
                  {kind(command)}
                  <Show when={command.description}>
                    {" · "}
                    <span dir="auto">{command.description}</span>
                  </Show>
                  <Show when={localizedNames(command)}>
                    <br />
                    <span dir="auto">{localizedNames(command)}</span>
                  </Show>
                </>
              }
            />
          )}
        </For>
      </Show>
    </SettingsSection>
  );
}
