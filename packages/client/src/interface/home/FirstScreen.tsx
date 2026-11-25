import { Show } from "solid-js";

import { useLocation } from "@revolt/routing";
import { useState } from "@revolt/state";
import { LoadingScreen, PhoneFrame } from "@revolt/ui";

import { goingHome } from "./goingHome";

/**
 * What shows until the app has connected.
 *
 * Wide screens (owner, 2026-11-25): one loading screen, the logo alone, and
 * then the whole app at once. A half-built frame (an empty rail and list, a
 * greeting, the logo under it) read as the app arriving in pieces.
 *
 * Phones (owner, 2026-11-18, an installed app on an iPhone, which starts
 * cold most times): no logo alone on an empty screen. Someone signed in sees
 * the app's own frame straight away, as quiet placeholders: the rail, the
 * list, the floating bar where they will be (or a page's top line and message
 * box, when the app opens on a page). When the app arrives it fills the same
 * frame, it is not a change of screen.
 */
export function FirstScreen() {
  const state = useState();
  const location = useLocation();
  const phone = window.matchMedia("(max-width: 600px)").matches;

  return (
    <Show
      when={!(phone && state.auth.getName())}
      fallback={<PhoneFrame lists={goingHome(location.pathname)} />}
    >
      <LoadingScreen />
    </Show>
  );
}
