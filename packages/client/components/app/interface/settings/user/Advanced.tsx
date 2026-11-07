import { For, Show } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { pluginsEnabled } from "@revolt/plugins/enabled";
import { useState } from "@revolt/state";
import {
  AVAILABLE_EXPERIMENTS,
  EXPERIMENTS,
} from "@revolt/state/stores/Experiments";
import { Column, SettingsRow, SettingsSection, Toggle } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import type { IconName } from "@revolt/ui/icons/registry";

import { useSettingsNavigation } from "../Settings";

/**
 * Advanced settings
 */
export default function AdvancedSettings() {
  const state = useState();
  const { t } = useLingui();
  const { navigate } = useSettingsNavigation();
  const client = useClient();
  const showPlugins = () => pluginsEnabled(client());

  /** a switch row bound to one setting */
  const settingRow = (
    key:
      | "appearance:compact_mode"
      | "appearance:profile_effects"
      | "advanced:copy_id",
    icon: IconName,
    title: string,
    description: string,
  ) => {
    const toggle = () =>
      state.settings.setValue(key, !state.settings.getValue(key));
    return (
      <SettingsRow
        icon={<Icon name={icon} size={20} />}
        title={title}
        description={description}
        onClick={toggle}
        control={(ids) => (
          <Toggle
            checked={!!state.settings.getValue(key)}
            onChange={toggle}
            aria-labelledby={ids.labelId}
            aria-describedby={ids.descriptionId}
          />
        )}
      />
    );
  };

  /** experiment names in the user's language */
  const experimentText = (key: keyof typeof EXPERIMENTS) =>
    ({
      gif_picker: { title: t`GIF picker`, description: t`Not available yet.` },
      plugins: { title: t`Plugins`, description: t`Not available yet.` },
    })[key] ?? EXPERIMENTS[key];

  return (
    <Column gap="xl">
      <SettingsSection title={<Trans>Display</Trans>}>
        {settingRow(
          "appearance:compact_mode",
          "list-bullets",
          t`Compact mode`,
          t`Fit more messages on screen with tighter spacing.`,
        )}
        {settingRow(
          "appearance:profile_effects",
          "sparkle",
          t`Show profile effects`,
          t`Play the short effects people add to their profiles. They never play with reduced motion on.`,
        )}
      </SettingsSection>
      <SettingsSection title={<Trans>Developer tools</Trans>}>
        {settingRow(
          "advanced:copy_id",
          "copy",
          t`Show “Copy ID” in context menus`,
          t`Copy the ID of a user, message, channel or server.`,
        )}
      </SettingsSection>
      <Show when={showPlugins() || AVAILABLE_EXPERIMENTS.length > 0}>
        <SettingsSection title={<Trans>Extensions</Trans>}>
          <Show when={showPlugins()}>
            <SettingsRow
              icon={<Icon name="squares-four" size={20} />}
              title={experimentText("plugins").title}
              description={t`Install, turn on and manage reviewed plugins.`}
              onClick={() => navigate("plugins")}
              navigational
            />
          </Show>
          <For each={AVAILABLE_EXPERIMENTS}>
            {(key) => (
              <SettingsRow
                icon={<Icon name="gif" size={20} />}
                title={experimentText(key).title}
                description={experimentText(key).description}
                onClick={() =>
                  state.experiments.setEnabled(
                    key,
                    !state.experiments.isEnabled(key),
                  )
                }
                control={(ids) => (
                  <Toggle
                    checked={state.experiments.isEnabled(key)}
                    onChange={() =>
                      state.experiments.setEnabled(
                        key,
                        !state.experiments.isEnabled(key),
                      )
                    }
                    aria-labelledby={ids.labelId}
                    aria-describedby={ids.descriptionId}
                  />
                )}
              />
            )}
          </For>
        </SettingsSection>
      </Show>
    </Column>
  );
}
