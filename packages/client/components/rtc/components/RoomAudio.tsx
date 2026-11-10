import { createEffect, onCleanup } from "solid-js";
import { RoomContext } from "solid-livekit-components";

import { useClient } from "@revolt/client";
import { useInstance } from "@revolt/instance";

import { useVoice } from "../state";
import { attachVoiceExtras } from "../voiceExtras";

import { RoomAudioManager } from "./RoomAudioManager";

/**
 * Plays the call's audio, and attaches the stage, soundboard and screen
 * share stills to the call (loaded with LiveKit, only while in a call)
 */
export default function RoomAudio() {
  const voice = useVoice();
  const client = useClient();
  const { mediaUrl } = useInstance();
  createEffect(() => {
    const channel = voice.channel();
    if (!channel) return;
    onCleanup(attachVoiceExtras(client(), channel, voice, mediaUrl));
  });
  return (
    <RoomContext.Provider value={voice.room}>
      <RoomAudioManager />
    </RoomContext.Provider>
  );
}
