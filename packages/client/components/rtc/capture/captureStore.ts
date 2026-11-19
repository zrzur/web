/**
 * Clips and recorded rooms in the app: what the room says (from the server),
 * the requests, and the engine of the call you are in. Only the voice
 * screens load this file; none of it is in the app's first download.
 *
 * The routes are not in the SDK's generated table yet, so they are called by
 * path here (contract request: voice-beta2).
 */
import { createRoot, createSignal } from "solid-js";

import type { Channel, Client } from "@zrzur/sdk/solid";
import type { Room } from "livekit-client";

import { TrackSource } from "../livekitConstants";

import { CaptureEngine, captureSupported } from "./captureEngine";
import {
  type CaptureAllowance,
  type CaptureItem,
  type CaptureState,
  NO_CAPTURE,
  captureActive,
  captureFileName,
  captureState,
  engineJob,
  recordingSecondsLeft,
  voicesToMix,
} from "./captureModel";

/** Which of the two features the server has on */
export function captureFeatures(client: Client) {
  const features = client.configuration?.features as
    | { voice_clips?: boolean; voice_recordings?: boolean }
    | undefined;
  return {
    clips: !!features?.voice_clips,
    recordings: !!features?.voice_recordings,
  };
}

type Api = {
  get(path: string): Promise<unknown>;
  put(path: string, body?: unknown): Promise<unknown>;
  post(path: string, body?: unknown): Promise<unknown>;
  delete(path: string): Promise<unknown>;
};
const api = (client: Client) => client.api as unknown as Api;
const base = (channel: Channel) => `/channels/${channel.id}/capture`;

type Entry = {
  state: () => CaptureState;
  setState: (state: CaptureState) => void;
  allowance: () => CaptureAllowance | undefined;
  setAllowance: (allowance: CaptureAllowance | undefined) => void;
};

const rooms = new Map<string, Entry>();
const listening = new WeakSet<Client>();

/** What a room says about clips and recording (empty until fetched) */
export function captureOf(channelId: string): Entry {
  let entry = rooms.get(channelId);
  if (!entry) {
    entry = createRoot(() => {
      const [state, setState] = createSignal<CaptureState>(NO_CAPTURE);
      const [allowance, setAllowance] = createSignal<CaptureAllowance>();
      return { state, setState, allowance, setAllowance };
    });
    rooms.set(channelId, entry);
  }
  return entry;
}

/** Take the room's changes from the gateway (once per client) */
export function followCapture(client: Client) {
  if (listening.has(client)) return;
  listening.add(client);
  (
    client.events as unknown as {
      on(name: "event", fn: (event: Record<string, unknown>) => void): void;
    }
  ).on("event", (event) => {
    if (event.type !== "VoiceCaptureUpdate" || typeof event.id !== "string")
      return;
    captureOf(event.id).setState(captureState(event.data));
  });
  client.on("logout", () => rooms.clear());
}

/** Ask the server for the room's state and what is left of the month */
export async function refreshCapture(client: Client, channel: Channel) {
  const info = (await api(client).get(base(channel))) as {
    state: unknown;
    allowance: CaptureAllowance;
  };
  const entry = captureOf(channel.id);
  entry.setState(captureState(info.state));
  entry.setAllowance(info.allowance);
}

const took = (client: Client, channel: Channel, answer: Promise<unknown>) =>
  answer.then((state) => {
    captureOf(channel.id).setState(captureState(state));
  });

/** Turn clips on or off in the room (Manage Channel) */
export function switchClips(client: Client, channel: Channel, on: boolean) {
  return took(client, channel, api(client).put(`${base(channel)}/clips`, { on }));
}

/** Say whether your voice may be saved in this room */
export function setConsent(client: Client, channel: Channel, include: boolean) {
  return took(
    client,
    channel,
    api(client).put(`${base(channel)}/consent`, { include }),
  );
}

/** Start recording the room as an episode (Manage Channel) */
export function startRecording(
  client: Client,
  channel: Channel,
  title: string | undefined,
) {
  return took(
    client,
    channel,
    api(client).post(`${base(channel)}/recording`, title ? { title } : {}),
  );
}

/** End the recording without saving it */
export function discardRecording(client: Client, channel: Channel) {
  return took(client, channel, api(client).delete(`${base(channel)}/recording`));
}

/** The clips and episodes of a room, newest first */
export function listCaptures(client: Client, channel: Channel) {
  return api(client).get(`${base(channel)}/items`) as Promise<CaptureItem[]>;
}

/** Remove a clip or an episode (its message and file go with it) */
export function deleteCapture(client: Client, channel: Channel, id: string) {
  return api(client).delete(`${base(channel)}/items/${id}`);
}

/** The call's engine and what the screens can do with it */
export type CaptureSession = {
  channel: Channel;
  supported: boolean;
  /** Seconds a clip made now would play */
  bufferedSeconds: () => number;
  /** Seconds the running episode has (on the recorder's device) */
  recordedSeconds: () => number;
  /** Seconds the running episode may still go on */
  recordingLeft: () => number | undefined;
  saving: () => boolean;
  /** This person answered the question since joining */
  answered: () => boolean;
  answer: (include: boolean) => Promise<void>;
  /** Save the last seconds and share them in the room's chat */
  saveClip: () => Promise<CaptureItem | undefined>;
  /** End the recording; with `keep` it is saved as an episode */
  finishRecording: (keep: boolean) => Promise<CaptureItem | undefined>;
  /** Called with every saved or removed item, for lists on screen */
  onChange: (fn: () => void) => () => void;
};

const [session, setSession] = createRoot(() =>
  createSignal<CaptureSession | undefined>(),
);

/** The engine of the call you are in, while clips or recordings are on */
export const captureSession = session;

/** The window event the "save a clip" shortcut sends */
export const SAVE_CLIP_EVENT = "zrzur:save-clip";

/** What `attachVoiceCapture` needs from the call */
export type CaptureCallView = { room: () => Room | undefined };

function microphones(room: Room, wanted: string[]) {
  const voices = new Map<string, MediaStreamTrack>();
  const want = new Set(wanted);
  const add = (
    identity: string,
    publications: Iterable<{
      source: unknown;
      track?: { mediaStreamTrack?: MediaStreamTrack };
    }>,
  ) => {
    if (!want.has(identity)) return;
    for (const publication of publications) {
      // voices only: a screen share's sound is not a voice someone agreed to
      if (publication.source !== TrackSource.Microphone) continue;
      const track = publication.track?.mediaStreamTrack;
      if (track && track.readyState === "live") voices.set(identity, track);
    }
  };
  add(room.localParticipant.identity, room.localParticipant.trackPublications.values());
  for (const participant of room.remoteParticipants.values())
    add(participant.identity, participant.trackPublications.values());
  return voices;
}

/**
 * Attach clips and recording to the call in `channel`
 * @returns detach
 */
export function attachVoiceCapture(
  client: Client,
  channel: Channel,
  view: CaptureCallView,
) {
  const features = captureFeatures(client);
  // server rooms only, and only where the server turned a feature on
  if (!channel.server || (!features.clips && !features.recordings))
    return () => undefined;

  followCapture(client);
  const entry = captureOf(channel.id);
  const me = client.user?.id ?? "";
  const supported = captureSupported();
  let engine: CaptureEngine | undefined;
  let ended = false;
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((fn) => fn());

  const [tick, setTick] = createSignal(0);
  const [saving, setSaving] = createSignal(false);
  const [answered, setAnswered] = createSignal(false);

  /** Bring the engine in line with the room and the people in it */
  const sync = () => {
    if (ended || !supported) return;
    const state = entry.state();
    const job = engineJob(state, me);
    const room = view.room();
    if (!room || (!job.buffer && !job.record)) {
      if (engine?.recording) void engine.endRecording(false);
      engine?.stop();
      engine = undefined;
      return;
    }
    if (!engine) {
      engine = new CaptureEngine(entry.allowance()?.clip_seconds ?? 30);
      void engine.start().catch((error) => {
        console.warn("[capture] could not start", error);
      });
    }
    const present = [
      room.localParticipant.identity,
      ...[...room.remoteParticipants.values()].map((p) => p.identity),
    ];
    engine.setVoices(microphones(room, voicesToMix(state, present)));
    engine.setBuffering(job.buffer);
    if (job.record && !engine.recording) {
      engine.startRecording();
      engine.onEpisodeFull = () => void current.finishRecording(true);
    } else if (!job.record && engine.recording) {
      // ended from elsewhere (discarded by a manager): nothing is kept
      void engine.endRecording(false);
    }
  };

  const upload = async (kind: "clip" | "episode", bytes: Uint8Array) => {
    const file = new File([bytes as BlobPart], captureFileName(kind, new Date()), {
      type: "audio/ogg",
    });
    return client.uploadFile("attachments", file);
  };

  const current: CaptureSession = {
    channel,
    supported,
    bufferedSeconds: () => (tick(), engine?.bufferedSeconds ?? 0),
    recordedSeconds: () => (tick(), engine?.recordedSeconds ?? 0),
    recordingLeft: () => {
      tick();
      const recording = entry.state().recording;
      const allowance = entry.allowance();
      return recording && allowance
        ? recordingSecondsLeft(recording, allowance, Date.now())
        : undefined;
    },
    saving,
    answered,
    answer: async (include) => {
      await setConsent(client, channel, include);
      setAnswered(true);
    },
    saveClip: async () => {
      const clip = engine?.takeClip();
      if (!clip || saving()) return undefined;
      setSaving(true);
      try {
        const file = await upload("clip", clip.bytes);
        const item = (await api(client).post(`${base(channel)}/clips`, {
          file,
          duration: Math.max(1, Math.round(clip.seconds)),
          included: clip.voices,
        })) as CaptureItem;
        void refreshCapture(client, channel).catch(() => undefined);
        changed();
        return item;
      } finally {
        setSaving(false);
      }
    },
    finishRecording: async (keep) => {
      if (!engine?.recording) {
        if (!keep) await discardRecording(client, channel);
        return undefined;
      }
      if (saving()) return undefined;
      setSaving(true);
      try {
        const episode = await engine.endRecording(keep);
        if (!episode) {
          await discardRecording(client, channel);
          return undefined;
        }
        const file = await upload("episode", episode.bytes);
        const item = (await api(client).post(
          `${base(channel)}/recording/finish`,
          {
            file,
            duration: Math.max(1, Math.floor(episode.seconds)),
            included: episode.voices,
          },
        )) as CaptureItem;
        void refreshCapture(client, channel).catch(() => undefined);
        changed();
        return item;
      } finally {
        setSaving(false);
      }
    },
    onChange: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  void refreshCapture(client, channel).catch(() => undefined);

  // the room's state, people coming and going, microphones changing
  const dispose = createRoot((disposeRoot) => {
    // read inside an effect-free poll: the engine follows within a second,
    // and the counters on screen move with it
    let lastState: CaptureState | undefined;
    let wasActive = false;
    const timer = setInterval(() => {
      const state = entry.state();
      const active = captureActive(state);
      // a new round of clips or a new recording asks again
      if (active && !wasActive) setAnswered(state.included.includes(me));
      if (!active) setAnswered(false);
      wasActive = active;
      if (state !== lastState || active) sync();
      lastState = state;
      // stop by itself when the episode reached what it may be
      const left = current.recordingLeft();
      if (engine?.recording && left !== undefined && left <= 0 && !saving())
        void current.finishRecording(true).catch(() => undefined);
      setTick((value) => value + 1);
    }, 1000);
    return () => {
      clearInterval(timer);
      disposeRoot();
    };
  });

  const onShortcut = () => void current.saveClip().catch(() => undefined);
  window.addEventListener(SAVE_CLIP_EVENT, onShortcut);
  setSession(current);

  return () => {
    ended = true;
    window.removeEventListener(SAVE_CLIP_EVENT, onShortcut);
    dispose();
    engine?.stop();
    engine = undefined;
    if (session() === current) setSession(undefined);
  };
}
