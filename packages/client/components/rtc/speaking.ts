import { type Accessor, createSignal, onCleanup } from "solid-js";
import { useIsSpeaking } from "solid-livekit-components";

import type { Participant } from "livekit-client";

import { callInputLevel } from "./inputLevel";

/**
 * Who is speaking, measured on this device instead of waited for.
 *
 * The voice server tells everyone who speaks, but it averages the level
 * over several of its own intervals first: the ring came about a second
 * after the first word, and stayed as long after the last (owner,
 * 2026-11-27). The level is already here:
 *
 * - others: every audio packet carries its sender's level (RFC 6464), read
 *   with RTCRtpReceiver.getSynchronizationSources, at no cost
 * - you: the input gate measures your microphone about every 50 ms
 *
 * A short hold keeps the ring through the gaps between words. Where the
 * browser gives no level, the server's word is used, as before.
 */

/** How often the levels are read */
export const POLL_MS = 50;
/** The ring stays this long after the voice drops */
export const HOLD_MS = 250;
/** Packet level (0..1, 1 = 0 dBov) above which someone speaks: about -32 dBov */
export const REMOTE_THRESHOLD = 0.025;
/** Your own level (dBFS) above which you speak, once the gate is open */
export const LOCAL_THRESHOLD_DB = -50;
/** A packet older than this is silence (the sender stopped sending) */
const FRESH_MS = 300;

type Receiver = Pick<RTCRtpReceiver, "getSynchronizationSources">;

/**
 * The newest level a receiver heard, or undefined when it has none or the
 * last packet is old (DTX: a silent sender sends nothing)
 */
export function packetLevel(
  receiver: Receiver,
  now: number,
): number | undefined {
  let sources: RTCRtpSynchronizationSource[];
  try {
    sources = receiver.getSynchronizationSources();
  } catch {
    return undefined;
  }
  let best: number | undefined;
  for (const source of sources) {
    if (source.audioLevel === undefined) continue;
    // the timestamp counts from the page's time origin in some browsers
    // and from 1970 in others
    const age =
      source.timestamp > 1e12
        ? now + performance.timeOrigin - source.timestamp
        : now - source.timestamp;
    if (age > FRESH_MS) continue;
    best = Math.max(best ?? 0, source.audioLevel);
  }
  return best;
}

/** One person's ring: on with the voice, off a hold time after it */
export function nextSpeaking(
  state: { speaking: boolean; lastLoudMs: number },
  loud: boolean,
  now: number,
) {
  if (loud) return { speaking: true, lastLoudMs: now };
  return {
    speaking: state.speaking && now - state.lastLoudMs < HOLD_MS,
    lastLoudMs: state.lastLoudMs,
  };
}

type Entry = {
  read: (now: number) => boolean | undefined;
  set: (speaking: boolean | undefined) => void;
  state: { speaking: boolean; lastLoudMs: number };
};

/** One timer for every ring on screen */
const entries = new Set<Entry>();
let timer: ReturnType<typeof setInterval> | undefined;

function tick() {
  const now = performance.now();
  for (const entry of entries) {
    const loud = entry.read(now);
    if (loud === undefined) {
      entry.set(undefined);
      continue;
    }
    entry.state = nextSpeaking(entry.state, loud, now);
    entry.set(entry.state.speaking);
  }
}

function watch(entry: Entry) {
  entries.add(entry);
  timer ??= setInterval(tick, POLL_MS);
  return () => {
    entries.delete(entry);
    if (!entries.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** The receiver of a participant's microphone, when it has one */
function micReceiver(participant: Participant): Receiver | undefined {
  for (const publication of participant.audioTrackPublications.values()) {
    if (publication.source !== "microphone" || publication.isMuted) continue;
    const receiver = (publication.track as { receiver?: Receiver } | undefined)
      ?.receiver;
    if (receiver) return receiver;
  }
  return undefined;
}

/** Whether a participant's microphone is on */
function micOn(participant: Participant) {
  for (const publication of participant.audioTrackPublications.values())
    if (publication.source === "microphone" && !publication.isMuted)
      return true;
  return false;
}

/**
 * Whether a participant speaks right now: measured here when the browser
 * can, the voice server's word otherwise
 */
export function useSpeaking(participant: Participant): Accessor<boolean> {
  const server = useIsSpeaking(participant);
  const [measured, setMeasured] = createSignal<boolean | undefined>();

  const read = (now: number): boolean | undefined => {
    if (participant.isLocal) {
      const input = callInputLevel();
      if (!input) return undefined;
      return (
        micOn(participant) && input.open && input.level > LOCAL_THRESHOLD_DB
      );
    }
    if (!micOn(participant)) return false;
    const receiver = micReceiver(participant);
    if (!receiver) return undefined;
    const level = packetLevel(receiver, now);
    // no fresh packet: silent (DTX) when the browser gives levels at all
    return (level ?? 0) > REMOTE_THRESHOLD;
  };

  onCleanup(
    watch({
      read,
      set: setMeasured,
      state: { speaking: false, lastLoudMs: 0 },
    }),
  );

  return () => measured() ?? server();
}
