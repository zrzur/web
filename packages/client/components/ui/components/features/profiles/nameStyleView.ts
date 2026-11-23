import { createEffect } from "solid-js";

import { useState } from "@revolt/state";

import { setNameView } from "./userStyle";

/**
 * Keeps how this viewer sees names in step with their settings: the
 * "Show name styles" switch, light or dark surfaces, and motion. Call once
 * near the root of each site that draws names.
 */
export function useNameStyleSync() {
  const state = useState();
  createEffect(() =>
    setNameView({
      plain: state.settings.getValue("appearance:name_styles") === false,
      light: !state.theme.activeTheme.darkMode,
      // like nameplates and profile effects: only reduced motion stills it
      still: state.motion.reduced,
    }),
  );
}
