import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useState } from "@revolt/state";
import { SettingsRow, SettingsSection, Slider, Toggle } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Soundboard: how loud sounds others play are, or not at all
 */
export function SoundboardOptions() {
  const { voice } = useState();
  const { t } = useLingui();
  const toggleMuted = () => (voice.soundboardMuted = !voice.soundboardMuted);

  return (
    <SettingsSection
      title={<Trans>Soundboard</Trans>}
      description={
        <Trans>Short sounds people play in a voice call, on your device.</Trans>
      }
    >
      <SettingsRow
        icon={<Icon name="speaker-slash" size={20} />}
        title={<Trans>Mute the soundboard</Trans>}
        description={t`You hear no soundboard sounds in calls.`}
        onClick={toggleMuted}
        control={(ids) => (
          <Toggle
            data-setting="soundboard-muted"
            checked={voice.soundboardMuted}
            onChange={toggleMuted}
            aria-labelledby={ids.labelId}
            aria-describedby={ids.descriptionId}
          />
        )}
      />
      <SettingsRow
        disabled={voice.soundboardMuted}
        icon={<Icon name="music-note" size={20} />}
        title={<Trans>Soundboard volume</Trans>}
        control={() => (
          <SliderWidth>
            <Slider
              aria-label={t`Soundboard volume`}
              min={0}
              max={1}
              step={0.05}
              value={voice.soundboardVolume}
              onInput={(event) =>
                (voice.soundboardVolume = event.currentTarget.value)
              }
              labelFormatter={(value) => (value * 100).toFixed(0) + "%"}
            />
          </SliderWidth>
        )}
      />
    </SettingsSection>
  );
}

const SliderWidth = styled("div", {
  base: {
    width: "min(300px, 44vw)",
  },
});
