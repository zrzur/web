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
  GOOD_NETWORK,
  type NetworkLevel,
  type NetworkPlan,
  type NetworkSample,
  type NetworkState,
  type PacketCounters,
  type WeakNetworkSettings,
  lossBetween,
  nextNetworkState,
  planFor,
} from "./weakNetwork";

/** Time between two looks at the connection */
export const SAMPLE_EVERY_MS = 2000;

/** livekit-client's VideoQuality (livekitConstants.test.ts checks them) */
export const VIDEO_QUALITY_LOW = 0;
export const VIDEO_QUALITY_HIGH = 2;

type StatsSource = { getRTCStatsReport?: () => Promise<RTCStatsReport | undefined> };

/** What the statistics of one reading say */
export type Reading = {
  /** Packets others' audio and video lost on the way to us */
  down: PacketCounters;
  /** Share of our own packets the server did not get (0..1), worst track */
  upLost?: number;
  rttMs?: number;
};

/** Add one track's report to a reading */
export function readReport(reading: Reading, report: Iterable<unknown>) {
  for (const entry of report) {
    const stat = entry as Record<string, unknown>;
    if (stat.type === "inbound-rtp") {
      reading.down.lost += Number(stat.packetsLost) || 0;
      reading.down.received += Number(stat.packetsReceived) || 0;
    } else if (stat.type === "remote-inbound-rtp") {
      const lost = Number(stat.fractionLost);
      if (Number.isFinite(lost))
        reading.upLost = Math.max(reading.upLost ?? 0, lost);
      const rtt = Number(stat.roundTripTime);
      if (Number.isFinite(rtt) && rtt > 0)
        reading.rttMs = Math.max(reading.rttMs ?? 0, rtt * 1000);
    } else if (
      stat.type === "candidate-pair" &&
      stat.nominated &&
      Number(stat.currentRoundTripTime) > 0
    ) {
      reading.rttMs = Math.max(
        reading.rttMs ?? 0,
        Number(stat.currentRoundTripTime) * 1000,
      );
    }
  }
}

/** A sample from this reading and the one before */
export function sampleFrom(
  before: Reading | undefined,
  now: Reading,
  quality: ConnectionQualityName | undefined,
  at: number,
): NetworkSample {
  const down = lossBetween(before?.down, now.down);
  const up = now.upLost === undefined ? undefined : now.upLost * 100;
  const lossPercent =
    down === undefined && up === undefined
      ? undefined
      : Math.max(down ?? 0, up ?? 0);
  return { at, lossPercent, rttMs: now.rttMs, quality };
}

async function read(room: Room): Promise<Reading> {
  const reading: Reading = { down: { lost: 0, received: 0 } };
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

function applyRemote(
  publication: RemoteTrackPublication,
  remoteVideo: NetworkPlan["remoteVideo"],
) {
  if (publication.kind !== "video" || !publication.isSubscribed) return;
  try {
    if (remoteVideo === "off") {
      publication.setEnabled(false);
    } else {
      publication.setEnabled(true);
      publication.setVideoQuality(
        remoteVideo === "low" ? VIDEO_QUALITY_LOW : VIDEO_QUALITY_HIGH,
      );
    }
  } catch {
    // the track went away in the meantime
  }
}

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
  /** For tests */
  now?: () => number;
};

/**
 * Start watching. Returns the function that stops it and puts the call
 * back to normal.
 */
export function watchWeakNetwork(room: Room, options: WeakNetworkWatchOptions) {
  const now = options.now ?? (() => Date.now());
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
      const next = nextNetworkState(state, sample, options.settings);
      const changed = next.level !== state.level;
      state = next;
      if (changed) {
        apply();
        options.onLevel(state.level);
      }
    } finally {
      busy = false;
    }
  };

  // tracks that arrive while the call is weak start at the current level
  const onSubscribed = (_track: unknown, publication: RemoteTrackPublication) => {
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
