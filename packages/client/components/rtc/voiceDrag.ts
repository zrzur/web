import { createSignal } from "solid-js";

/** Participant being dragged in the server sidebar towards another voice channel. */
export type DraggedVoiceParticipant = { userId: string; channelId: string };

/** dataTransfer type, so channel reordering and file drops ignore the drag. */
export const VOICE_PARTICIPANT_DRAG_TYPE =
  "application/x-zrzur-voice-participant";

// dragover cannot read dataTransfer contents, so the drop targets read this.
const [draggedVoiceParticipant, setDraggedVoiceParticipant] =
  createSignal<DraggedVoiceParticipant>();

export { draggedVoiceParticipant, setDraggedVoiceParticipant };
