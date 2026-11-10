/**
 * Stage and soundboard state, kept here instead of in the SDK's classes so
 * none of it is in the app's first download: only the voice screens import
 * this file. The client hands the gateway's stage and soundboard events on
 * as `voiceEvent`; this file listens from the first time it is loaded, and
 * everything it shows is fetched then.
 */
import { createRoot, createSignal } from "solid-js";

import { ReactiveMap } from "@solid-primitives/map";
import type { Channel, Client, Server } from "@zrzur/sdk/solid";
import {
  type SoundboardSound as Sound,
  type StageState,
  applyStageChange,
  EMPTY_STAGE,
  fetchSoundboard,
  fetchStage as fetchStageState,
} from "@zrzur/sdk/solid/voiceExtras";

// Everything the voice screens need comes through this file, so the bundler
// keeps it, the SDK's requests, the player and the settings in one chunk
// the screens share (each extra chunk costs the app's first download a few
// bytes in its import map).
export {
  type SoundLibrary,
  type SoundLibrarySound,
  type StageState,
  addLibrarySound,
  createSound,
  deleteSound,
  editStage,
  endStage,
  fetchSoundLibrary,
  fetchStage,
  fetchStreamPreview,
  inviteToSpeak,
  lowerHand,
  moveToAudience,
  playSound,
  raiseHand,
  searchSoundLibrary,
  sendStreamPreview,
  soundLibraryName,
  soundLibraryPreviewUrl,
} from "@zrzur/sdk/solid/voiceExtras";
export { SoundboardPlayer, soundGain, soundUrl } from "./soundboardPlayer";
export { setSoundboardChoice, soundboardChoices } from "./soundboardSettings";

/** One stage's state, as a signal */
type StageEntry = {
  state: () => StageState;
  set: (state: StageState) => void;
};

/** One server's soundboard */
export type SoundboardEntry = {
  sounds: ReactiveMap<string, Sound>;
  limit: () => number;
  /** The first fetch (later calls share it) */
  load: () => Promise<void>;
};

const stages = new Map<string, StageEntry>();
const soundboards = new Map<
  string,
  SoundboardEntry & { loading?: Promise<void> }
>();
const listening = new WeakSet<Client>();
const playListeners = new Set<(channelId: string, soundId: string) => void>();
const removeListeners = new Set<(soundId: string) => void>();

/** The state of a stage (empty until fetched) */
export function stageOf(channelId: string): StageEntry {
  let entry = stages.get(channelId);
  if (!entry) {
    const [state, set] = createRoot(() =>
      createSignal<StageState>(EMPTY_STAGE),
    );
    entry = { state, set };
    stages.set(channelId, entry);
  }
  return entry;
}

/** Whether this user may speak on the stage */
export function isStageSpeaker(channel: Channel, userId: string) {
  return stageOf(channel.id).state().speakers.includes(userId);
}

/** A server's soundboard, fetched once */
export function soundboardOf(client: Client, server: Server): SoundboardEntry {
  let entry = soundboards.get(server.id);
  if (!entry) {
    const sounds = new ReactiveMap<string, Sound>();
    const [limit, setLimit] = createRoot(() => createSignal(0));
    const created: SoundboardEntry & { loading?: Promise<void> } = {
      sounds,
      limit,
      load: () =>
        (created.loading ??= fetchSoundboard(client, server).then(
          (list) => {
            sounds.clear();
            for (const sound of list.sounds) sounds.set(sound._id, sound);
            setLimit(list.limit);
          },
          (error) => {
            // a failed load may be tried again
            created.loading = undefined;
            throw error;
          },
        )),
    };
    entry = created;
    soundboards.set(server.id, entry);
  }
  return entry;
}

/** Call `fn` for every sound played in a call you are in */
export function onSoundPlayed(
  fn: (channelId: string, soundId: string) => void,
) {
  playListeners.add(fn);
  return () => playListeners.delete(fn);
}

/** Call `fn` when a sound is removed (to drop it from caches) */
export function onSoundRemoved(fn: (soundId: string) => void) {
  removeListeners.add(fn);
  return () => removeListeners.delete(fn);
}

/** Stages of the calls you are in: fetched again after a reconnect */
const watched = new Map<string, Channel>();
let currentClient: Client | undefined;

/** Forget everything (another account, or signed out) */
function forgetAll() {
  // screens still showing a stage see it empty, not the last account's
  for (const entry of stages.values()) entry.set(EMPTY_STAGE);
  stages.clear();
  soundboards.clear();
  watched.clear();
}

/** Keep this stage current across reconnects while you are in it */
export function watchStage(channel: Channel) {
  watched.set(channel.id, channel);
  return () => void watched.delete(channel.id);
}

/** Start following the client's stage and soundboard events (once) */
export function followVoiceEvents(client: Client) {
  // another account's client: nothing of the last one may show
  if (currentClient !== client) {
    forgetAll();
    currentClient = client;
  }
  if (listening.has(client)) return;
  listening.add(client);
  // events missed while the gateway was down: ask again for each stage
  client.on("ready", () => {
    for (const channel of watched.values())
      void fetchStageState(client, channel).then(
        (state) => stageOf(channel.id).set(state),
        () => undefined,
      );
  });
  client.on("logout", forgetAll);
  client.on("voiceEvent", (event) => {
    switch (event.type) {
      case "StageUpdate": {
        const entry = stages.get(event.id);
        if (entry) entry.set(applyStageChange(entry.state(), event.data));
        break;
      }
      case "SoundboardPlay":
        for (const fn of playListeners) fn(event.channel_id, event.sound_id);
        break;
      case "SoundboardSoundCreate":
      case "SoundboardSoundUpdate": {
        const { type: _type, ...sound } = event;
        // only a soundboard fetched already is kept current
        if (soundboards.get(sound.server)?.loading)
          soundboards.get(sound.server)!.sounds.set(sound._id, sound);
        break;
      }
      case "SoundboardSoundDelete":
        soundboards.get(event.server)?.sounds.delete(event.id);
        for (const fn of removeListeners) fn(event.id);
        break;
    }
  });
}
