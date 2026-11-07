import { RoomContext } from "solid-livekit-components";

import { useVoice } from "@revolt/rtc";

import { VoiceCallCardActiveRoom } from "./VoiceCallCardActiveRoom";
import { VoiceCallCardPiP } from "./VoiceCallCardPiP";

// The call views use LiveKit, which loads with the first call: each one
// carries the room context itself (there is none at the root any more)

/**
 * The call card's room view
 */
export function ActiveRoom() {
  const voice = useVoice();
  return (
    <RoomContext.Provider value={voice.room}>
      <VoiceCallCardActiveRoom />
    </RoomContext.Provider>
  );
}

/**
 * The picture-in-picture view of the call
 */
export function PictureInPicture() {
  const voice = useVoice();
  return (
    <RoomContext.Provider value={voice.room}>
      <VoiceCallCardPiP />
    </RoomContext.Provider>
  );
}
