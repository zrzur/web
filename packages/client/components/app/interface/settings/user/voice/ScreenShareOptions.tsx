import { For } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useVoice } from "@revolt/rtc";
import { useState } from "@revolt/state";
import { ScreenShareQualityName } from "@revolt/state/stores/Voice";
import {
  FloatingSelect,
  MenuItem,
  SettingsRow,
  SettingsSection,
  Toggle,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

export function ScreenShareOptions() {
  const { voice } = useState();
  const voiceContext = useVoice();

  const qualities = voiceContext.getEnabledScreenShareQualities();

  return (
    <SettingsSection title={<Trans>Screen share</Trans>}>
      <SettingsRow
        icon={<Icon name="monitor-arrow-up" size={20} />}
        title={<Trans>Stream quality</Trans>}
        description={<Trans>Higher quality uses more upload bandwidth.</Trans>}
        control={(ids) => (
          <SelectWidth>
            <FloatingSelect
              aria-labelledby={ids.labelId}
              value={voice.screenShareQuality}
              onChange={(e) => {
                const value = e.currentTarget.value as ScreenShareQualityName;
                if (value) voice.screenShareQuality = value;
              }}
            >
              <For each={Object.keys(qualities) as ScreenShareQualityName[]}>
                {(name) => (
                  <MenuItem value={name}>{qualities[name]!.fullName}</MenuItem>
                )}
              </For>
            </FloatingSelect>
          </SelectWidth>
        )}
      />
      <SettingsRow
        icon={<Icon name="question" size={20} />}
        title={<Trans>Ask every time</Trans>}
        description={
          <Trans>Choose the quality each time you start a stream.</Trans>
        }
        onClick={() =>
          (voice.screenShareQualityAsk = !voice.screenShareQualityAsk)
        }
        control={(ids) => (
          <Toggle
            checked={voice.screenShareQualityAsk}
            onChange={() =>
              (voice.screenShareQualityAsk = !voice.screenShareQualityAsk)
            }
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
