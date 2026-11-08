import { Show, createSignal, onCleanup, onMount } from "solid-js";

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
 * The slow light on a built-in nameplate. Goes inside the plate's element; the
 * parent needs `isolation: isolate`, `position: relative` and
 * `overflow: hidden`. It is there only while its row is hovered or focused, or
 * always with `live` (a preview), and never under reduced motion.
 *
 * A wall or picker shows dozens of plates. A resting layer for each, even
 * paused, is two animated boxes Chrome has to place in its layers on every
 * frame (most of the Designs page's scroll cost). So at rest only an empty,
 * hidden marker is left: it finds the row and waits for the pointer.
 */
export function NameplateMotion(props: { plate?: string; live?: boolean }) {
  const allowed = useDesignMotion();
  const drift = () => nameplateDrift(props.plate);
  const [near, setNear] = createSignal(false);
  let marker: HTMLSpanElement | undefined;

  onMount(() => {
    let host = marker?.parentElement;
    // a plate drawn behind a row (member list, `data-nameplate`) takes no
    // pointer: the row does. An attribute, not computed style: reading style
    // here forced a style pass for every plate as a page of them mounted.
    if (host?.hasAttribute("data-nameplate")) host = host.parentElement;
    if (!host) return;
    const on = () => setNear(true);
    const off = () => setNear(false);
    const out = (event: FocusEvent) => {
      if (!host!.contains(event.relatedTarget as Node | null)) off();
    };
    host.addEventListener("pointerenter", on);
    host.addEventListener("pointerleave", off);
    host.addEventListener("focusin", on);
    host.addEventListener("focusout", out);
    onCleanup(() => {
      host!.removeEventListener("pointerenter", on);
      host!.removeEventListener("pointerleave", off);
      host!.removeEventListener("focusin", on);
      host!.removeEventListener("focusout", out);
    });
  });

  return (
    <>
      <span ref={marker} hidden aria-hidden="true" />
      <Show
        when={
          props.plate &&
          !props.plate.startsWith("c:") &&
          allowed() &&
          (props.live || near())
        }
      >
        <span
          class="z-plate-motion"
          aria-hidden="true"
          data-live=""
          style={
            drift() ? { "--z-plate-drift": `url("${drift()}")` } : undefined
          }
        />
      </Show>
    </>
  );
}
