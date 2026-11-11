import {
  RoomContext,
  TrackLoop,
  useEnsureParticipant,
  useIsMuted,
  useIsSpeaking,
  useTracks,
} from "solid-livekit-components";

import type { Channel } from "@zrzur/sdk/solid";
import { Track } from "livekit-client";

import { useVoice } from "@revolt/rtc";

import { Base, CommonUser } from "./VoiceChannelPreview";

// Loaded with LiveKit, which comes with the first call

/**
 * Use LiveKit as the source of truth (while in this channel's call)
 */
export default function VariantLive(props: { channel: Channel }) {
  const voice = useVoice();
  return (
    <RoomContext.Provider value={voice.room}>
      <LiveParticipants channel={props.channel} />
    </RoomContext.Provider>
  );
}

function LiveParticipants(props: { channel: Channel }) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );

  return (
    <Base>
      <TrackLoop tracks={tracks}>
        {() => <ParticipantLive channel={props.channel} />}
      </TrackLoop>
    </Base>
  );
}

/**
 * Live variant of participant
 */
function ParticipantLive(props: { channel: Channel }) {
  const participant = useEnsureParticipant();

  const isMuted = useIsMuted({
    participant,
    source: Track.Source.Microphone,
  });

  const isSpeaking = useIsSpeaking(participant);

  return (
    <CommonUser
      channel={props.channel}
      userId={participant.identity}
      speaking={isSpeaking()}
      muted={isMuted()}
      deafened={
        props.channel.voiceParticipants
          .get(participant.identity)
          ?.isReceiving() === false
      }
      camera={participant.isCameraEnabled}
      screenshare={participant.isScreenShareEnabled}
      isLive
    />
  );
}
