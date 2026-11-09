import { AudioProcessorOptions, Track, TrackProcessor } from "livekit-client";
import { RNNoiseNode } from "livekit-rnnoise-processor";
import { createEffect, createRoot, on } from "solid-js";

import { CONFIGURATION } from "@revolt/common";
import { Voice } from "@revolt/state/stores/Voice";

import { setCallInputLevel } from "./inputLevel";
import {
  type GateConfig,
  GATE_HOLD_MS,
  VOICE_GATE_WORKLET,
  voiceGateWorkletSource,
} from "./voiceGate";

/** Audio contexts that already have the gate worklet */
const gateLoaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/**
 * Load the input gate into an audio context. False when the browser has no
 * audio worklets or refuses the module: the call then runs without a gate.
 */
function loadGate(context: BaseAudioContext): Promise<boolean> {
  let loading = gateLoaded.get(context);
  if (!loading) {
    loading = (async () => {
      if (!context.audioWorklet || typeof AudioWorkletNode === "undefined")
        return false;
      const url = URL.createObjectURL(
        new Blob([voiceGateWorkletSource()], {
          type: "application/javascript",
        }),
      );
      try {
        await context.audioWorklet.addModule(url);
        return true;
      } catch (error) {
        console.warn("[rtc] input sensitivity unavailable", error);
        return false;
      } finally {
        URL.revokeObjectURL(url);
      }
    })();
    gateLoaded.set(context, loading);
  }
  return loading;
}

export class VoiceProcessor implements TrackProcessor<
  Track.Kind.Audio,
  AudioProcessorOptions
> {
  readonly name = "stoat-voice-processor";
  processedTrack?: MediaStreamTrack;

  private audioContext?: AudioContext;
  private settings: Voice;

  private noiseSuppressionNode?: RNNoiseNode;
  private sourceNode?: MediaStreamAudioSourceNode;
  private highpassNode?: BiquadFilterNode;
  private compressorNode?: DynamicsCompressorNode;
  private gainNode?: GainNode;
  private gateNode?: AudioWorkletNode;
  private gateReady = false;
  private destinationNode?: MediaStreamAudioDestinationNode;

  private disposeSolidjsContext: () => void = () => {};

  constructor(voiceSettings: Voice) {
    this.settings = voiceSettings;

    // Create a solid root to track changes to the settings
    createRoot((dispose) => {
      // On input volume setting change, set the gain
      createEffect(() => {
        this.setGain(this.getSettings().inputVolume);
      });

      // On noise suppression setting change, toggle noise suppression
      createEffect(
        on(
          () => this.getSettings().noiseSupression,
          (newNoiseSuppresion, oldNoiseSuppression) => {
            // Only rebuild if noise supression has changed from enhanced to something else or vice versa
            if (
              oldNoiseSuppression &&
              oldNoiseSuppression !== newNoiseSuppresion &&
              (newNoiseSuppresion === "enhanced" ||
                oldNoiseSuppression === "enhanced")
            ) {
              this.rebuild();
            }
          },
        ),
      );

      // Input sensitivity: the gate follows the settings during a call
      createEffect(() => {
        const config = this.gateConfig();
        this.gateNode?.port.postMessage(config);
      });

      // This is needed to destroy the solid context on unload
      this.disposeSolidjsContext = dispose;
    });
  }

  private getSettings(): Voice {
    return this.settings;
  }

  /** What the gate should do with the current settings */
  private gateConfig(): GateConfig {
    const settings = this.getSettings();
    return {
      // push to talk: the key decides, the gate stays out of the way
      enabled: settings.inputMode !== "ptt",
      auto: settings.inputSensitivityAuto,
      thresholdDb: settings.inputThreshold,
      holdMs: GATE_HOLD_MS,
    };
  }

  private setGain(newGain: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = newGain;
    }
  }

  private rebuild() {
    // the call may have ended: nothing is wired any more
    if (!this.audioContext || !this.sourceNode || !this.gainNode) return;
    this.updateNoiseSuppression(this.audioContext);
  }

  async init(opts: AudioProcessorOptions): Promise<void> {
    const [gateReady] = await Promise.all([
      opts.audioContext ? loadGate(opts.audioContext) : false,
      RNNoiseNode.loadModule(
        opts.audioContext,
        CONFIGURATION.RNNOISE_WORKLET_CDN_URL,
      ),
    ]);
    this.gateReady = gateReady;
    return this.build(opts);
  }

  async restart(opts: AudioProcessorOptions): Promise<void> {
    return this.build(opts);
  }

  async destroy(): Promise<void> {
    // Destroy the solid context on processor destruction
    this.disposeSolidjsContext();
    this.audioContext = undefined;
    return this.teardown();
  }

  private updateNoiseSuppression(context: AudioContext) {
    // always unhook the microphone first: coming from "browser" or
    // "disabled" it is wired straight to the volume, and leaving that link
    // sent the raw microphone next to the filtered one
    this.sourceNode?.disconnect();
    this.compressorNode?.disconnect();
    this.noiseSuppressionNode?.disconnect();
    this.highpassNode?.disconnect();

    if (this.settings.noiseSupression === "enhanced") {
      // Create a new highpass filter
      this.highpassNode = context.createBiquadFilter();
      this.highpassNode.type = "highpass";
      this.highpassNode.frequency.value = 50;
      this.highpassNode.Q.value = Math.SQRT1_2;

      this.noiseSuppressionNode = new RNNoiseNode(this.audioContext!);
      this.highpassNode.connect(this.noiseSuppressionNode);

      // Create a new dynamics compressor
      this.compressorNode = context.createDynamicsCompressor();
      this.compressorNode.threshold.value = -3;
      this.compressorNode.knee.value = 0;
      this.compressorNode.ratio.value = 20;
      this.compressorNode.attack.value = 0.003;
      this.compressorNode.release.value = 0.05;
      this.noiseSuppressionNode.connect(this.compressorNode);

      // Connect the compressor to the output gain
      this.compressorNode.connect(this.gainNode!);
      // Lastly, connect the source to the highpass node to complete loop
      this.sourceNode!.connect(this.highpassNode);
    } else {
      // Bypass noise suppression and remove all unused nodes
      this.compressorNode = undefined;
      this.noiseSuppressionNode = undefined;
      this.highpassNode = undefined;
      this.sourceNode!.connect(this.gainNode!);
    }
  }

  private async build(opts: AudioProcessorOptions): Promise<void> {
    await this.teardown();
    // If context was passed, store it for restarts
    // If no context was passed, this was a restart so use the old context
    let context = opts.audioContext;
    if (!context) {
      context = this.audioContext!;
    } else {
      this.audioContext = context;
    }
    if (!context) {
      return;
    }
    this.sourceNode = context.createMediaStreamSource(
      new MediaStream([opts.track]),
    );

    // Create the target gain node for input volume
    this.gainNode = context.createGain();
    this.gainNode.gain.value = this.settings.inputVolume;

    this.updateNoiseSuppression(context);

    // Create the destination node, connect the gain node (through the input
    // gate where the browser can run it) and send it off to livekit
    this.destinationNode = context.createMediaStreamDestination();
    this.gateNode = this.createGate(context);
    if (this.gateNode) {
      this.gainNode.connect(this.gateNode);
      this.gateNode.connect(this.destinationNode);
    } else {
      this.gainNode.connect(this.destinationNode);
    }
    this.processedTrack = this.destinationNode.stream.getAudioTracks()[0];
  }

  private createGate(context: AudioContext): AudioWorkletNode | undefined {
    if (!this.gateReady) return undefined;
    try {
      const gate = new AudioWorkletNode(context, VOICE_GATE_WORKLET, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
      });
      gate.port.onmessage = (event) => setCallInputLevel(event.data);
      gate.port.postMessage(this.gateConfig());
      return gate;
    } catch (error) {
      console.warn("[rtc] input sensitivity unavailable", error);
      return undefined;
    }
  }

  private async teardown() {
    this.sourceNode?.disconnect();
    this.highpassNode?.disconnect();
    this.noiseSuppressionNode?.disconnect();
    this.compressorNode?.disconnect();
    this.gainNode?.disconnect();
    this.gateNode?.disconnect();
    if (this.gateNode) this.gateNode.port.onmessage = null;
    this.destinationNode?.disconnect();
    setCallInputLevel(undefined);
    this.gateNode = undefined;
    this.sourceNode = undefined;
    this.highpassNode = undefined;
    this.noiseSuppressionNode = undefined;
    this.compressorNode = undefined;
    this.gainNode = undefined;
    this.destinationNode = undefined;
  }
}
