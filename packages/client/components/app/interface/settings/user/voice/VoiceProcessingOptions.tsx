import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useState } from "@revolt/state";
import {
  FloatingSelect,
  MenuItem,
  SettingsRow,
  SettingsSection,
  Toggle,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Voice processing: one panel, select + switches
 */
export function VoiceProcessingOptions() {
  const { voice } = useState();
  const { t } = useLingui();
  // music turns every voice treatment off; the rows say so instead of
  // pretending to work
  const music = () => voice.highQualityAudio;
  const toggleMusic = () => (voice.highQualityAudio = !voice.highQualityAudio);

  return (
    <SettingsSection title={<Trans>Voice processing</Trans>}>
      <SettingsRow
        icon={<Icon name="music-note" size={20} />}
        title={<Trans>High quality audio</Trans>}
        description={t`For music: 128 kbps stereo, with the processing below turned off.`}
        onClick={toggleMusic}
        control={(ids) => (
          <Toggle
            checked={music()}
            onChange={toggleMusic}
            aria-labelledby={ids.labelId}
            aria-describedby={ids.descriptionId}
          />
        )}
      />
      <SettingsRow
        disabled={music()}
        icon={<Icon name="waveform" size={20} />}
        title={<Trans>Noise suppression</Trans>}
        description={
          <Trans>Enhanced filters keyboard and fan noise on your device.</Trans>
        }
        control={(ids) => (
          <SelectWidth>
            <FloatingSelect
              aria-labelledby={ids.labelId}
              disabled={music()}
              value={voice.noiseSupression}
              onChange={(e) => {
                const v = e.currentTarget.value as
                  | "disabled"
                  | "browser"
                  | "enhanced";
                if (v) voice.noiseSupression = v;
              }}
            >
              <MenuItem value="disabled">
                <Trans>Disabled</Trans>
              </MenuItem>
              <MenuItem value="browser">
                <Trans>Browser</Trans>
              </MenuItem>
              <MenuItem value="enhanced">
                <Trans>Enhanced (RNNoise)</Trans>
              </MenuItem>
            </FloatingSelect>
          </SelectWidth>
        )}
      />
      <SettingsRow
        icon={<Icon name="speaker-low" size={20} />}
        title={<Trans>Echo cancellation</Trans>}
        description={t`Uses the browser's echo cancellation.`}
        disabled={music()}
        onClick={() => (voice.echoCancellation = !voice.echoCancellation)}
        control={(ids) => (
          <Toggle
            disabled={music()}
            checked={!!voice.echoCancellation}
            onChange={() => (voice.echoCancellation = !voice.echoCancellation)}
            aria-labelledby={ids.labelId}
          />
        )}
      />
      <SettingsRow
        icon={<Icon name="sliders-horizontal" size={20} />}
        title={<Trans>Automatic gain control</Trans>}
        description={t`Keeps your microphone at a steady level.`}
        disabled={music()}
        onClick={() => (voice.autoGainControl = !voice.autoGainControl)}
        control={(ids) => (
          <Toggle
            disabled={music()}
            checked={!!voice.autoGainControl}
            onChange={() => (voice.autoGainControl = !voice.autoGainControl)}
            aria-labelledby={ids.labelId}
          />
        )}
      />
    </SettingsSection>
  );
}

const SelectWidth = styled("div", {
  base: {
    width: "min(220px, 36vw)",
  },
});
