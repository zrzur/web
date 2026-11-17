import { Trans } from "@lingui/solid/macro";

import { Dialog, DialogProps } from "@revolt/ui";
import RoomControlsPanel from "@revolt/ui/components/features/voice/rooms/RoomControlsPanel";

import { Modals } from "../types";

/**
 * The controls of a temporary room as a dialog: where the call has no room
 * for the panel above it (phones, a call on the whole screen).
 */
export function RoomControlsModal(
  props: DialogProps & Modals & { type: "room_controls" },
) {
  return (
    <Dialog
      size="sm"
      iconName="speaker-high"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Your room</Trans>}
      description={
        <Trans>
          This room is yours while you are in it. It is removed when everyone
          has left.
        </Trans>
      }
      actions={[{ text: <Trans>Done</Trans>, variant: "text" }]}
    >
      <RoomControlsPanel channel={props.channel} bare />
    </Dialog>
  );
}
