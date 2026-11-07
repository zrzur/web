import { Show, createResource } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type {
  DirectMessagePrivacy,
  GroupInvitePrivacy,
  UserPrivacy,
} from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import {
  Button,
  FloatingSelect,
  MenuItem,
  SettingsRow,
  SettingsSection,
  Toggle,
} from "@revolt/ui";
import {
  PLAYER_PROVIDERS,
  allowedMediaPlayers,
  alwaysLoadMediaPlayers,
  forgetMediaPlayers,
  setAlwaysLoadMediaPlayers,
} from "@revolt/ui/components/features/messaging/elements/embedSettings";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Defaults the server uses, shown while loading or when it can't answer
 */
const DEFAULTS: UserPrivacy = {
  direct_messages: "Mutual",
  group_invites: "Friends",
};

/**
 * Privacy section of My account: who can message you and who can add you
 * to group chats. The server enforces both; this only reads and changes them.
 */
export function PrivacySection() {
  const client = useClient();
  const { showError } = useModals();
  const { t } = useLingui();

  const [privacy, { mutate }] = createResource(() =>
    client().users.fetchPrivacy(),
  );

  // a server without these settings, or one that can't be reached
  const unavailable = () => !!privacy.error;
  const disabled = () => unavailable() || !privacy();
  const current = () => (privacy.error ? DEFAULTS : privacy()) ?? DEFAULTS;

  /**
   * Save one change at once, and go back if the server refuses it
   */
  async function change(update: Partial<UserPrivacy>) {
    const before = privacy();
    if (!before) return;

    mutate({ ...before, ...update });
    try {
      mutate(await client().users.editPrivacy(update));
    } catch (error) {
      mutate(before);
      showError(error);
    }
  }

  return (
    <SettingsSection
      title={<Trans>Privacy</Trans>}
      description={
        unavailable() ? (
          <Trans>These settings aren't available yet.</Trans>
        ) : undefined
      }
    >
      <SettingsRow
        icon={<Icon name="chat-circle" size={20} />}
        title={<Trans>Who can message you</Trans>}
        description={
          <Trans>
            Friends can always message you, and blocked people never can. Anyone
            you write to first can reply.
          </Trans>
        }
        disabled={unavailable()}
        control={(ids) => (
          <SelectWidth>
            <FloatingSelect
              aria-labelledby={ids.labelId}
              aria-describedby={ids.descriptionId}
              disabled={disabled()}
              value={current().direct_messages}
              onChange={(e) =>
                change({
                  direct_messages: e.currentTarget
                    .value as DirectMessagePrivacy,
                })
              }
            >
              <MenuItem value="Everyone">
                <Trans>Everyone</Trans>
              </MenuItem>
              <MenuItem value="Mutual">
                <Trans>Friends and server members</Trans>
              </MenuItem>
              <MenuItem value="Friends">
                <Trans>Friends only</Trans>
              </MenuItem>
            </FloatingSelect>
          </SelectWidth>
        )}
      />
      <SettingsRow
        icon={<Icon name="users-three" size={20} />}
        title={<Trans>Who can add you to group chats</Trans>}
        description={
          <Trans>
            With Nobody, no one can put you in a group chat, not even friends.
            You can still make your own.
          </Trans>
        }
        disabled={unavailable()}
        control={(ids) => (
          <SelectWidth>
            <FloatingSelect
              aria-labelledby={ids.labelId}
              aria-describedby={ids.descriptionId}
              disabled={disabled()}
              value={current().group_invites}
              onChange={(e) =>
                change({
                  group_invites: e.currentTarget.value as GroupInvitePrivacy,
                })
              }
            >
              <MenuItem value="Everyone">
                <Trans>Everyone</Trans>
              </MenuItem>
              <MenuItem value="Friends">
                <Trans>Friends</Trans>
              </MenuItem>
              <MenuItem value="Nobody">
                <Trans>Nobody</Trans>
              </MenuItem>
            </FloatingSelect>
          </SelectWidth>
        )}
      />
      <SettingsRow
        icon={<Icon name="play" size={20} />}
        title={t`Always load media players from other sites`}
        description={t`Off: each site like YouTube or Spotify asks you once. On: every player loads at once and the site learns your IP address.`}
        onClick={() => setAlwaysLoadMediaPlayers(!alwaysLoadMediaPlayers())}
        control={(ids) => (
          <Toggle
            checked={alwaysLoadMediaPlayers()}
            onChange={() => setAlwaysLoadMediaPlayers(!alwaysLoadMediaPlayers())}
            aria-labelledby={ids.labelId}
            aria-describedby={ids.descriptionId}
          />
        )}
      />
      <Show when={allowedMediaPlayers().length}>
        <SettingsRow
          icon={<Icon name="shield" size={20} />}
          title={t`Sites you allowed`}
          description={allowedMediaPlayers()
            .map((type) => PLAYER_PROVIDERS[type]?.name ?? type)
            .join(" · ")}
          control={() => (
            <Button variant="secondary" onPress={forgetMediaPlayers}>
              {t`Forget`}
            </Button>
          )}
        />
      </Show>
    </SettingsSection>
  );
}

/**
 * Wide enough for the longest choice; on a phone the control moves under
 * the text, so it may use the row's width instead of a share of the screen
 */
const SelectWidth = styled("div", {
  base: {
    width: "min(280px, calc(100vw - 96px))",
  },
});
