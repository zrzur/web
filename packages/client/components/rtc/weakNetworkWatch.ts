/**
 * Watches a call's connection and applies the weak-connection steps to it
 * (see weakNetwork.ts for what a level is and when a call moves).
 *
 * Every two seconds: packet loss and round trip time from the browser's
 * WebRTC statistics (both directions), plus the voice server's own verdict.
 * On a level change: the microphone's bitrate, the quality of the video
 * received (lowest, then none) and of the video sent (lowest, then paused).
 * Tracks that appear later get the current level too.
 */
import type {
  LocalTrackPublication,
  RemoteTrackPublication,
  Room,
} from "livekit-client";

import type { ConnectionQualityName } from "./callHealth";
import {
  type NetworkLevel,
  type NetworkPlan,
  type NetworkSample,
  type NetworkState,
  type PacketCounters,
  type WeakNetworkSettings,
  GOOD_NETWORK,
  nextNetworkState,
  planFor,
} from "./weakNetwork";

/** Time between two looks at the connection */
export const SAMPLE_EVERY_MS = 2000;

/** livekit-client's VideoQuality (livekitConstants.test.ts checks them) */
export const VIDEO_QUALITY_LOW = 0;
export const VIDEO_QUALITY_HIGH = 2;

type StatsSource = {
  getRTCStatsReport?: () => Promise<RTCStatsReport | undefined>;
};

/**
 * The counters of one reading, per RTP stream (by SSRC). Only counters are
 * kept, never "last value" fields such as `fractionLost`: a simulcast layer
 * that dynacast paused keeps its last report for ever, so a value read from
 * it can be old and high. A counter that did not move simply adds nothing.
 */
export type Reading = {
  /** What others' streams lost and delivered on the way to us */
  inbound: Map<string, PacketCounters>;
  /** Packets each of our streams sent */
  sent: Map<string, number>;
  /** Packets of each of our streams the server says it lost */
  upLost: Map<string, number>;
  /** Round trip time of the connection in use (one value, not per layer) */
  rttMs?: number;
};

export function emptyReading(): Reading {
  return { inbound: new Map(), sent: new Map(), upLost: new Map() };
}

const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Add one track's report to a reading */
export function readReport(reading: Reading, report: Iterable<unknown>) {
  for (const entry of report) {
    const stat = entry as Record<string, unknown>;
    const ssrc = stat.ssrc === undefined ? undefined : String(stat.ssrc);
    if (stat.type === "inbound-rtp" && ssrc) {
      reading.inbound.set(ssrc, {
        lost: number(stat.packetsLost) ?? 0,
        received: number(stat.packetsReceived) ?? 0,
      });
    } else if (stat.type === "outbound-rtp" && ssrc) {
      reading.sent.set(ssrc, number(stat.packetsSent) ?? 0);
    } else if (stat.type === "remote-inbound-rtp" && ssrc) {
      const lost = number(stat.packetsLost);
      if (lost !== undefined) reading.upLost.set(ssrc, lost);
    } else if (stat.type === "candidate-pair" && stat.nominated) {
      const rtt = number(stat.currentRoundTripTime);
      if (rtt !== undefined && rtt > 0)
        reading.rttMs = Math.max(reading.rttMs ?? 0, rtt * 1000);
    }
  }
}

/** Packets that have to move between two readings before loss counts */
const MIN_PACKETS = 20;

/**
 * Loss of the streams present in both readings, in percent, or undefined
 * when too few packets moved (silence with DTX, video paused, a new
 * stream). Counters that went backwards (a stream that restarted) count
 * as nothing.
 */
function lossOf(
  pairs: {
    lostBefore: number;
    lostNow: number;
    movedBefore: number;
    movedNow: number;
  }[],
) {
  let lost = 0;
  let moved = 0;
  for (const pair of pairs) {
    if (pair.movedNow < pair.movedBefore || pair.lostNow < pair.lostBefore)
      continue;
    lost += pair.lostNow - pair.lostBefore;
    moved += pair.movedNow - pair.movedBefore;
  }
  if (moved < MIN_PACKETS) return undefined;
  // received counts what arrived, sent what left: loss is out of both
  return Math.min(100, (lost / Math.max(moved, lost)) * 100);
}

/**
 * A sample from this reading and the one before. The voice server's own
 * verdict is kept in the sample for diagnosis only and never steps a call
 * down: it reacts to the steps themselves (fewer layers sent reads as a
 * worse publisher), which locked calls at "very weak".
 */
export function sampleFrom(
  before: Reading | undefined,
  now: Reading,
  quality: ConnectionQualityName | undefined,
  at: number,
): NetworkSample {
  let lossPercent: number | undefined;
  if (before) {
    const down = lossOf(
      [...now.inbound].flatMap(([ssrc, counters]) => {
        const old = before.inbound.get(ssrc);
        return old
          ? [
              {
                lostBefore: old.lost,
                lostNow: counters.lost,
                // what should have arrived: received plus lost
                movedBefore: old.received + old.lost,
                movedNow: counters.received + counters.lost,
              },
            ]
          : [];
      }),
    );
    const up = lossOf(
      [...now.upLost].flatMap(([ssrc, lost]) => {
        const oldLost = before.upLost.get(ssrc);
        const sentNow = now.sent.get(ssrc);
        const sentBefore = before.sent.get(ssrc);
        return oldLost === undefined ||
          sentNow === undefined ||
          sentBefore === undefined
          ? []
          : [
              {
                lostBefore: oldLost,
                lostNow: lost,
                movedBefore: sentBefore,
                movedNow: sentNow,
              },
            ];
      }),
    );
    if (down !== undefined || up !== undefined)
      lossPercent = Math.max(down ?? 0, up ?? 0);
  }
  return { at, lossPercent, rttMs: now.rttMs, quality };
}

/** A fresh call settles first: samples this soon after joining do not count */
export const WARMUP_MS = 8000;

async function read(room: Room): Promise<Reading> {
  const reading = emptyReading();
  const sources: StatsSource[] = [];
  for (const publication of room.localParticipant.trackPublications.values())
    if (publication.track) sources.push(publication.track as StatsSource);
  for (const participant of room.remoteParticipants.values())
    for (const publication of participant.trackPublications.values())
      if (publication.track) sources.push(publication.track as StatsSource);

  await Promise.all(
    sources.map(async (source) => {
      try {
        const report = await source.getRTCStatsReport?.();
        if (report) readReport(reading, report.values());
      } catch {
        // a track that just ended has no statistics: the others count
      }
    }),
  );
  return reading;
}

/**
 * Videos of others this watch turned off or lowered. Going back to normal
 * touches only these: a tile that adaptive stream turned off (hidden, off
 * screen) stays as it was.
 */
const changedByUs = new WeakSet<RemoteTrackPublication>();

function applyRemote(
  publication: RemoteTrackPublication,
  remoteVideo: NetworkPlan["remoteVideo"],
) {
  if (publication.kind !== "video" || !publication.isSubscribed) return;
  try {
    if (remoteVideo === "auto") {
      if (!changedByUs.has(publication)) return;
      changedByUs.delete(publication);
      publication.setEnabled(true);
      publication.setVideoQuality(VIDEO_QUALITY_HIGH);
      return;
    }
    changedByUs.add(publication);
    if (remoteVideo === "off") {
      publication.setEnabled(false);
    } else {
      publication.setEnabled(true);
      publication.setVideoQuality(VIDEO_QUALITY_LOW);
    }
  } catch {
    // the track went away in the meantime
  }
}

/** Own videos this watch lowered or paused */
const ownChangedByUs = new WeakSet<LocalTrackPublication>();

type OwnVideo = {
  setPublishingQuality?: (quality: number) => void;
  pauseUpstream?: () => Promise<void>;
  resumeUpstream?: () => Promise<void>;
};

async function applyOwn(
  publication: LocalTrackPublication,
  ownVideo: NetworkPlan["ownVideo"],
) {
  if (publication.kind !== "video" || !publication.track) return;
  const track = publication.track as unknown as OwnVideo;
  if (ownVideo === "full" && !ownChangedByUs.has(publication)) return;
  if (ownVideo === "full") ownChangedByUs.delete(publication);
  else ownChangedByUs.add(publication);
  try {
    if (ownVideo === "paused") {
      await track.pauseUpstream?.();
    } else {
      await track.resumeUpstream?.();
      track.setPublishingQuality?.(
        ownVideo === "low" ? VIDEO_QUALITY_LOW : VIDEO_QUALITY_HIGH,
      );
    }
  } catch {
    // unpublished in the meantime
  }
}

/** Apply a plan's video part to every track the room has now */
export function applyVideoPlan(room: Room, plan: NetworkPlan) {
  for (const participant of room.remoteParticipants.values())
    for (const publication of participant.trackPublications.values())
      applyRemote(publication, plan.remoteVideo);
  for (const publication of room.localParticipant.trackPublications.values())
    void applyOwn(publication, plan.ownVideo);
}

export type WeakNetworkWatchOptions = {
  settings: WeakNetworkSettings;
  /** Bitrate the call sends at on a good connection */
  baseBitrate: () => number;
  /** High quality audio is on */
  music: () => boolean;
  /** Cap the microphone that is already sending */
  setVoiceBitrate: (bitrate: number) => void;
  /** The level changed (also called with "good" when the watch ends) */
  onLevel: (level: NetworkLevel) => void;
  /** For tests and diagnosis: every sample with the level it led to */
  onSample?: (
    sample: NetworkSample,
    reading: Reading,
    level: NetworkLevel,
  ) => void;
  /** For tests */
  now?: () => number;
};

/**
 * Start watching. Returns the function that stops it and puts the call
 * back to normal.
 */
export function watchWeakNetwork(room: Room, options: WeakNetworkWatchOptions) {
  const now = options.now ?? (() => Date.now());
  const startedAt = now();
  let state: NetworkState = GOOD_NETWORK;
  let before: Reading | undefined;
  let stopped = false;
  let busy = false;

  const plan = () =>
    planFor(
      state.level,
      options.baseBitrate(),
      options.music(),
      options.settings,
    );

  const apply = () => {
    const current = plan();
    options.setVoiceBitrate(current.audioBitrate);
    applyVideoPlan(room, current);
  };

  const tick = async () => {
    if (stopped || busy) return;
    busy = true;
    try {
      const reading = await read(room);
      if (stopped) return;
      const sample = sampleFrom(
        before,
        reading,
        room.localParticipant.connectionQuality as ConnectionQualityName,
        now(),
      );
      before = reading;
      // joining, the first layers and the bandwidth estimate settle first
      const next =
        sample.at - startedAt < WARMUP_MS
          ? state
          : nextNetworkState(state, sample, options.settings);
      const changed = next.level !== state.level;
      state = next;
      options.onSample?.(sample, reading, state.level);
      if (changed) {
        apply();
        options.onLevel(state.level);
      }
    } finally {
      busy = false;
    }
  };

  // tracks that arrive while the call is weak start at the current level
  const onSubscribed = (
    _track: unknown,
    publication: RemoteTrackPublication,
  ) => {
    if (state.level !== "good") applyRemote(publication, plan().remoteVideo);
  };
  const onPublished = (publication: LocalTrackPublication) => {
    if (state.level !== "good") void applyOwn(publication, plan().ownVideo);
  };
  room.on("trackSubscribed", onSubscribed);
  room.on("localTrackPublished", onPublished);

  const timer = setInterval(() => void tick(), SAMPLE_EVERY_MS);

  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    room.off("trackSubscribed", onSubscribed);
    room.off("localTrackPublished", onPublished);
    if (state.level !== "good") {
      state = GOOD_NETWORK;
      apply();
    }
    options.onLevel("good");
  };
}
