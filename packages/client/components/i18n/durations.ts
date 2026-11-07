import { createSignal } from "solid-js";

import { Language } from "./Languages";

const [durationLocale, setDurationLocale] = createSignal<Language>(null!);

export function useDurationFormat() {
  return (
    duration: Partial<Record<Intl.DurationFormatUnit, number>>,
    options: Intl.DurationFormatOptions = { style: "long" },
    // eslint-disable-next-line solid/reactivity
  ) => new Intl.DurationFormat(durationLocale(), options).format(duration);
}

export function updateDurationLocale(key: Language) {
  // Intl throws on tags it can't read; English then, instead of breaking pages
  let supported = false;
  try {
    supported = Intl.DurationFormat.supportedLocalesOf(key).length > 0;
  } catch {
    /* invalid tag */
  }
  setDurationLocale(supported ? key : Language.ENGLISH);
}
