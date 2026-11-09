import { Trans, useLingui } from "@lingui/solid/macro";
import { createFormControl, createFormGroup } from "solid-forms";

import { useState } from "@revolt/state";
import {
  ScreenShareContent,
  ScreenShareQualityName,
} from "@revolt/state/stores/Voice";
import { Column, Dialog, DialogProps, Form2 } from "@revolt/ui";
import { VideoTrack } from "solid-livekit-components";

import { Show } from "solid-js";
import { Modals } from "../types";

/** A quality name present in the dialog's list (the first when the saved one is not) */
export function offeredQuality(
  qualities: { name: string }[],
  stored: ScreenShareQualityName | undefined,
): ScreenShareQualityName {
  const names = qualities.map((quality) => quality.name);
  if (stored && names.includes(stored)) return stored;
  return names[0] as ScreenShareQualityName;
}

/**
 * What is shared: text and slides stay sharp, video and games stay smooth
 * (the content hint and what the encoder gives up first)
 */
export function ContentChoice(props: {
  control: ReturnType<typeof createFormControl<ScreenShareContent>>;
}) {
  const { t } = useLingui();
  return (
    <Column gap="sm">
      <Form2.ButtonGroup
        control={props.control}
        buttonDefinitions={[
          { children: t`Text and slides`, value: "detail" },
          { children: t`Video and games`, value: "motion" },
        ]}
      />
      <small>
        <Trans>Text and slides stay sharp; video and games stay smooth.</Trans>
      </small>
    </Column>
  );
}

export function ScreenShareSettingsModal(
  props: DialogProps & Modals & { type: "screen_share_settings" },
) {
  const { voice } = useState();
  const { t } = useLingui();

  const group = createFormGroup({
    // the saved choice, unless the plan no longer offers it
    qualityName: createFormControl<ScreenShareQualityName>(
      offeredQuality(props.qualities, voice.screenShareQuality),
      { required: true },
    ),
    content: createFormControl<ScreenShareContent>(voice.screenShareContent),
    audio: createFormControl(props.audio && voice.screenShareAudio, {
      disabled: !props.audio,
    }),
    dontAsk: createFormControl(false),
  });

  async function onSubmit() {
    if (group.controls.dontAsk.value) {
      voice.screenShareQuality = group.controls.qualityName.value;
      voice.screenShareContent = group.controls.content.value;
      voice.screenShareQualityAsk = false;
      voice.screenShareAudio = group.controls.audio.value;
    }

    props.callback(
      group.controls.qualityName.value,
      group.controls.audio.value && props.audio,
      group.controls.content.value,
    );
    props.onClose();
  }

  const submit = Form2.useSubmitHandler(group, onSubmit);

  return (
    <Dialog
      tone="settings"
      minWidth={420}
      show={props.show}
      onClose={() => {
        props.onCancel();
        props.onClose();
      }}
      title={t`Screen share settings`}
      actions={[
        { text: <Trans>Cancel</Trans> },
        {
          text: <Trans>Start sharing</Trans>,
          onClick: () => {
            onSubmit();
            return false;
          },
        },
      ]}
    >
      <VideoTrack
        trackRef={props.trackReference}
        style={{
          padding: "var(--gap-md)",
          "border-radius": "var(--borderRadius-lg)",
          "max-height": "400px",
          "justify-self": "center",
        }}
      />
      <form onSubmit={submit}>
        <Column>
          <Form2.ButtonGroup
            control={group.controls.qualityName}
            buttonDefinitions={props.qualities.map((quality) => {
              return {
                children: quality.fullName,
                value: quality.name,
              };
            })}
          />
          <ContentChoice control={group.controls.content} />
          <Show when={props.audio}>
            <Form2.Checkbox control={group.controls.audio}>
              <Trans>Share audio</Trans>
            </Form2.Checkbox>
          </Show>
          <Form2.Checkbox control={group.controls.dontAsk}>
            <Trans>Don't ask me again</Trans>
          </Form2.Checkbox>
          <Show when={!props.audio}>
            <small>
              <Trans>This browser cannot share sound from here.</Trans>
            </small>
          </Show>
        </Column>
      </form>
    </Dialog>
  );
}
