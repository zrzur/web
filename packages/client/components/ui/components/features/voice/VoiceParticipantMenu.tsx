import { lazy } from "solid-js";

/**
 * Voice participant context menu, loaded on demand.
 *
 * A static import pulls @revolt/app into the @revolt/ui barrel while it is
 * still initialising, which creates an import cycle and blanks the app on boot.
 */
export const VoiceParticipantContextMenu = lazy(() =>
  import("@revolt/app/menus/VoiceParticipantContextMenu").then((m) => ({
    default: m.VoiceParticipantContextMenu,
  })),
);
