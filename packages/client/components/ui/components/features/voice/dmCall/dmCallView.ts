import { createSignal } from "solid-js";

/**
 * How a call in a direct message or group is shown. Kept small and free of
 * LiveKit: the channel page, the floating card and the phone call strip read
 * it from the app's first download.
 *
 * Desktop: a stage above the conversation, in the page flow, so the chat
 * stays visible below it. Its height can be dragged; it can fold to a bar.
 * Phone: the call fills the screen; Chat raises the conversation as a sheet
 * over it, Minimise goes back to the app (the floating card leads back).
 */

/** Stage height limits (px) and the default */
export const STAGE_MIN = 160;
export const STAGE_DEFAULT = 320;
/** The stage never takes more than this share of the channel view */
export const STAGE_MAX_SHARE = 0.7;
/** One arrow key press on the divider (px, on the 4 px grid) */
export const STAGE_STEP = 24;

const HEIGHT_KEY = "zrzur:dm-call-stage-height";
const FOLDED_KEY = "zrzur:dm-call-stage-folded";

/** Largest stage for a channel view of this height */
export function stageMax(viewHeight: number) {
  return Math.max(STAGE_MIN, Math.floor(viewHeight * STAGE_MAX_SHARE));
}

/** Keep a stage height within its limits */
export function clampStageHeight(height: number, viewHeight: number) {
  if (!Number.isFinite(height)) return STAGE_DEFAULT;
  return Math.round(
    Math.min(stageMax(viewHeight), Math.max(STAGE_MIN, height)),
  );
}

/**
 * The height after a key on the divider, or undefined when the key does not
 * resize (Arrow Up/Down by one step, Home smallest, End largest)
 */
export function stageHeightAfterKey(
  height: number,
  key: string,
  viewHeight: number,
): number | undefined {
  switch (key) {
    case "ArrowUp":
      return clampStageHeight(height - STAGE_STEP, viewHeight);
    case "ArrowDown":
      return clampStageHeight(height + STAGE_STEP, viewHeight);
    case "Home":
      return STAGE_MIN;
    case "End":
      return stageMax(viewHeight);
  }
}

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the stage still resizes, it is just not remembered */
  }
}

const [height, setHeightSignal] = createSignal(
  Number(read(HEIGHT_KEY)) || STAGE_DEFAULT,
);
const [folded, setFoldedSignal] = createSignal(read(FOLDED_KEY) === "1");

/** The stage height the person chose (px, per device) */
export const stageHeight = height;

export function setStageHeight(value: number) {
  setHeightSignal(value);
  write(HEIGHT_KEY, String(Math.round(value)));
}

/** Whether the stage is folded to a bar (per device) */
export const stageFolded = folded;

export function setStageFolded(value: boolean) {
  setFoldedSignal(value);
  write(FOLDED_KEY, value ? "1" : "0");
}

/** A phone's view of the call: whole screen, chat over it, or minimised */
export type PhoneCallView = "full" | "chat" | "minimised";

/**
 * The view belongs to one call: a new call (a new room) starts full screen
 * again, whatever the last one ended in
 */
const [phoneState, setPhoneState] = createSignal<{
  room?: object;
  view: PhoneCallView;
}>({ view: "full" });

/** The phone view of the call in this room */
export function phoneCallView(room: object | undefined): PhoneCallView {
  const state = phoneState();
  return room && state.room === room ? state.view : "full";
}

export function setPhoneCallView(
  room: object | undefined,
  view: PhoneCallView,
) {
  setPhoneState({ room, view });
}

/** Floating card and phone call strip: back to the whole-screen call */
export function reopenPhoneCall() {
  setPhoneState((state) => ({ ...state, view: "full" }));
}

/** A person shown on the stage who is not in the call (yet) */
export type WaitingMember = {
  id: string;
  /** the server is ringing them right now */
  ringing: boolean;
};

/**
 * Members of the conversation who are not in the call: the people being
 * rung first, in the conversation's order; never oneself
 */
export function waitingMembers(
  memberIds: Iterable<string>,
  inCall: Iterable<string>,
  selfId: string | undefined,
  ringing: readonly string[] = [],
): WaitingMember[] {
  const present = new Set(inCall);
  const list: WaitingMember[] = [];
  for (const id of memberIds) {
    if (id === selfId || present.has(id)) continue;
    list.push({ id, ringing: ringing.includes(id) });
  }
  return list.sort((a, b) => Number(b.ringing) - Number(a.ringing));
}

/** Call time as m:ss, or h:mm:ss after an hour (digits stay Latin) */
export function callDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Starting a call in a direct message or group rings people: ask first.
 * Joining a call others are already in does not ask (nor does answering a
 * ring, which never comes through here); server channels never ask.
 */
export function needsCallConfirm(
  channel: { type: string; voiceParticipants: { keys(): Iterable<string> } },
  selfId: string | undefined,
) {
  if (channel.type !== "DirectMessage" && channel.type !== "Group")
    return false;
  for (const id of channel.voiceParticipants.keys())
    if (id !== selfId) return false;
  return true;
}

/**
 * Who sits around your own tile while nobody else is in the call: everyone
 * else in the conversation, the people being rung first
 */
export function aloneMembers(
  memberIds: Iterable<string>,
  selfId: string | undefined,
  ringing: readonly string[] = [],
) {
  return waitingMembers(memberIds, [], selfId, ringing);
}

/**
 * Connected and nobody else has joined: your own tile is shown large, the
 * others wait under it
 */
export function aloneInCall(
  state: string,
  inCall: readonly string[],
  selfId: string | undefined,
) {
  return state === "CONNECTED" && inCall.every((id) => id === selfId);
}

/** Faces shown under your tile while alone: up to 5, else 4 and "+N" */
export const ALONE_FACES = 5;

export function aloneFaces<T>(members: readonly T[]) {
  if (members.length <= ALONE_FACES) return { shown: [...members], more: 0 };
  return {
    shown: members.slice(0, ALONE_FACES - 1),
    more: members.length - (ALONE_FACES - 1),
  };
}
