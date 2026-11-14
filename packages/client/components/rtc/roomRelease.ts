import type { Room } from "livekit-client";

/**
 * Let a call's room leave memory when the call ends.
 *
 * LiveKit (2.22) listens for device changes for every room and keeps that
 * listener behind a weak reference, with a clean-up in a
 * FinalizationRegistry. Both functions are created inside the room's
 * constructor and so keep the room itself: no room was ever freed, one more
 * stayed after every call. Without the registry LiveKit takes its older
 * path: a plain listener that it removes when the room disconnects. Zrzur
 * makes a new room for every call and never reuses one, so nothing is lost.
 * @param room LiveKit's Room class
 */
export function releaseRoomsOnDisconnect(room: typeof Room) {
  room.cleanupRegistry = false;
}
