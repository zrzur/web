import { createSignal } from "solid-js";

/** What the call's input gate measured last (about every 50 ms) */
export interface InputLevel {
  /** Loudest block in dBFS, after the input volume */
  level: number;
  /** Whether the gate let sound through */
  open: boolean;
}

const [callInputLevel, setCallInputLevel] = createSignal<InputLevel>();

/**
 * Level of the microphone in the current call (undefined outside a call, or
 * where the browser cannot run the gate); the settings meter shows it
 */
export { callInputLevel, setCallInputLevel };
