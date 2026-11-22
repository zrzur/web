import { useLingui } from "@lingui/solid/macro";
import { mediaPreload, saveData } from "@revolt/common/lib/saveData";
import { useLocation } from "@revolt/routing";
import { Icon } from "@revolt/ui/icons/Icon";
import {
  For,
  JSX,
  Show,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  onCleanup,
  untrack,
} from "solid-js";

import { mediaTime } from "./MediaPlayer";
import { PlaybackFailure } from "./PlaybackFailure";
import { placeholderBars, readVoice } from "./voice";
import "./voice.css";
import { voiceClip, watchAddress } from "./voicePlayback";

/**
 * Compact voice note: play button, waveform that fills as it plays (click
 * or drag across it to seek) and the time.
 *
 * The sound itself lives in voicePlayback.ts, not in this row: the message
 * list draws a row again for many harmless reasons, and that must never stop
 * a voice message part-way. Starting one pauses the one that played.
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
  /** the conversation of the message: leaving it stops the sound at once */
  channelId?: string;
  contextMenu?: () => JSX.Element;
}) {
  const { t } = useLingui();
  const failureId = createUniqueId();
  // one shared player per file, picked up again when the row is drawn again
  const clip = createMemo(() => {
    const src = props.src;
    const shared = voiceClip(
      src,
      untrack(() => mediaPreload(saveData())),
      untrack(() => props.channelId),
    );
    // the row shows another file now: the old one stops. A row only drawn
    // again or scrolled away keeps a playing clip; leaving the channel stops
    // it (watchAddress)
    onCleanup(() => shared.release({ left: untrack(() => props.src) !== src }));
    return shared;
  });
  // one watcher for the whole app: leaving a conversation stops its sound
  try {
    const location = useLocation();
    watchAddress(() => location.pathname);
  } catch {
    // outside the app's router (tests): nothing to follow
  }
  const playing = () => clip().playing();
  const current = () => clip().current();
  const mediaDuration = () => clip().mediaDuration();
  const error = () => clip().error();
  // A signal, not a resource: a pending resource would suspend the channel's
  // <Suspense> and detach (and re-scroll) the whole message list.
  const [voice, setVoice] =
    createSignal<Awaited<ReturnType<typeof readVoice>>>();
  createEffect(() => {
    // the real waveform needs the whole file: not while saving data
    const src = props.decode === false || saveData() ? undefined : props.src;
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

  const toggle = () => clip().toggle();

  function seekTo(event: PointerEvent, element: HTMLElement) {
    if (!duration()) return;
    const box = element.getBoundingClientRect();
    const rtl = getComputedStyle(element).direction === "rtl";
    const ratio = (event.clientX - box.left) / box.width;
    clip().seek(Math.min(1, Math.max(0, rtl ? 1 - ratio : ratio)) * duration());
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
          clip().seek(
            Math.min(duration(), Math.max(0, current() + (rtl ? -step : step))),
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
      data-failed={error()}
      role="group"
      aria-label={props.title ?? t`Voice message`}
      // the waveform is dragged sideways to seek: never a pull to reply
      data-no-swipe
      use:floating={{ contextMenu: props.contextMenu }}
    >
      <button
        type="button"
        class="z-voice-play"
        aria-label={error() ? t`Try again` : playing() ? t`Pause` : t`Play`}
        // after a failed load a tap tries again
        aria-describedby={error() ? failureId : undefined}
        onClick={() => void toggle()}
      >
        <Icon
          name={error() ? "arrow-clockwise" : playing() ? "pause" : "play"}
          size={16}
          filled={!error()}
        />
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
          ? t`Try again`
          : mediaTime(playing() || current() ? current() : duration())}
      </span>
      <Show when={error()}>
        <PlaybackFailure id={failureId} />
      </Show>
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
