import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { IFormControl } from "solid-forms";

import { Bot } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { createProfileResource } from "@revolt/client/resources";
import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import {
  Button,
  Column,
  SettingsRow,
  SettingsSection,
  Toggle,
  useSnackbar,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { Discoverable } from "../../shared/Discoverable";
import { UserSummary } from "../account/index";
import { UserProfileEditor } from "../profile/UserProfileEditor";
import { BotCommands } from "./BotCommands";
import { BotVerification } from "./BotVerification";
import { PrivilegedIntents } from "./PrivilegedIntents";

/**
 * Manage a bot: identity, profile, visibility, invite & credentials, danger
 * zone. Shown as the Overview tab of the bot in the Developer Portal.
 *
 * The token is never rendered; it can only be copied or reset.
 */
export function ViewBot(props: { bot: Bot; onDelete?: () => void }) {
  // `bot` will never change, so we don't care about reactivity here
  // eslint-disable-next-line solid/reactivity
  const profile = createProfileResource(props.bot.user!);
  const instance = useInstance();
  const { openModal } = useModals();
  const snackbar = useSnackbar();
  const { t } = useLingui();

  const copy = (value: string, message: string) => {
    navigator.clipboard.writeText(value);
    snackbar.show({ message, placement: "bottom", closeable: true });
  };

  // Privileged gateway intents (the bot object from the SDK doesn't carry
  // them yet, so they are read and saved here, with the server's answer)
  const client = useClient();
  const [intents, setIntents] = createSignal(0);
  const loadIntents = async () => {
    const response = await client().api.get(`/bots/${props.bot.id}`);
    return response.bot.privileged_intents ?? 0;
  };
  const saveIntents = async (next: number) => {
    const response = await client().api.patch(`/bots/${props.bot.id}`, {
      privileged_intents: next,
    });
    // the bot comes flattened next to its user
    return response.privileged_intents ?? next;
  };

  const copyButton = (label: string, onPress: () => void) => (
    <Button size="sm" variant="tonal" shape="square" onPress={onPress}>
      <Icon name="copy" size={16} />
      {label}
    </Button>
  );

  return (
    <Column gap="xl">
      <UserSummary
        user={props.bot.user!}
        showBadges
        bannerUrl={profile.data?.animatedBannerURL}
      />

      <UserProfileEditor
        user={props.bot.user!}
        profile={profile.data}
        attach={[
          {
            name: "public",
            value: props.bot.public,
          },
          {
            name: "showCreator",
            value: props.bot.showCreator,
          },
        ]}
        onSubmit={(g) => {
          props.bot.edit({
            public: (g.controls["public"] as IFormControl<boolean>).value,
            show_creator: (g.controls["showCreator"] as IFormControl<boolean>)
              .value,
          });
        }}
        onReset={(g) => {
          (g.controls["public"] as IFormControl<boolean>).setValue(
            props.bot.public || false,
          );
          (g.controls["showCreator"] as IFormControl<boolean>).setValue(
            props.bot.showCreator,
          );
        }}
      >
        {(g) => {
          const control = g.controls["public"] as IFormControl<boolean>;
          const toggle = () => {
            control.setValue(!control.value);
            control.markDirty(true);
          };
          const creator = g.controls["showCreator"] as IFormControl<boolean>;
          const toggleCreator = () => {
            creator.setValue(!creator.value);
            creator.markDirty(true);
          };

          return (
            <SettingsSection title={<Trans>Visibility</Trans>}>
              <SettingsRow
                icon={<Icon name="globe" size={20} />}
                title={<Trans>Public bot</Trans>}
                description={
                  <Trans>
                    Allow anyone to invite this bot. When off, only you can add
                    it to servers.
                  </Trans>
                }
                onClick={toggle}
                control={(ids) => (
                  <Toggle
                    checked={!!control.value}
                    onChange={toggle}
                    aria-labelledby={ids.labelId}
                    aria-describedby={ids.descriptionId}
                  />
                )}
              />
              <SettingsRow
                icon={<Icon name="user" size={20} />}
                title={<Trans>Show your name on the bot's page</Trans>}
                description={
                  <Trans>
                    When on, people who open this bot's invite page see that
                    you made it. Off by default.
                  </Trans>
                }
                onClick={toggleCreator}
                control={(ids) => (
                  <Toggle
                    checked={!!creator.value}
                    onChange={toggleCreator}
                    aria-labelledby={ids.labelId}
                    aria-describedby={ids.descriptionId}
                  />
                )}
              />
            </SettingsSection>
          );
        }}
      </UserProfileEditor>

      <PrivilegedIntents
        load={loadIntents}
        save={saveIntents}
        onChange={setIntents}
      />

      <BotCommands botId={props.bot.id} />

      <BotVerification bot={props.bot} intents={intents()} />

      <SettingsSection title={<Trans>Identity</Trans>}>
        <SettingsRow
          icon={<Icon name="at" size={20} />}
          title={<Trans>Username</Trans>}
          description={
            <>
              {props.bot.user!.username}#{props.bot.user!.discriminator}
            </>
          }
          onClick={() =>
            openModal({ type: "edit_bot_username", bot: props.bot })
          }
          navigational
        />
        <SettingsRow
          icon={<Icon name="identification-card" size={20} />}
          title={<Trans>Bot ID</Trans>}
          description={<code>{props.bot.id}</code>}
          control={() =>
            copyButton(t`Copy`, () =>
              copy(props.bot.id, t`ID copied to clipboard`),
            )
          }
        />
      </SettingsSection>

      <SettingsSection title={<Trans>Invite</Trans>}>
        <SettingsRow
          icon={<Icon name="user-plus" size={20} />}
          title={<Trans>Add to a server</Trans>}
          description={<Trans>Choose one of your servers to add it to.</Trans>}
          onClick={() =>
            openModal({
              type: "add_bot",
              invite: props.bot.publicBot,
            })
          }
          navigational
        />
        <SettingsRow
          icon={<Icon name="link" size={20} />}
          title={<Trans>Invite link</Trans>}
          description={instance.href(`/bot/${props.bot.id}`)}
          control={() =>
            copyButton(t`Copy`, () =>
              copy(
                instance.href(`/bot/${props.bot.id}`),
                t`Invite URL copied to clipboard`,
              ),
            )
          }
        />
      </SettingsSection>

      <SettingsSection
        title={<Trans>Token</Trans>}
        description={
          <Trans>
            The token logs in as your bot. Keep it secret, never paste it in
            chats or screenshots.
          </Trans>
        }
      >
        {/* only a hash is stored: the token exists here only right after creation */}
        <Show
          when={props.bot.token}
          fallback={
            <SettingsRow
              icon={<Icon name="key" size={20} />}
              title={<Trans>Bot token</Trans>}
              description={
                <Trans>
                  Zrzur keeps only a fingerprint of it, so it can't be shown
                  again. Reset it to get a new one.
                </Trans>
              }
            />
          }
        >
          <SettingsRow
            icon={<Icon name="key" size={20} />}
            title={<Trans>Bot token</Trans>}
            description={<Trans>Copy it now. It won't be shown again.</Trans>}
            control={() =>
              copyButton(t`Copy token`, () =>
                copy(props.bot.token, t`Token copied to clipboard`),
              )
            }
          />
        </Show>
        <SettingsRow
          icon={<Icon name="arrows-clockwise" size={20} />}
          title={<Trans>Reset token</Trans>}
          description={
            <Trans>
              Generate a new token if it was lost or leaked. The old one stops
              working.
            </Trans>
          }
          control={() => (
            <Button
              size="sm"
              variant="tonal"
              shape="square"
              onPress={() =>
                openModal({ type: "reset_bot_token", bot: props.bot })
              }
            >
              <Trans>Reset</Trans>
            </Button>
          )}
        />
        <SettingsRow
          icon={<Icon name="link" size={20} />}
          title={<Trans>HTTP interactions</Trans>}
          description={
            <Trans>
              Receive commands at your own address instead of the gateway.
            </Trans>
          }
          control={() => (
            <Button
              size="sm"
              variant="tonal"
              shape="square"
              onPress={() =>
                openModal({ type: "interactions_endpoint", bot: props.bot })
              }
            >
              <Trans>Set up</Trans>
            </Button>
          )}
        />
      </SettingsSection>

      <SettingsSection title={<Trans>Danger zone</Trans>}>
        <SettingsRow
          icon={<Icon name="trash" size={20} />}
          danger
          title={<Trans>Delete bot</Trans>}
          description={
            <Trans>Permanently deletes this bot. This can't be undone.</Trans>
          }
          control={() => (
            <Button
              size="sm"
              variant="_error"
              shape="square"
              onPress={() =>
                openModal({
                  type: "delete_bot",
                  bot: props.bot,
                  onDelete: props.onDelete,
                })
              }
            >
              <Trans>Delete</Trans>
            </Button>
          )}
        />
      </SettingsSection>

      <Discoverable discoverable={props.bot} />
    </Column>
  );
}
