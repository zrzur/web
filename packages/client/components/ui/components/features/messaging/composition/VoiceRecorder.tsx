import { Trans, useLingui } from "@lingui/solid/macro";
import { Icon } from "@revolt/ui/icons/Icon";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";

import { mediaTime } from "../elements/MediaPlayer";
import {
  MAX_VOICE_SECONDS,
  VOICE_PREFIX,
  WAVEFORM_BARS,
  pickVoiceFormat,
} from "../elements/voice";
import "../elements/voice.css";

/**
 * Recording bar shown above the message box: live level meter, timer,
 * cancel and send. Recording starts as soon as it opens; the microphone is
 * released whenever it closes.
 */
export function VoiceRecorder(props: {
  onSend: (file: File) => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const [levels, setLevels] = createSignal<number[]>(
    Array(WAVEFORM_BARS).fill(0.08),
  );
  const [seconds, setSeconds] = createSignal(0);
  const [state, setState] = createSignal<
    "starting" | "recording" | "limit" | "blocked" | "unsupported"
  >("starting");

  let stream: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  let context: AudioContext | undefined;
  let meter: ReturnType<typeof setInterval> | undefined;
  let startedAt = 0;
  const chunks: Blob[] = [];

  function release() {
    clearInterval(meter);
    stream?.getTracks().forEach((track) => track.stop());
    void context?.close().catch(() => {});
    stream = undefined;
    context = undefined;
  }
  onCleanup(() => {
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    release();
  });

  onMount(async () => {
    const format = pickVoiceFormat();
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setState("blocked");
      return;
    }

    recorder = new MediaRecorder(stream, {
      mimeType: format[0],
      audioBitsPerSecond: 48_000,
    });
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.start(250);
    startedAt = performance.now();
    setState("recording");

    // level meter: one bar every 100 ms, newest on the end
    context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    meter = setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000;
      setSeconds(elapsed);
      if (elapsed >= MAX_VOICE_SECONDS) {
        recorder?.pause();
        clearInterval(meter);
        setState("limit");
        return;
      }
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
      const level = Math.min(
        1,
        Math.max(0.08, Math.sqrt(sum / samples.length) * 4),
      );
      setLevels((previous) => [...previous.slice(1), level]);
    }, 100);
  });

  function send() {
    const active = recorder;
    const format = pickVoiceFormat();
    if (!active || !format || seconds() < 0.5) return props.onClose();
    active.onstop = () => {
      const type = format[0].split(";")[0];
      const blob = new Blob(chunks, { type });
      release();
      props.onSend(
        new File([blob], `${VOICE_PREFIX}-${Date.now()}.${format[1]}`, {
          type,
        }),
      );
    };
    active.stop();
  }

  return (
    <div class="z-recorder" role="group" aria-label={t`Voice message`}>
      <button
        type="button"
        class="z-recorder-cancel"
        aria-label={t`Discard recording`}
        onClick={() => props.onClose()}
      >
        <Icon name="trash" size={18} />
      </button>

      <Show
        when={state() === "recording" || state() === "limit"}
        fallback={
          <span class="z-recorder-note" role="status">
            <Show when={state() === "starting"}>
              <Trans>Starting the microphone…</Trans>
            </Show>
            <Show when={state() === "blocked"}>
              <Trans>
                Microphone access is blocked. Allow it in your browser to
                record.
              </Trans>
            </Show>
            <Show when={state() === "unsupported"}>
              <Trans>This browser can't record voice messages.</Trans>
            </Show>
          </span>
        }
      >
        <span class="z-recorder-dot" data-paused={state() === "limit"} />
        <span class="z-recorder-time" aria-live="off">
          {mediaTime(seconds())}
        </span>
        <div class="z-recorder-wave" aria-hidden="true">
          <For each={levels()}>
            {(level) => (
              <span style={{ height: `${Math.round(level * 100)}%` }} />
            )}
          </For>
        </div>
        <Show when={state() === "limit"}>
          <span class="z-recorder-note">
            <Trans>Limit reached</Trans>
          </span>
        </Show>
      </Show>

      <button
        type="button"
        class="z-recorder-send"
        aria-label={t`Send voice message`}
        disabled={state() !== "recording" && state() !== "limit"}
        onClick={send}
      >
        <Icon name="paper-plane-tilt" size={18} />
      </button>
    </div>
  );
}
