import { Trans } from "@lingui/solid/macro";

import { deviceMac } from "@revolt/keybinds/active";
import { comboKeys } from "@revolt/keybinds/keymap";
import { comboLabel } from "@revolt/keybinds/shortcuts";
import { useState } from "@revolt/state";
import { setStreamerMode } from "@revolt/state/streamer";
import { SettingsRow, SettingsSection, Toggle } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Streamer mode switch (My account), plus "on while sharing the screen"
 */
export function StreamerModeSection() {
  const state = useState();
  const on = () => state.settings.streamerMode;
  const combo = () => {
    const mac = deviceMac();
    return comboLabel(
      comboKeys(state.keybinds.combo("toggle_streamer")),
      mac,
    ).join(mac ? "" : "+");
  };

  return (
    <SettingsSection
      title={<Trans>Streamer mode</Trans>}
      description={
        <Trans>
          Hides your email, your tag, invite links and codes, and message
          previews from DMs in notifications, so they never show on stream.
        </Trans>
      }
    >
      <SettingsRow
        icon={<Icon name="eye-slash" size={20} />}
        title={<Trans>Streamer mode</Trans>}
        description={
          <Trans>
            Shortcut: <bdi dir="ltr">{combo()}</bdi>. A small sign at the top
            shows while it is on.
          </Trans>
        }
        onClick={() => setStreamerMode(state, !on())}
        control={(ids) => (
          <Toggle
            checked={on()}
            onChange={(next) => setStreamerMode(state, next)}
            aria-labelledby={ids.labelId}
            aria-describedby={ids.descriptionId}
          />
        )}
      />
      <SettingsRow
        icon={<Icon name="monitor-arrow-up" size={20} />}
        title={<Trans>Turn on while sharing your screen</Trans>}
        description={
          <Trans>
            Goes off again when the share ends, unless you turned it on
            yourself.
          </Trans>
        }
        onClick={() =>
          (state.settings.streamerOnShare = !state.settings.streamerOnShare)
        }
        control={(ids) => (
          <Toggle
            checked={state.settings.streamerOnShare}
            onChange={(next) => (state.settings.streamerOnShare = next)}
            aria-labelledby={ids.labelId}
            aria-describedby={ids.descriptionId}
          />
        )}
      />
    </SettingsSection>
  );
}
