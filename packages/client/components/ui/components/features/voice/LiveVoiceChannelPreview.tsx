import { useSpeaking } from "@revolt/rtc/speaking";
import {
  RoomContext,
  TrackLoop,
  useEnsureParticipant,
  useIsMuted,
  useTracks,
} from "solid-livekit-components";

import { createSignal, onCleanup } from "solid-js";

import type { Channel } from "@zrzur/sdk/solid";
import { type Participant, ParticipantEvent, Track } from "livekit-client";

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

  const isSpeaking = useSpeaking(participant);
  const media = usePublishedMedia(participant);

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
      camera={media().camera}
      screenshare={media().screenshare}
      isLive
    />
  );
}

/** Track (un)publish and (un)mute events that change what a participant sends */
const MEDIA_EVENTS = [
  ParticipantEvent.TrackPublished,
  ParticipantEvent.TrackUnpublished,
  ParticipantEvent.LocalTrackPublished,
  ParticipantEvent.LocalTrackUnpublished,
  ParticipantEvent.TrackMuted,
  ParticipantEvent.TrackUnmuted,
] as const;

/**
 * Camera and screen share state of a participant, kept up to date.
 * `isCameraEnabled` and `isScreenShareEnabled` are plain getters: read once,
 * they never change, so a stopped screen share kept its icon in the list.
 */
function usePublishedMedia(participant: Participant) {
  const read = () => ({
    camera: participant.isCameraEnabled,
    screenshare: participant.isScreenShareEnabled,
  });
  const [media, setMedia] = createSignal(read(), {
    equals: (a, b) => a.camera === b.camera && a.screenshare === b.screenshare,
  });
  const update = () => setMedia(read());
  for (const event of MEDIA_EVENTS) participant.on(event, update);
  onCleanup(() => {
    for (const event of MEDIA_EVENTS) participant.off(event, update);
  });
  return media;
}
