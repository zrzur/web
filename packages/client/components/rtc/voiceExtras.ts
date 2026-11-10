/**
 * What a call needs beyond audio and video: the stage state, soundboard
 * sounds others play, and stills of your own screen share. Loaded with the
 * first call (not with the app) and attached for as long as you are in it.
 */
import { createEffect, createRoot, onCleanup } from "solid-js";

import type { Channel, Client } from "@zrzur/sdk/solid";
import type { Room } from "livekit-client";

import { TrackSource } from "./livekitConstants";
import { startPreviewCapture } from "./streamPreview";
import {
  SoundboardPlayer,
  fetchStage,
  followVoiceEvents,
  isStageSpeaker,
  onSoundPlayed,
  onSoundRemoved,
  sendStreamPreview,
  soundGain,
  soundUrl,
  soundboardChoices,
  soundboardOf,
  stageOf,
} from "./voiceExtrasStore";

/** The parts of the call this needs */
export type CallView = {
  room: () => Room | undefined;
  screenshare: () => boolean;
  deafen: () => boolean;
  serverDeafened: boolean;
  /** Who may open their microphone on a stage (unset: nobody) */
  setStageGate: (gate: (() => boolean) | undefined) => void;
};

/** One player for every call: decoded sounds stay cached between calls */
let player: SoundboardPlayer | undefined;
const soundboard = () => (player ??= new SoundboardPlayer());

/**
 * Attach to the call in `channel`
 * @returns detach
 */
export function attachVoiceExtras(
  client: Client,
  channel: Channel,
  view: CallView,
  mediaUrl: string,
) {
  followVoiceEvents(client);
  const deafened = () => view.deafen() || view.serverDeafened;
  return createRoot((dispose) => {
    // a stage: who speaks and who asked to; only speakers open a microphone
    if (channel.isStage) {
      const me = client.user?.id ?? "";
      view.setStageGate(() => isStageSpeaker(channel, me));
      void fetchStage(client, channel).then(
        (state) => stageOf(channel.id).set(state),
        () => undefined,
      );
      onCleanup(() => view.setStageGate(undefined));
    }

    // soundboard: a sound someone played here plays on this device
    const server = channel.server;
    if (server) {
      const sounds = soundboardOf(client, server);
      const stopPlayed = onSoundPlayed((channelId, soundId) => {
        if (channelId !== channel.id) return;
        if (soundboardChoices().muted || deafened()) return;
        const play = () => {
          const sound = sounds.sounds.get(soundId);
          if (!sound) return;
          void soundboard()
            .play(
              sound._id,
              soundUrl(mediaUrl, sound._id),
              soundGain(sound.volume, soundboardChoices().volume),
            )
            .catch(() => undefined);
        };
        if (sounds.sounds.has(soundId)) play();
        else void sounds.load().then(play, () => undefined);
      });
      const stopRemoved = onSoundRemoved((id) => player?.forget(id));
      onCleanup(() => {
        stopPlayed();
        stopRemoved();
      });
    }
    // deafening or muting the soundboard stops what plays, and so does leaving
    createEffect(() => {
      if (deafened() || soundboardChoices().muted) player?.stopAll();
    });
    onCleanup(() => player?.stopAll());

    // while you share your screen, a small still of it every 30 seconds for
    // the people who hover it before joining
    createEffect(() => {
      const room = view.room();
      if (!view.screenshare() || !room || !channel.isVoiceRoom) return;
      const track = room.localParticipant.getTrackPublication(
        TrackSource.ScreenShare,
      )?.track?.mediaStreamTrack;
      if (!track) return;
      const stop = startPreviewCapture(track, (image) =>
        sendStreamPreview(client, channel, image),
      );
      onCleanup(stop);
    });

    return dispose;
  });
}
