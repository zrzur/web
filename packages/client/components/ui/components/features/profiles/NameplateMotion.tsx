import { saveData } from "@revolt/common/lib/saveData";

import { useState } from "@revolt/state";

/** Whether this viewer sees moving designs at all, here and now */
export function useDesignMotion() {
  const state = useState();
  return () =>
    // Save data: the still frame only, the animated file is never fetched
    !saveData() &&
    !state.motion.reduced &&
    state.settings.getValue("appearance:profile_effects") !== false;
}
