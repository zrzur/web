import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RELEASE_GRACE_MS,
  liveClips,
  resetVoicePlayback,
  takeTurn,
  voiceClip,
} from "./voicePlayback";

/** Just enough of an <audio> element: play/pause fire their events */
class FakeAudio extends EventTarget {
  paused = true;
  currentTime = 0;
  duration = NaN;
  preload = "";
  src = "";
  loads = 0;
  async play() {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
  }
  pause() {
    if (this.paused) return;
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
  load() {
    this.loads++;
  }
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
}

let made: FakeAudio[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  made = [];
  resetVoicePlayback(() => {
    const audio = new FakeAudio();
    made.push(audio);
    return audio as unknown as HTMLAudioElement;
  });
});

afterEach(() => {
  resetVoicePlayback();
  vi.useRealTimers();
});

describe("voice playback", () => {
  it("starting a second clip pauses the first, every time", async () => {
    const first = voiceClip("a.ogg");
    const second = voiceClip("b.ogg");

    await first.toggle();
    expect(first.playing()).toBe(true);

    await second.toggle();
    expect(second.playing()).toBe(true);
    expect(first.playing()).toBe(false);
    expect(made[0].paused).toBe(true);

    await first.toggle();
    expect(first.playing()).toBe(true);
    expect(second.playing()).toBe(false);
  });

  it("a row drawn again keeps the same clip playing", async () => {
    const clip = voiceClip("a.ogg");
    await clip.toggle();
    made[0].currentTime = 4;

    // the row's cleanup, then the new row, in one update
    clip.release();
    const again = voiceClip("a.ogg");

    vi.advanceTimersByTime(RELEASE_GRACE_MS * 2);
    expect(again).toBe(clip);
    expect(made).toHaveLength(1);
    expect(made[0].paused).toBe(false);
    expect(again.playing()).toBe(true);
  });

  it("stops a clip that no row shows any more", async () => {
    const clip = voiceClip("a.ogg");
    await clip.toggle();
    clip.release();

    vi.advanceTimersByTime(RELEASE_GRACE_MS - 1);
    expect(made[0].paused).toBe(false);
    vi.advanceTimersByTime(1);
    expect(made[0].paused).toBe(true);
    expect(made[0].src).toBe("");
    expect(liveClips()).toBe(0);
  });

  it("two rows showing the same file share one element", async () => {
    const one = voiceClip("a.ogg");
    const two = voiceClip("a.ogg");
    await one.toggle();
    one.release();
    vi.advanceTimersByTime(RELEASE_GRACE_MS * 2);
    expect(two.playing()).toBe(true);
    expect(made).toHaveLength(1);
  });

  it("a failed load is tried again on the next tap", async () => {
    const clip = voiceClip("a.ogg");
    made[0].dispatchEvent(new Event("error"));
    expect(clip.error()).toBe(true);

    await clip.toggle();
    expect(made[0].loads).toBe(1);
    expect(clip.error()).toBe(false);
    expect(clip.playing()).toBe(true);
  });

  it("a refused start does not mark the file as broken", async () => {
    const clip = voiceClip("a.ogg");
    made[0].play = () =>
      Promise.reject(new DOMException("needs a tap", "NotAllowedError"));
    await clip.toggle();
    expect(clip.error()).toBe(false);
  });

  it("a video starting pauses the voice message", async () => {
    const clip = voiceClip("a.ogg");
    await clip.toggle();
    const video = new FakeAudio();
    takeTurn(video as unknown as HTMLMediaElement);
    expect(clip.playing()).toBe(false);
  });

  it("ending returns to the start", async () => {
    const clip = voiceClip("a.ogg");
    await clip.toggle();
    made[0].currentTime = 3;
    made[0].dispatchEvent(new Event("timeupdate"));
    expect(clip.current()).toBe(3);
    made[0].paused = true;
    made[0].dispatchEvent(new Event("ended"));
    expect(clip.playing()).toBe(false);
    expect(clip.current()).toBe(0);
  });
});
