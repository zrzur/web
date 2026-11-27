import { createEffect, createSignal, on } from "solid-js";

/**
 * The video tracks of a call and the one shown large (the focus).
 *
 * The tracks come from the room, and every connect brings a new list: it is
 * kept in a signal, so whatever reads `tracks()` follows the new list. (It
 * was a plain property: the check that ends the focus kept listening to the
 * first list, and the stage stayed on a screen share that had ended.)
 *
 * The focus is a track only while that track is in the call: when a share
 * stops or a camera leaves, `focus()` is empty at once, in every view.
 */
export function createCallTracks<T>(trackId: (track: T) => string) {
  const [source, setSource] = createSignal<() => T[]>(() => []);
  const tracks = () => source()();

  const [chosen, setChosen] = createSignal<string>();
  const focus = () => {
    const id = chosen();
    return id && tracks().some((track) => trackId(track) === id)
      ? id
      : undefined;
  };

  return {
    tracks,
    focus,
    /** The room's track list (another on every connect) */
    setSource: (next: () => T[]) => setSource(() => next),
    setFocus: (id: string | undefined) => setChosen(id),
    /**
     * Inside the call's reactive root: once the focused track has left,
     * forget it, so the same person sharing again later does not take the
     * stage by itself, and call `onEnded` (show everyone again)
     */
    forgetEnded(onEnded: () => void) {
      createEffect(
        on(focus, (id, previous) => {
          if (previous && !id) {
            setChosen(undefined);
            onEnded();
          }
        }),
      );
    },
  };
}
