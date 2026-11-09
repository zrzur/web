import { Show } from "solid-js";

import { useInstance } from "@revolt/instance";
import { useState } from "@revolt/state";
import { Column } from "@revolt/ui";

import { InputSensitivityOptions } from "./InputSensitivityOptions";
import { PushToTalkOptions } from "./PushToTalkOptions";
import { ScreenShareOptions } from "./ScreenShareOptions";
import { VoiceInputOptions } from "./VoiceInputOptions";
import { VoiceProcessingOptions } from "./VoiceProcessingOptions";

/**
 * Configure voice options
 */
export function VoiceSettings() {
  const { limits } = useInstance();
  const state = useState();

  return (
    <Column gap="xl">
      <VoiceInputOptions />
      <PushToTalkOptions />
      <Show when={state.voice.inputMode === "voice"}>
        <InputSensitivityOptions />
      </Show>
      <VoiceProcessingOptions />
      <Show when={limits().video}>
        <ScreenShareOptions />
      </Show>
    </Column>
  );
}
