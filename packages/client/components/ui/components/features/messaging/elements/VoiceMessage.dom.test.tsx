import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createRoot, createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui/icons/Icon", () => ({
  Icon: (props: { name: string }) => <span data-icon={props.name} />,
}));
// the waveform reads the whole file: not here
vi.mock("./voice", async (original) => ({
  ...(await original<typeof import("./voice")>()),
  readVoice: () => new Promise(() => undefined),
}));

// `use:floating` (the context menu) is set up by the app, not here
(globalThis as Record<string, unknown>).floating = () => {};

import { MediaPlayer } from "./MediaPlayer";
import { VoiceMessage } from "./VoiceMessage";
import {
  RELEASE_GRACE_MS,
  liveClips,
  resetVoicePlayback,
  voiceClip,
  watchAddress,
} from "./voicePlayback";

/** Just enough of an <audio> element: play/pause fire their events */
class FakeAudio extends EventTarget {
  paused = true;
  currentTime = 0;
  duration = NaN;
  preload = "";
  src = "";
  async play() {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
  }
  pause() {
    if (this.paused) return;
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
  load() {}
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
  getAttribute(name: string) {
    return name === "src" ? this.src || null : null;
  }
}

let made: FakeAudio[] = [];
let dispose: (() => void) | undefined;

function mount(view: () => unknown) {
  dispose = render(
    () => <I18nProvider i18n={i18n}>{view() as never}</I18nProvider>,
    document.body.firstElementChild as HTMLElement,
  );
}

const announcer = () =>
  document.querySelector<HTMLElement>("[data-playback-announcer]");

const play = (index = 0) =>
  document.querySelectorAll<HTMLButtonElement>(".z-voice-play")[index];

beforeEach(() => {
  vi.useFakeTimers();
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
  made = [];
  resetVoicePlayback(() => {
    const audio = new FakeAudio();
    made.push(audio);
    return audio as unknown as HTMLAudioElement;
  });
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  resetVoicePlayback();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("a voice message row", () => {
  it("lets go of every file it showed: a new src, then unmounted", () => {
    const [src, setSrc] = createSignal("https://files.test/a/original");
    mount(() => <VoiceMessage src={src()} />);
    expect(liveClips()).toBe(1);

    setSrc("https://files.test/b/original");
    // the old file stops at once: the row shows another one now
    expect(liveClips()).toBe(1);
    expect(made[0].src).toBe("");

    dispose!();
    dispose = undefined;
    expect(liveClips()).toBe(1);
    vi.advanceTimersByTime(RELEASE_GRACE_MS);
    expect(liveClips()).toBe(0);
  });

  it("a tap plays, and the row shows it", async () => {
    mount(() => <VoiceMessage src="https://files.test/a/original" />);
    play().click();
    await Promise.resolve();
    expect(made[0].paused).toBe(false);
    expect(
      document.querySelector(".z-voice")!.getAttribute("data-playing"),
    ).toBe("true");
    expect(play().getAttribute("aria-label")).toBe("Pause");
  });

  it("after a failed load the button says Try again and why", () => {
    mount(() => <VoiceMessage src="https://files.test/a/original" />);
    made[0].src = "https://files.test/a/original";
    made[0].dispatchEvent(new Event("error"));

    const button = play();
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-label")).toBe("Try again");
    const reason = document.getElementById(
      button.getAttribute("aria-describedby")!,
    );
    expect(reason?.textContent).toContain("could not be played");
    // a description only: nothing is announced for a clip nobody tapped
    expect(reason?.getAttribute("role")).toBeNull();
    vi.advanceTimersByTime(100);
    expect(announcer()?.textContent ?? "").toBe("");
    // on screen: the retry arrow, and "Try again" where the time was
    expect(button.querySelector("[data-icon]")?.getAttribute("data-icon")).toBe(
      "arrow-clockwise",
    );
    expect(document.querySelector(".z-voice-time")?.textContent).toBe(
      "Try again",
    );
  });

  it("the video player fails the same way: arrow, Try again, the same sentence", () => {
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(
      () => undefined,
    );
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(
      () => undefined,
    );
    mount(() => (
      <MediaPlayer kind="video" src="https://files.test/v/original" />
    ));
    document.querySelector("video")!.dispatchEvent(new Event("error"));

    const button = document.querySelector<HTMLButtonElement>(
      ".z-media-toolbar button",
    )!;
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-label")).toBe("Try again");
    expect(button.querySelector("[data-icon]")?.getAttribute("data-icon")).toBe(
      "arrow-clockwise",
    );
    const reason = document.getElementById(
      button.getAttribute("aria-describedby")!,
    );
    expect(reason?.getAttribute("role")).toBeNull();
    expect(reason?.textContent).toContain("could not be played");
    expect(document.querySelector(".z-media-time")?.textContent).toBe(
      "Try again",
    );
  });

  it("says the failure aloud once, for the clip the user tapped", async () => {
    mount(() => (
      <>
        <VoiceMessage src="https://files.test/a/original" />
        <VoiceMessage src="https://files.test/b/original" />
      </>
    ));
    made[0].play = () => {
      made[0].dispatchEvent(new Event("error"));
      return Promise.reject(new DOMException("gone", "NotSupportedError"));
    };
    made[0].src = "https://files.test/a/original";
    made[1].src = "https://files.test/b/original";
    play(0).click();
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(100);
    expect(document.querySelectorAll("[data-playback-announcer]")).toHaveLength(
      1,
    );
    expect(announcer()?.getAttribute("aria-live")).toBe("assertive");
    expect(announcer()?.textContent).toContain("could not be played");

    // the other one fails too, untapped: nothing new is said
    announcer()!.textContent = "";
    made[1].dispatchEvent(new Event("error"));
    vi.advanceTimersByTime(100);
    expect(announcer()?.textContent).toBe("");
  });

  it("a ?format=m4a the server refuses ends in Try again, not a broken player", () => {
    mount(() => (
      <VoiceMessage src="https://files.test/a/original?format=m4a" />
    ));
    // 404 or 400 from an older media server: the element fails to load
    made[0].src = "https://files.test/a/original?format=m4a";
    made[0].dispatchEvent(new Event("error"));
    expect(play().getAttribute("aria-label")).toBe("Try again");
    expect(play().disabled).toBe(false);
    expect(
      document.querySelectorAll(".z-voice-wave > span").length,
    ).toBeGreaterThan(0);
  });

  it("a video that starts pauses the voice message", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    });
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(
      () => undefined,
    );
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(
      () => undefined,
    );
    mount(() => (
      <>
        <VoiceMessage src="https://files.test/a/original" />
        <MediaPlayer kind="video" src="https://files.test/v/original" />
      </>
    ));
    play().click();
    await Promise.resolve();
    expect(made[0].paused).toBe(false);

    document.querySelector<HTMLButtonElement>(".z-media-bigplay")!.click();
    await Promise.resolve();
    expect(made[0].paused).toBe(true);
    expect(
      document.querySelector(".z-voice")!.getAttribute("data-playing"),
    ).toBe("false");
  });

  it("the watch moves to a new router's location", async () => {
    const place = (path: string) =>
      createRoot(() => {
        const [pathname, setPathname] = createSignal(path);
        return {
          location: {
            get pathname() {
              return pathname();
            },
          },
          go: setPathname,
        };
      });
    const first = place("/server/S/channel/C1");
    watchAddress(first.location);
    const clip = voiceClip("a.ogg", "metadata", "C1");
    await clip.toggle();
    clip.release();

    // a new router (signed out and in again): the old one is no longer heard
    const second = place("/server/S/channel/C1");
    watchAddress(second.location);
    first.go("/app");
    expect(made[0].paused).toBe(false);
    second.go("/server/S/channel/C2");
    expect(made[0].paused).toBe(true);
    expect(liveClips()).toBe(0);
  });
});
