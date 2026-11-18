// Owner, 2026-11-18, iPhone: the camera and a shared screen were on but
// their tiles were empty. A video the browser refused to start is asked again.
import { afterEach, describe, expect, it, vi } from "vitest";

import { keepVideoPlaying } from "./keepVideoPlaying";

function video(options: { paused: boolean; attached: boolean }) {
  const element = document.createElement("video");
  const play = vi.fn(() => Promise.reject(new Error("NotAllowedError")));
  Object.defineProperty(element, "paused", { get: () => options.paused });
  Object.defineProperty(element, "srcObject", {
    get: () => (options.attached ? {} : null),
  });
  element.play = play;
  document.body.append(element);
  return { element, play, options };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("a call picture that did not start", () => {
  it("is asked to play at the next touch, and a refusal is not an error", () => {
    const v = video({ paused: true, attached: true });
    const stop = keepVideoPlaying(v.element, document, []);
    document.dispatchEvent(new Event("touchend"));
    expect(v.play).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event("click"));
    expect(v.play).toHaveBeenCalledTimes(2);
    stop();
  });

  it("is asked again when its picture arrives and shortly after it is shown", () => {
    vi.useFakeTimers();
    const v = video({ paused: true, attached: true });
    const stop = keepVideoPlaying(v.element, document, [300, 1000]);
    v.element.dispatchEvent(new Event("loadedmetadata"));
    expect(v.play).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(v.play).toHaveBeenCalledTimes(3);
    stop();
  });

  it("is left alone while it plays, and while nothing is attached", () => {
    const playing = video({ paused: false, attached: true });
    const empty = video({ paused: true, attached: false });
    const stops = [
      keepVideoPlaying(playing.element, document, []),
      keepVideoPlaying(empty.element, document, []),
    ];
    document.dispatchEvent(new Event("touchend"));
    expect(playing.play).not.toHaveBeenCalled();
    expect(empty.play).not.toHaveBeenCalled();
    stops.forEach((stop) => stop());
  });

  it("is not touched after the tile is gone", () => {
    vi.useFakeTimers();
    const v = video({ paused: true, attached: true });
    keepVideoPlaying(v.element, document, [300])();
    document.dispatchEvent(new Event("touchend"));
    v.element.dispatchEvent(new Event("canplay"));
    vi.advanceTimersByTime(500);
    expect(v.play).not.toHaveBeenCalled();
  });
});
