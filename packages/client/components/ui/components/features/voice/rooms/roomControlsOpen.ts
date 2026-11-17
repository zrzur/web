import { createRoot, createSignal } from "solid-js";

import type { Channel } from "@zrzur/sdk/solid";

/**
 * Whether the controls of the call's temporary room are open. Shared by the
 * call's button and the panel it opens above the call; closes when the call
 * changes.
 */
export const [roomControlsOpen, setRoomControlsOpen] = createRoot(() =>
  createSignal(false),
);

/**
 * Whether this user controls the room: the member it was made for, or
 * someone who manages permissions in it
 */
export function controlsRoom(
  channel: Channel | undefined,
  userId: string | undefined,
): boolean {
  return (
    !!channel?.temporaryForId &&
    (channel.temporaryForId === userId ||
      channel.havePermission("ManagePermissions"))
  );
}
