import { useLingui } from "@lingui/solid/macro";
import { Icon } from "@revolt/ui/icons/Icon";
import {
  createEffect,
  createSignal,
  JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import "./media-player.css";

export function mediaTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const seconds = Math.floor(value);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Shared native media engine with Zrzur controls; no browser overflow menu. */
export function MediaPlayer(props: {
  src?: string;
  kind: "video" | "audio";
  contextMenu?: () => JSX.Element;
}) {
  const { t } = useLingui();
  let volumePopup!: HTMLDivElement;
  let volumeButton!: HTMLButtonElement;
  let volumeRoot!: HTMLDivElement;
  let media!: HTMLMediaElement;
  let root!: HTMLDivElement;
  const [playing, setPlaying] = createSignal(false);
  const [duration, setDuration] = createSignal(0);
  const [current, setCurrent] = createSignal(0);
  const [volume, setVolume] = createSignal(1);
  const [muted, setMuted] = createSignal(false);
  const [fullscreen, setFullscreen] = createSignal(false);
  const [error, setError] = createSignal(false);
  // video: controls fade out while playing and the pointer is still
  const [idle, setIdle] = createSignal(false);
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  function wake() {
    setIdle(false);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => setIdle(true), 2500);
  }
  onCleanup(() => clearTimeout(idleTimer));
  onCleanup(() => {
    if (media) {
      media.pause();
      media.removeAttribute("src");
      media.load();
    }
  });
  const finiteDuration = () => Number.isFinite(duration()) && duration() > 0;
  createEffect(() => {
    void props.src;
    setError(false);
    setPlaying(false);
    setDuration(0);
    setCurrent(0);
  });
  const sync = () => {
    setCurrent(media.currentTime);
    setDuration(media.duration);
  };
  async function togglePlay() {
    if (!media.paused) {
      media.pause();
      return;
    }
    try {
      await media.play();
    } catch (failure) {
      if (!(failure instanceof DOMException && failure.name === "AbortError"))
        setError(true);
    }
  }
  function seek(value: number) {
    if (finiteDuration()) {
      media.currentTime = Math.min(duration(), Math.max(0, value));
      setCurrent(media.currentTime);
    }
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === root) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch {
      /* Playback remains usable when the host denies fullscreen. */
    }
  }
  function volumeChanged() {
    setVolume(media.volume);
    setMuted(media.muted);
  }
  onMount(() => {
    const update = () => setFullscreen(document.fullscreenElement === root);
    document.addEventListener("fullscreenchange", update);
    document.addEventListener("scroll", hideVolume, true);
    window.addEventListener("resize", hideVolume);
    onCleanup(() => {
      document.removeEventListener("scroll", hideVolume, true);
      window.removeEventListener("resize", hideVolume);
    });
    onCleanup(() => document.removeEventListener("fullscreenchange", update));
  });
  function hideVolume() {
    if (volumePopup?.matches(":popover-open")) volumePopup.hidePopover();
  }
  function showVolume() {
    if (props.kind !== "audio" || !volumePopup) return;
    const r = volumeButton.getBoundingClientRect();
    volumePopup.style.left = `${Math.max(8, Math.min(innerWidth - 36, r.left + r.width / 2 - 14))}px`;
    volumePopup.style.top = `${r.top >= 94 ? r.top - 86 : r.bottom}px`;
    if (!volumePopup.matches(":popover-open")) volumePopup.showPopover();
  }
  function VolumeInput() {
    return (
      <input
        type="range"
        min={0}
        max={1}
        step="0.01"
        value={muted() ? 0 : volume()}
        aria-label={t`Volume`}
        aria-orientation="vertical"
        onInput={(event) => {
          media.volume = Number(event.currentTarget.value);
          media.muted = false;
        }}
      />
    );
  }
  return (
    <div
      ref={root}
      class={`z-media-player z-media-player--${props.kind}`}
      data-playing={playing()}
      data-idle={playing() && idle()}
      onPointerMove={wake}
      onPointerLeave={() => playing() && setIdle(true)}
      onFocusIn={wake}
      role="region"
      aria-label={props.kind === "video" ? t`Video player` : t`Audio player`}
      tabIndex={0}
      use:floating={{ contextMenu: props.contextMenu }}
      onKeyDown={(event) => {
        if (event.target !== root) return;
        if ([" ", "k", "ArrowLeft", "ArrowRight", "m", "f"].includes(event.key))
          event.preventDefault();
        if (event.key === " " || event.key === "k") void togglePlay();
        if (event.key === "ArrowLeft") seek(media.currentTime - 5);
        if (event.key === "ArrowRight") seek(media.currentTime + 5);
        if (event.key === "m") media.muted = !media.muted;
        if (event.key === "f" && props.kind === "video")
          void toggleFullscreen();
      }}
    >
      <Dynamic
        component={props.kind}
        ref={(element: HTMLMediaElement) => {
          media = element;
        }}
        src={props.src}
        playsinline
        preload="metadata"
        controls={false}
        onPlay={() => {
          setPlaying(true);
          wake();
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={sync}
        onDurationChange={sync}
        onLoadedMetadata={sync}
        onVolumeChange={volumeChanged}
        onError={() => {
          setPlaying(false);
          setError(true);
        }}
        onClick={() => {
          if (props.kind === "video") void togglePlay();
        }}
      />
      <Show when={props.kind === "video" && !playing() && !error()}>
        <button
          type="button"
          class="z-media-bigplay"
          aria-label={t`Play`}
          onClick={() => void togglePlay()}
        >
          <Icon name="play" size={26} filled />
        </button>
      </Show>
      <Show when={error()}>
        <div
          class="z-media-error"
          role="alert"
        >{t`Couldn't play this media.`}</div>
      </Show>
      <div class="z-media-controls">
        <input
          class="z-media-seek"
          type="range"
          min={0}
          max={finiteDuration() ? duration() : 1}
          step="0.1"
          value={current()}
          disabled={!finiteDuration()}
          aria-label={t`Playback position`}
          aria-valuetext={`${mediaTime(current())} / ${mediaTime(duration())}`}
          style={{
            "--media-progress": `${finiteDuration() ? (current() / duration()) * 100 : 0}%`,
          }}
          onInput={(event) => seek(Number(event.currentTarget.value))}
        />
        <div class="z-media-toolbar">
          <button
            type="button"
            aria-label={playing() ? t`Pause` : t`Play`}
            disabled={error()}
            onClick={() => void togglePlay()}
          >
            <Icon name={playing() ? "pause" : "play"} size={18} filled />
          </button>
          <span class="z-media-time">
            {mediaTime(current())}
            <span> / {mediaTime(duration())}</span>
          </span>
          <div
            class="z-media-volume"
            ref={volumeRoot}
            onMouseEnter={showVolume}
            onMouseLeave={() => {
              if (!volumeRoot.querySelector(":focus-visible")) hideVolume();
            }}
            onFocusIn={showVolume}
            onFocusOut={() =>
              queueMicrotask(() => {
                if (
                  !volumeRoot.matches(":hover") &&
                  !volumeRoot.contains(document.activeElement)
                )
                  hideVolume();
              })
            }
          >
            <button
              type="button"
              aria-label={muted() || volume() === 0 ? t`Unmute` : t`Mute`}
              ref={volumeButton}
              aria-pressed={muted()}
              onClick={() => {
                media.muted = !media.muted;
              }}
            >
              <Icon
                name={
                  muted() || volume() === 0 ? "speaker-slash" : "speaker-high"
                }
                size={18}
              />
            </button>
            <Show when={props.kind === "audio"} fallback={<VolumeInput />}>
              <div
                ref={volumePopup}
                class="z-audio-volume-popup"
                popover="manual"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    volumeButton.focus();
                    hideVolume();
                  }
                }}
              >
                <VolumeInput />
              </div>
            </Show>
          </div>
          <Show when={props.kind === "video"}>
            <button
              type="button"
              aria-label={fullscreen() ? t`Exit fullscreen` : t`Fullscreen`}
              onClick={() => void toggleFullscreen()}
            >
              <Icon
                name={fullscreen() ? "arrows-in" : "arrows-out"}
                size={18}
              />
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
