import { useLingui } from "@lingui/solid/macro";
import { Icon } from "@revolt/ui/icons/Icon";
import {
  For,
  JSX,
  Show,
  createEffect,
  createSignal,
  onCleanup,
} from "solid-js";

import { mediaTime } from "./MediaPlayer";
import { placeholderBars, readVoice } from "./voice";
import "./voice.css";

/**
 * Compact voice note: play button, waveform that fills as it plays (click
 * or drag across it to seek) and the time.
 */
export function VoiceMessage(props: {
  src: string;
  /** music / audio file: its name, shown above the waveform */
  title?: string;
  /** e.g. the file size */
  detail?: string;
  download?: string;
  /** read the whole file for a real waveform (skip for very large files) */
  decode?: boolean;
  contextMenu?: () => JSX.Element;
}) {
  const { t } = useLingui();
  let audio!: HTMLAudioElement;
  const [playing, setPlaying] = createSignal(false);
  const [current, setCurrent] = createSignal(0);
  const [mediaDuration, setMediaDuration] = createSignal(0);
  const [error, setError] = createSignal(false);
  // A signal, not a resource: a pending resource would suspend the channel's
  // <Suspense> and detach (and re-scroll) the whole message list.
  const [voice, setVoice] =
    createSignal<Awaited<ReturnType<typeof readVoice>>>();
  createEffect(() => {
    const src = props.decode === false ? undefined : props.src;
    setVoice(undefined);
    if (!src) return;
    let current = true;
    onCleanup(() => (current = false));
    readVoice(src)
      .then((value) => current && setVoice(value))
      .catch(() => undefined);
  });

  const duration = () => {
    const known = voice()?.duration;
    if (known && Number.isFinite(known)) return known;
    const value = mediaDuration();
    return Number.isFinite(value) && value > 0 ? value : 0;
  };
  const progress = () => (duration() ? Math.min(1, current() / duration()) : 0);
  const bars = () => voice()?.bars ?? placeholderBars(props.src);

  onCleanup(() => {
    audio?.pause();
  });

  async function toggle() {
    if (!audio.paused) return audio.pause();
    try {
      await audio.play();
    } catch (failure) {
      if (!(failure instanceof DOMException && failure.name === "AbortError"))
        setError(true);
    }
  }

  function seekTo(event: PointerEvent, element: HTMLElement) {
    if (!duration()) return;
    const box = element.getBoundingClientRect();
    const rtl = getComputedStyle(element).direction === "rtl";
    const ratio = (event.clientX - box.left) / box.width;
    audio.currentTime =
      Math.min(1, Math.max(0, rtl ? 1 - ratio : ratio)) * duration();
    setCurrent(audio.currentTime);
  }

  const wave = (
    <div
      class="z-voice-wave"
      role="slider"
      tabIndex={0}
      aria-label={t`Playback position`}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration())}
      aria-valuenow={Math.round(current())}
      aria-valuetext={`${mediaTime(current())} / ${mediaTime(duration())}`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        seekTo(event, event.currentTarget);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          seekTo(event, event.currentTarget);
      }}
      onKeyDown={(event) => {
        const step =
          event.key === "ArrowRight" ? 5 : event.key === "ArrowLeft" ? -5 : 0;
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          void toggle();
        } else if (step && duration()) {
          event.preventDefault();
          const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
          audio.currentTime = Math.min(
            duration(),
            Math.max(0, audio.currentTime + (rtl ? -step : step)),
          );
        }
      }}
    >
      <For each={bars()}>
        {(height, index) => (
          <span
            data-played={(index() + 0.5) / bars().length <= progress()}
            style={{ height: `${Math.round(height * 100)}%` }}
          />
        )}
      </For>
    </div>
  );

  return (
    <div
      class="z-voice"
      data-kind={props.title ? "track" : "voice"}
      data-playing={playing()}
      role="group"
      aria-label={props.title ?? t`Voice message`}
      use:floating={{ contextMenu: props.contextMenu }}
    >
      <audio
        ref={audio}
        src={props.src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onTimeUpdate={() => setCurrent(audio.currentTime)}
        onLoadedMetadata={() => setMediaDuration(audio.duration)}
        onDurationChange={() => setMediaDuration(audio.duration)}
        onError={() => setError(true)}
      />
      <button
        type="button"
        class="z-voice-play"
        aria-label={playing() ? t`Pause` : t`Play`}
        disabled={error()}
        onClick={() => void toggle()}
      >
        <Icon name={playing() ? "pause" : "play"} size={16} filled />
      </button>
      <Show when={props.title} fallback={wave}>
        <div class="z-voice-main">
          <div class="z-voice-title">
            <strong dir="auto" title={props.title}>
              {props.title}
            </strong>
            <Show when={props.detail}>
              <span>{props.detail}</span>
            </Show>
          </div>
          {wave}
        </div>
      </Show>
      <span class="z-voice-time">
        {error()
          ? t`Unavailable`
          : mediaTime(playing() || current() ? current() : duration())}
      </span>
      <Show when={props.download}>
        <a
          class="z-voice-download"
          href={props.download}
          download={props.title ?? ""}
          target="_blank"
          rel="noreferrer"
          aria-label={t`Download`}
          title={t`Download`}
        >
          <Icon name="download-simple" size={18} />
        </a>
      </Show>
    </div>
  );
}
