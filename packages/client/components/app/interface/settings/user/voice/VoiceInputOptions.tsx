import { For, Show, createMemo } from "solid-js";
import { useMediaDeviceSelect } from "solid-livekit-components";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useInstance } from "@revolt/instance";
import { stoatSinkName } from "@revolt/rtc";
import { useState } from "@revolt/state";
import {
  FloatingSelect,
  MenuItem,
  SettingsRow,
  SettingsSection,
  Slider,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Devices and volume, on the shared settings panels:
 * [icon] [label / current device] ........ [select | slider]
 */
export function VoiceInputOptions() {
  const { limits } = useInstance();

  return (
    <>
      <SettingsSection
        title={<Trans>Devices</Trans>}
        description={
          <Trans>
            Interface sounds and call audio both use the speaker chosen here.
          </Trans>
        }
      >
        <SelectInput kind="audioinput" />
        <SelectInput kind="audiooutput" />
        <Show when={limits().video}>
          <SelectInput kind="videoinput" />
        </Show>
      </SettingsSection>
      <VolumeSliders />
    </>
  );
}

function SelectInput(props: { kind: MediaDeviceKind }) {
  const state = useState();
  const { t } = useLingui();
  const media = createMemo(() => useMediaDeviceSelect({ kind: props.kind }));

  const setKey = () =>
    props.kind === "videoinput"
      ? "preferredVideoDevice"
      : props.kind === "audioinput"
        ? "preferredAudioInputDevice"
        : "preferredAudioOutputDevice";

  const icon = () =>
    props.kind === "videoinput"
      ? "video-camera"
      : props.kind === "audioinput"
        ? "microphone"
        : "speaker-high";

  const label = () =>
    props.kind === "videoinput"
      ? t`Camera`
      : props.kind === "audioinput"
        ? t`Microphone`
        : t`Speaker`;

  const activeId = createMemo(() => state.voice[setKey()] ?? "default");

  const devices = createMemo(() => {
    const devs = media()
      .devices()
      .filter((dev) => dev.label.split(":").pop() !== stoatSinkName);

    const ordered: { id: string; label: string }[] = [];
    const def = devs.find((d) => d.deviceId === "default");
    ordered.push({ id: "default", label: def?.label || t`Default` });
    for (const d of devs) {
      if (d.deviceId !== "default") {
        ordered.push({ id: d.deviceId, label: d.label || d.deviceId });
      }
    }
    return ordered;
  });

  // browsers hide device names until a permission has been granted
  const unlabelled = () =>
    devices().length > 1 && devices().every((d, i) => !i || d.label === d.id);

  return (
    <SettingsRow
      icon={<Icon name={icon()} size={20} />}
      title={label()}
      description={
        <Show when={unlabelled()}>
          <Trans>Device names appear after you allow access once.</Trans>
        </Show>
      }
      control={(ids) => (
        <SelectWidth>
          <FloatingSelect
            aria-labelledby={ids.labelId}
            value={activeId()}
            onChange={(e) => {
              const id = e.currentTarget.value;
              if (!id) return;
              const mMedia = media();
              if (
                id === "default" ||
                mMedia.devices().find((d) => d.deviceId === id)
              ) {
                if (props.kind !== "videoinput" || id !== "default") {
                  mMedia.setActiveMediaDevice(id);
                }
                state.voice[setKey()] = id === "default" ? undefined : id;
              }
            }}
          >
            <For each={devices()}>
              {(d) => <MenuItem value={d.id}>{d.label}</MenuItem>}
            </For>
          </FloatingSelect>
        </SelectWidth>
      )}
    />
  );
}

function VolumeSliders() {
  const state = useState();
  const { t } = useLingui();

  return (
    <SettingsSection title={<Trans>Volume</Trans>}>
      <SettingsRow
        icon={<Icon name="microphone" size={20} />}
        title={<Trans>Input volume</Trans>}
        control={() => (
          <SliderWidth>
            <Slider
              aria-label={t`Input volume`}
              min={0}
              max={3}
              step={0.1}
              value={state.voice.inputVolume}
              onInput={(event) =>
                (state.voice.inputVolume = event.currentTarget.value)
              }
              labelFormatter={(label) => (label * 100).toFixed(0) + "%"}
            />
          </SliderWidth>
        )}
      />
      <SettingsRow
        icon={<Icon name="speaker-high" size={20} />}
        title={<Trans>Output volume</Trans>}
        control={() => (
          <SliderWidth>
            <Slider
              aria-label={t`Output volume`}
              min={0}
              max={3}
              step={0.1}
              value={state.voice.outputVolume}
              onInput={(event) =>
                (state.voice.outputVolume = event.currentTarget.value)
              }
              labelFormatter={(label) => (label * 100).toFixed(0) + "%"}
            />
          </SliderWidth>
        )}
      />
    </SettingsSection>
  );
}

/**
 * Device names are long; a fixed column keeps every select aligned
 */
const SelectWidth = styled("div", {
  base: {
    width: "min(280px, 42vw)",
  },
});

const SliderWidth = styled("div", {
  base: {
    width: "min(300px, 44vw)",
  },
});
