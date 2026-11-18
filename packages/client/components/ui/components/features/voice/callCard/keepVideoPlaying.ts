/**
 * A call's picture that the browser did not start stays an empty tile: the
 * camera is on, the tile shows nothing. iPhones refuse to start a video by
 * themselves in Low Power Mode and after the app was in the background; they
 * allow it at the person's next touch. So a tile's video is asked to play
 * again when its picture arrives, when the app comes back to the front, at
 * the next touch or click anywhere, and a few times shortly after it is shown.
 *
 * @returns Stop watching
 */
export function keepVideoPlaying(
  video: HTMLVideoElement,
  page: Pick<Document, "addEventListener" | "removeEventListener"> = document,
  retryAfterMs: number[] = [300, 1000, 2500],
) {
  const play = () => {
    // nothing attached (yet, or any more): nothing to start
    if (!video.srcObject || !video.paused) return;
    // refused again: the next touch asks once more
    void video.play()?.catch(() => undefined);
  };

  const ownEvents = ["loadedmetadata", "canplay"] as const;
  const pageEvents = ["touchend", "click", "visibilitychange"] as const;
  for (const name of ownEvents) video.addEventListener(name, play);
  for (const name of pageEvents) page.addEventListener(name, play, true);
  const timers = retryAfterMs.map((ms) => setTimeout(play, ms));

  return () => {
    for (const name of ownEvents) video.removeEventListener(name, play);
    for (const name of pageEvents) page.removeEventListener(name, play, true);
    timers.forEach(clearTimeout);
  };
}
