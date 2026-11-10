/**
 * What a call needs beyond audio and video: the stage state, soundboard
 * sounds others play, and stills of your own screen share. Loaded with the
 * first call (not with the app) and attached for as long as you are in it.
 */
import { createEffect, createRoot, onCleanup } from "solid-js";

import type { Channel, Client } from "@zrzur/sdk/solid";
import {
  fetchSoundboard,
  fetchStage,
  sendStreamPreview,
} from "@zrzur/sdk/solid/voiceExtras";
import type { Room } from "livekit-client";

import { TrackSource } from "./livekitConstants";
import { SoundboardPlayer, soundGain, soundUrl } from "./soundboardPlayer";

/** The parts of the call this needs */
export type CallView = {
  room: () => Room | undefined;
  screenshare: () => boolean;
  deafen: () => boolean;
  serverDeafened: boolean;
};

/** The listener's soundboard choices */
export type SoundboardSettings = {
  soundboardMuted: boolean;
  soundboardVolume: number;
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
  settings: SoundboardSettings,
  mediaUrl: string,
) {
  const deafened = () => view.deafen() || view.serverDeafened;
  return createRoot((dispose) => {
    // a stage: who speaks and who raised a hand
    if (channel.isStage)
      void fetchStage(client, channel).catch(() => undefined);

    // soundboard: a sound someone played here plays on this device
    const server = channel.server;
    if (server) {
      const onSound = (channelId: string, soundId: string) => {
        if (channelId !== channel.id) return;
        if (settings.soundboardMuted || deafened()) return;
        const play = () => {
          const sound = server.soundboard.get(soundId);
          if (!sound) return;
          void soundboard()
            .play(
              sound._id,
              soundUrl(mediaUrl, sound._id),
              soundGain(sound.volume, settings.soundboardVolume),
            )
            .catch(() => undefined);
        };
        if (server.soundboard.has(soundId)) play();
        else void fetchSoundboard(client, server).then(play, () => undefined);
      };
      client.on("soundboardPlay", onSound);
      onCleanup(() => client.off("soundboardPlay", onSound));
    }
    // deafening or muting the soundboard stops what plays, and so does leaving
    createEffect(() => {
      if (deafened() || settings.soundboardMuted) player?.stopAll();
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
      let stop: (() => void) | undefined;
      let cancelled = false;
      void import("./streamPreview").then(({ startPreviewCapture }) => {
        if (cancelled) return;
        stop = startPreviewCapture(track, (image) =>
          sendStreamPreview(client, channel, image),
        );
      });
      onCleanup(() => {
        cancelled = true;
        stop?.();
      });
    });

    return dispose;
  });
}
