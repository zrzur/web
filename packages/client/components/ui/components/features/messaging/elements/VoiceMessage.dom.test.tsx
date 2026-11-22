import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createSignal } from "solid-js";
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
    expect(reason?.textContent).toContain("could not be loaded");
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
});
