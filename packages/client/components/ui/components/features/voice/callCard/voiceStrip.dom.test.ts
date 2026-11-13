import { afterEach, describe, expect, it, vi } from "vitest";

import { voiceStripOnScreen, watchVoiceStrip } from "./voiceStrip";

// A stand-in IntersectionObserver: the test says when the strip is on screen
type Entry = { isIntersecting: boolean; intersectionRatio: number };
let report: ((entries: Entry[]) => void) | undefined;
class FakeObserver {
  constructor(callback: (entries: Entry[]) => void) {
    report = callback;
  }
  observe() {}
  disconnect() {}
}

afterEach(() => {
  vi.unstubAllGlobals();
  report = undefined;
});

describe("the voice strip decides whether an audio call needs the floating card", () => {
  it("counts the strip only while at least half of it is on screen", () => {
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    const stop = watchVoiceStrip(document.createElement("div"));
    expect(voiceStripOnScreen()).toBe(false);

    report!([{ isIntersecting: true, intersectionRatio: 1 }]);
    expect(voiceStripOnScreen()).toBe(true);

    // a phone opens a channel: the list (and the strip) slides away
    report!([{ isIntersecting: true, intersectionRatio: 0.2 }]);
    expect(voiceStripOnScreen()).toBe(false);

    report!([{ isIntersecting: true, intersectionRatio: 0.8 }]);
    stop();
    expect(voiceStripOnScreen()).toBe(false);
  });

  it("without an observer the strip counts while it is mounted", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const stop = watchVoiceStrip(document.createElement("div"));
    expect(voiceStripOnScreen()).toBe(true);
    stop();
    expect(voiceStripOnScreen()).toBe(false);
  });
});
