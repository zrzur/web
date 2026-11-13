import { createSignal } from "solid-js";

/**
 * Whether the "voice connected" strip (the call controls in the account bar)
 * is on screen right now. While it is, an audio-only call needs no floating
 * card: on a phone that card covered the channel list for nothing.
 */
const [stripsOnScreen, setStripsOnScreen] = createSignal(0);

export const voiceStripOnScreen = () => stripsOnScreen() > 0;

/**
 * Count `element` while at least half of it is visible. Returns the function
 * that stops watching (call it when the strip goes away).
 */
export function watchVoiceStrip(element: HTMLElement): () => void {
  let counted = false;
  const set = (visible: boolean) => {
    if (visible === counted) return;
    counted = visible;
    setStripsOnScreen((n) => n + (visible ? 1 : -1));
  };

  // no observer (old browser, tests): treat the strip as shown while mounted
  if (typeof IntersectionObserver === "undefined") {
    set(true);
    return () => set(false);
  }

  const observer = new IntersectionObserver(
    ([entry]) => set(!!entry && entry.isIntersecting && entry.intersectionRatio >= 0.5),
    { threshold: [0, 0.5, 1] },
  );
  observer.observe(element);
  return () => {
    observer.disconnect();
    set(false);
  };
}
