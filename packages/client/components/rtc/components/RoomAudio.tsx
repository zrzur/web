import { RoomContext } from "solid-livekit-components";

import { useVoice } from "../state";

import { RoomAudioManager } from "./RoomAudioManager";

/**
 * Plays the call's audio (loaded with LiveKit, only while in a call)
 */
export default function RoomAudio() {
  const voice = useVoice();
  return (
    <RoomContext.Provider value={voice.room}>
      <RoomAudioManager />
    </RoomContext.Provider>
  );
}
