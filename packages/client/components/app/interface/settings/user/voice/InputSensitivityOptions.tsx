import {
  Accessor,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  untrack,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { audioCaptureFor } from "@revolt/rtc/audioQuality";
import { callInputLevel } from "@revolt/rtc/inputLevel";
import {
  GATE_HOLD_MS,
  SILENCE_DB,
  THRESHOLD_MAX_DB,
  THRESHOLD_MIN_DB,
  gateStep,
  initialGateState,
  levelDb,
  thresholdPercent,
} from "@revolt/rtc/voiceGate";
import { useState } from "@revolt/state";
import { SettingsRow, SettingsSection, Slider, Toggle } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

/** One reading of the meter */
interface Reading {
  level: number;
  open: boolean;
}

/**
 * Input sensitivity (voice activity only): automatic, or a threshold set
 * on a live level meter. Below the threshold the call carries silence.
 */
export function InputSensitivityOptions() {
  const { voice } = useState();
  const { t } = useLingui();
  const manual = () => !voice.inputSensitivityAuto;
  const toggle = () =>
    (voice.inputSensitivityAuto = !voice.inputSensitivityAuto);

  // the call's own measurement while in a call; otherwise a short test of
  // the microphone, only while the slider is shown
  const local = useLocalMicLevel(
    () => manual() && !callInputLevel(),
    // the same capture a call would use (device, processing, music mode)
    () => audioCaptureFor(voice, voice.highQualityAudio),
    () => voice.inputThreshold,
    () => voice.inputVolume,
  );
  const reading = () => callInputLevel() ?? local.reading();

  return (
    <SettingsSection
      title={<Trans>Input sensitivity</Trans>}
      description={<Trans>Below the threshold, others hear silence.</Trans>}
    >
      <SettingsRow
        icon={<Icon name="sparkle" size={20} />}
        title={<Trans>Automatic</Trans>}
        description={t`Zrzur finds the right level for your room.`}
        onClick={toggle}
        control={(ids) => (
          <Toggle
            checked={voice.inputSensitivityAuto}
            onChange={toggle}
            aria-labelledby={ids.labelId}
            aria-describedby={ids.descriptionId}
          />
        )}
      />
      <Show when={manual()}>
        <SettingsRow
          icon={<Icon name="waveform" size={20} />}
          title={<Trans>Threshold</Trans>}
          description={
            local.failed() && !callInputLevel()
              ? t`Allow microphone access to see your level.`
              : t`Speak and watch the bar: green means others hear you.`
          }
          control={() => (
            <SensitivityMeter
              threshold={voice.inputThreshold}
              reading={reading()}
              label={t`Input sensitivity threshold`}
              onThreshold={(value) => (voice.inputThreshold = value)}
            />
          )}
        />
      </Show>
    </SettingsSection>
  );
}

/**
 * The level bar with the threshold marked on it, and the slider that moves
 * the threshold, both on the same scale
 */
export function SensitivityMeter(props: {
  threshold: number;
  reading?: Reading;
  label: string;
  onThreshold: (value: number) => void;
}) {
  const { t } = useLingui();
  const open = () => props.reading?.open ?? false;

  return (
    <MeterWidth>
      <Meter aria-hidden="true" data-testid="sensitivity-meter">
        <MeterTrack>
          <MeterFill
            data-open={open()}
            data-testid="sensitivity-level"
            style={{
              "--z-meter-pct": `${thresholdPercent(props.reading?.level ?? SILENCE_DB)}%`,
            }}
          />
          <MeterMark
            data-testid="sensitivity-mark"
            style={{
              "--z-meter-pos": `${thresholdPercent(props.threshold) / 100}`,
            }}
          />
        </MeterTrack>
      </Meter>
      <Slider
        aria-label={props.label}
        min={THRESHOLD_MIN_DB}
        max={THRESHOLD_MAX_DB}
        step={1}
        value={props.threshold}
        onInput={(event) => props.onThreshold(event.currentTarget.value)}
        // isolated, so "-50 dB" never turns into "dB 50-" in Arabic
        labelFormatter={(value) => `⁨${t`${value} dB`}⁩`}
      />
      <Status data-open={open()} data-testid="sensitivity-status">
        <Dot data-open={open()} aria-hidden="true" />
        {open() ? t`Others hear you` : t`Silence is sent`}
      </Status>
    </MeterWidth>
  );
}

/**
 * Microphone level outside a call: the chosen device, the input volume and
 * the same gate the call uses, so the meter shows what a call would send
 */
function useLocalMicLevel(
  active: Accessor<boolean>,
  capture: Accessor<ReturnType<typeof audioCaptureFor>>,
  threshold: Accessor<number>,
  volume: Accessor<number>,
) {
  const [reading, setReading] = createSignal<Reading>();
  const [failed, setFailed] = createSignal(false);

  createEffect(() => {
    if (!active()) {
      setReading(undefined);
      return;
    }
    const {
      deviceId,
      echoCancellation,
      noiseSuppression,
      autoGainControl,
      channelCount,
    } = capture();
    let stopped = false;
    let frame = 0;
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;

    const stop = () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close().catch(() => undefined);
    };
    onCleanup(stop);

    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      setFailed(true);
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        audio: {
          // a plain id is a preference: another microphone still works
          deviceId,
          echoCancellation,
          noiseSuppression,
          autoGainControl,
          channelCount,
        },
      })
      .then((media) => {
        stream = media;
        if (stopped) return stop();
        setFailed(false);
        context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(media).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);

        let state = initialGateState();
        let last = performance.now();
        let peak = SILENCE_DB;
        let sinceReport = 0;
        const tick = (now: number) => {
          if (stopped) return;
          const dt = Math.max(0, now - last);
          last = now;
          analyser.getFloatTimeDomainData(samples);
          const gain = untrack(volume);
          const level = Math.max(
            SILENCE_DB,
            levelDb(samples) + 20 * Math.log10(Math.max(gain, 1e-5)),
          );
          state = gateStep(state, level, now, dt, {
            enabled: true,
            auto: false,
            thresholdDb: untrack(threshold),
            holdMs: GATE_HOLD_MS,
          });
          peak = Math.max(peak, level);
          sinceReport += dt;
          if (sinceReport >= 50) {
            setReading({ level: peak, open: state.open });
            peak = SILENCE_DB;
            sinceReport = 0;
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (!stopped) setFailed(true);
      });
  });

  return { reading, failed };
}

const MeterWidth = styled("div", {
  base: {
    width: "min(300px, 100%)",
    minWidth: "200px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
});

/**
 * Same width as the slider's range (the slider keeps 52 px at the end for
 * its value), so the mark sits right above the knob
 */
const Meter = styled("div", {
  base: {
    paddingInlineEnd: "52px",
  },
});

const MeterTrack = styled("div", {
  base: {
    position: "relative",
    height: "8px",
    borderRadius: "999px",
    background: "var(--z-slate-2)",
    overflow: "hidden",
  },
});

const MeterFill = styled("div", {
  base: {
    position: "absolute",
    insetBlock: 0,
    insetInlineStart: 0,
    width: "var(--z-meter-pct)",
    borderRadius: "999px",
    background: "var(--z-fg-muted)",
    transition: "width 60ms linear",
    _motionReduce: { transition: "none" },
    "&[data-open='true']": {
      background: "var(--z-status-success)",
    },
  },
});

/** The threshold: a line where the knob's centre is (9 px in from each end) */
const MeterMark = styled("div", {
  base: {
    position: "absolute",
    insetBlock: 0,
    insetInlineStart: "calc(9px + (100% - 18px) * var(--z-meter-pos))",
    width: "2px",
    marginInlineStart: "-1px",
    background: "var(--z-fg-primary)",
  },
});

const Status = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-secondary)",
  },
});

/** Filled dot while sending, an empty ring while silent (not colour alone) */
const Dot = styled("span", {
  base: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
    border: "2px solid var(--z-fg-muted)",
    "&[data-open='true']": {
      borderColor: "var(--z-status-success)",
      background: "var(--z-status-success)",
    },
  },
});
