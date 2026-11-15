import { createSignal } from "solid-js";

import type { Client } from "@zrzur/sdk/solid";

/**
 * Ringing in DM and group calls.
 *
 * Incoming: someone started a call that rings this account. It shows until
 * this account joins (on any device), declines, the call ends, the server
 * says nobody answered, or RING_TIMEOUT_MS passes here (the server's own
 * timeout is the same; this one only covers a lost event).
 *
 * Outgoing: this account started a call nobody else is in yet. It lists who
 * is being rung, and how ringing ended for each of them (declined, missed).
 */

/** The server rings for 45 s; a little longer here so its answer wins */
export const RING_TIMEOUT_MS = 47_000;

export type RingEndReason =
  | "Declined"
  | "Answered"
  | "Missed"
  | "Stopped"
  | "Ended";

export type IncomingRing = {
  channelId: string;
  initiatorId: string;
  /** When it started ringing here (ms) */
  at: number;
};

export type OutgoingRing = {
  channelId: string;
  /** Still being rung */
  ringing: string[];
  /** Ringing ended for them without an answer */
  declined: string[];
  missed: string[];
  at: number;
};

export type RingState = {
  incoming: IncomingRing[];
  outgoing?: OutgoingRing;
};

export type RingEvent =
  | {
      type: "VoiceCallUpdate";
      initiator_id: string;
      channel_id: string;
      ended: boolean;
    }
  | {
      type: "VoiceRingEnd";
      channel_id: string;
      user: string;
      reason: RingEndReason;
    };

export const NO_RINGS: RingState = { incoming: [] };

/** Apply one gateway event to the ring state */
export function applyRingEvent(
  state: RingState,
  event: RingEvent,
  selfId: string | undefined,
  now: number,
): RingState {
  switch (event.type) {
    case "VoiceCallUpdate": {
      if (event.ended) {
        return {
          incoming: state.incoming.filter(
            (ring) => ring.channelId !== event.channel_id,
          ),
          outgoing:
            state.outgoing?.channelId === event.channel_id
              ? undefined
              : state.outgoing,
        };
      }
      // the start only reaches the people it rings; never ring oneself
      if (!selfId || event.initiator_id === selfId) return state;
      return {
        ...state,
        incoming: [
          ...state.incoming.filter(
            (ring) => ring.channelId !== event.channel_id,
          ),
          {
            channelId: event.channel_id,
            initiatorId: event.initiator_id,
            at: now,
          },
        ],
      };
    }
    case "VoiceRingEnd": {
      let next = state;
      if (event.user === selfId)
        next = {
          ...next,
          incoming: next.incoming.filter(
            (ring) => ring.channelId !== event.channel_id,
          ),
        };
      const out = next.outgoing;
      if (
        out?.channelId === event.channel_id &&
        out.ringing.includes(event.user)
      )
        next = {
          ...next,
          outgoing: {
            ...out,
            ringing: out.ringing.filter((id) => id !== event.user),
            declined:
              event.reason === "Declined"
                ? [...out.declined, event.user]
                : out.declined,
            missed:
              event.reason === "Missed"
                ? [...out.missed, event.user]
                : out.missed,
          },
        };
      return next;
    }
  }
}

/** Drop incoming rings older than the timeout (a lost end event) */
export function expireRings(state: RingState, now: number): RingState {
  const incoming = state.incoming.filter(
    (ring) => now - ring.at < RING_TIMEOUT_MS,
  );
  const outgoing =
    state.outgoing && now - state.outgoing.at >= RING_TIMEOUT_MS
      ? {
          ...state.outgoing,
          ringing: [],
          missed: [...state.outgoing.missed, ...state.outgoing.ringing],
        }
      : state.outgoing;
  return incoming.length === state.incoming.length &&
    outgoing === state.outgoing
    ? state
    : { incoming, outgoing };
}

/**
 * How an outgoing ring has ended: everyone declined, nobody answered, or
 * still open (someone is still being rung, or someone answered)
 */
export function outgoingOutcome(
  ring: OutgoingRing | undefined,
): "declined" | "missed" | undefined {
  if (!ring || ring.ringing.length) return;
  if (ring.declined.length && !ring.missed.length) return "declined";
  if (ring.declined.length || ring.missed.length) return "missed";
}

const [rings, setRings] = createSignal<RingState>(NO_RINGS);
let timer: ReturnType<typeof setInterval> | undefined;

function update(next: RingState) {
  setRings(next);
  const open = next.incoming.length || next.outgoing?.ringing.length;
  if (open && !timer)
    timer = setInterval(() => update(expireRings(rings(), Date.now())), 1000);
  if (!open && timer) {
    clearInterval(timer);
    timer = undefined;
  }
}

/** Current rings (reactive) */
export const ringState = rings;

/** This account started a call nobody else is in yet: ring these people */
export function startOutgoingRing(channelId: string, userIds: string[]) {
  update({
    ...rings(),
    outgoing: userIds.length
      ? {
          channelId,
          ringing: userIds,
          declined: [],
          missed: [],
          at: Date.now(),
        }
      : undefined,
  });
}

/** The call was answered, left or ended: nothing is rung from here */
export function clearOutgoingRing(channelId?: string) {
  const out = rings().outgoing;
  if (out && (!channelId || out.channelId === channelId))
    update({ ...rings(), outgoing: undefined });
}

/** Stop showing an incoming ring here (declined, joined) */
export function dismissIncomingRing(channelId: string) {
  update({
    ...rings(),
    incoming: rings().incoming.filter((ring) => ring.channelId !== channelId),
  });
}

const listening = new WeakSet<Client>();

/** Start following the client's ringing events (once per client) */
export function followRinging(client: Client) {
  if (listening.has(client)) return;
  listening.add(client);
  client.on("logout", () => update(NO_RINGS));
  client.on("voiceEvent", (event) => {
    if (event.type === "VoiceCallUpdate" || event.type === "VoiceRingEnd")
      update(applyRingEvent(rings(), event, client.user?.id, Date.now()));
  });
}
