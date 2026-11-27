import { userHandle } from "@revolt/common/lib/userTag";
import { Show, createSignal, onMount } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { IFormControl } from "solid-forms";

import { Bot } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { createProfileResource } from "@revolt/client/resources";
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

import { UserProfileEditor } from "../profile/UserProfileEditor";
import { BotVerification } from "./BotVerification";
import { PrivilegedIntents } from "./PrivilegedIntents";

/**
 * A bot in the Developer Portal is split in tabs, each thing in one place
 * (owner, 2026-11-27: the overview repeated the commands, the ID and the
 * invite link). This file holds the tabs that belong to the bot account:
 * General, Bot (credentials and intents) and Verification.
 *
 * The token is never rendered; it can only be copied or reset.
 */

/** Read and save the privileged intents (the SDK's bot doesn't carry them) */
function useIntentsApi(bot: Bot) {
  const client = useClient();
  return {
    load: async () => {
      const response = await client().api.get(`/bots/${bot.id}`);
      return response.bot.privileged_intents ?? 0;
    },
    save: async (next: number) => {
      const response = await client().api.patch(`/bots/${bot.id}`, {
        privileged_intents: next,
      });
      // the bot comes flattened next to its user
      return response.privileged_intents ?? next;
    },
  };
}

/** Copy a value and say so at the bottom of the screen */
function useCopy() {
  const snackbar = useSnackbar();
  return (value: string, message: string) => {
    void navigator.clipboard.writeText(value);
    snackbar.show({ message, placement: "bottom", closeable: true });
  };
}

/** General: the bot's profile, its name and who may add it */
export function BotGeneral(props: { bot: Bot; onDelete?: () => void }) {
  // `bot` will never change, so we don't care about reactivity here
  // eslint-disable-next-line solid/reactivity
  const profile = createProfileResource(props.bot.user!);
  const { openModal } = useModals();

  return (
    <Column gap="xl">
      {/* the live preview beside the form, as on your own profile: the
          banner plays there when it is a GIF or animated WebP */}
      <UserProfileEditor
        user={props.bot.user!}
        profile={profile.data}
        preview
        attach={[
          { name: "public", value: props.bot.public },
          { name: "showCreator", value: props.bot.showCreator },
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
            <SettingsSection title={<Trans>Account</Trans>}>
              <SettingsRow
                icon={<Icon name="at" size={20} />}
                title={<Trans>Username</Trans>}
                description={<>{userHandle(props.bot.user)}</>}
                onClick={() =>
                  openModal({ type: "edit_bot_username", bot: props.bot })
                }
                navigational
              />
              <SettingsRow
                icon={<Icon name="globe" size={20} />}
                title={<Trans>Public bot</Trans>}
                description={
                  <Trans>
                    Anyone can add it to their servers. When off, only you can.
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
                onClick={toggleCreator}
                control={(ids) => (
                  <Toggle
                    checked={!!creator.value}
                    onChange={toggleCreator}
                    aria-labelledby={ids.labelId}
                  />
                )}
              />
            </SettingsSection>
          );
        }}
      </UserProfileEditor>

      <SettingsSection title={<Trans>Danger zone</Trans>}>
        <SettingsRow
          icon={<Icon name="trash" size={20} />}
          danger
          title={<Trans>Delete bot</Trans>}
          description={<Trans>This can't be undone.</Trans>}
          control={() => (
            <Button
              size="sm"
              variant="_error"
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
    </Column>
  );
}

/** Bot: how the code signs in and what it may receive */
export function BotAccess(props: { bot: Bot }) {
  const { openModal } = useModals();
  const copy = useCopy();
  const { t } = useLingui();
  // eslint-disable-next-line solid/reactivity
  const intents = useIntentsApi(props.bot);

  return (
    <Column gap="xl">
      <SettingsSection
        title={<Trans>Connection</Trans>}
        description={
          <Trans>
            The token signs in as your bot. Never share it or show it on screen.
          </Trans>
        }
      >
        {/* only a hash is stored: the token exists here only right after creation */}
        <Show
          when={props.bot.token}
          fallback={
            <SettingsRow
              icon={<Icon name="key" size={20} />}
              title={<Trans>Reset token</Trans>}
              description={
                <Trans>
                  Zrzur can't show it again. A new token stops the old one.
                </Trans>
              }
              control={() => (
                <Button
                  size="sm"
                  variant="tonal"
                  onPress={() =>
                    openModal({ type: "reset_bot_token", bot: props.bot })
                  }
                >
                  <Trans>Reset</Trans>
                </Button>
              )}
            />
          }
        >
          <SettingsRow
            icon={<Icon name="key" size={20} />}
            title={<Trans>Bot token</Trans>}
            description={<Trans>Copy it now. It won't be shown again.</Trans>}
            control={() => (
              <Button
                size="sm"
                variant="filled"
                onPress={() =>
                  copy(props.bot.token, t`Token copied to clipboard`)
                }
              >
                <Trans>Copy token</Trans>
              </Button>
            )}
          />
        </Show>
        <SettingsRow
          icon={<Icon name="link" size={20} />}
          title={<Trans>HTTP interactions</Trans>}
          description={
            <Trans>
              Receive commands at your own address instead of the gateway.
            </Trans>
          }
          onClick={() =>
            openModal({ type: "interactions_endpoint", bot: props.bot })
          }
          navigational
        />
      </SettingsSection>

      <PrivilegedIntents load={intents.load} save={intents.save} />
    </Column>
  );
}

/**
 * Verification: the request asks for the privileged intents saved in the
 * Bot tab, read here so the form sends what is on
 */
export function BotVerificationTab(props: { bot: Bot }) {
  // eslint-disable-next-line solid/reactivity
  const intents = useIntentsApi(props.bot);
  // undefined until read: a request never goes out with a guessed mask
  const [saved, setSaved] = createSignal<number>();
  onMount(() => void intents.load().then(setSaved, () => setSaved(0)));
  return <BotVerification bot={props.bot} intents={saved()} />;
}
