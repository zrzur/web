import { Show } from "solid-js";

import { useState } from "@revolt/state";

import { nameplateDrift } from "./userStyle";

/** Whether this viewer sees moving designs at all, here and now */
export function useDesignMotion() {
  const state = useState();
  return () =>
    !state.motion.reduced &&
    state.settings.getValue("appearance:profile_effects") !== false;
}

/**
 * The slow light on a built-in nameplate. Goes inside the plate's element, as
 * its first child; the parent needs `isolation: isolate`, `position: relative`
 * and `overflow: hidden`. It rests until the row is hovered, or always with
 * `live` (a preview), and is not there at all under reduced motion.
 */
export function NameplateMotion(props: { plate?: string; live?: boolean }) {
  const allowed = useDesignMotion();
  const drift = () => nameplateDrift(props.plate);
  return (
    <Show when={props.plate && !props.plate.startsWith("c:") && allowed()}>
      <span
        class="z-plate-motion"
        aria-hidden="true"
        data-live={props.live ? "" : undefined}
        style={drift() ? { "--z-plate-drift": `url("${drift()}")` } : undefined}
      />
    </Show>
  );
}
