/**
 * The listener's soundboard choices (mute, volume), on this device. Kept
 * here, read only by the voice screens and the voice settings, so they are
 * not in the app's first download.
 */
import { createRoot, createSignal } from "solid-js";

const KEY = "zrzur:soundboard";

export type SoundboardChoices = { muted: boolean; volume: number };

/** Saved choices, with anything unreadable replaced by the default */
export function cleanChoices(input: unknown): SoundboardChoices {
  const saved = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;
  return {
    muted: saved.muted === true,
    volume:
      typeof saved.volume === "number" && Number.isFinite(saved.volume)
        ? Math.min(1, Math.max(0, saved.volume))
        : 1,
  };
}

function read(): SoundboardChoices {
  try {
    return cleanChoices(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    return cleanChoices(undefined);
  }
}

const [choices, setChoices] = createRoot(() => createSignal(read()));

/** The current choices */
export const soundboardChoices = choices;

/** Change and keep a choice */
export function setSoundboardChoice(change: Partial<SoundboardChoices>) {
  const next = cleanChoices({ ...choices(), ...change });
  setChoices(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private mode: the choice lasts until the tab closes
  }
}
