import { createMemo, createSignal } from "solid-js";

import { useLingui } from "@lingui/solid/macro";

/** Translated text of the generated reference */
export interface Reference {
  events?: Record<string, string>;
  clientMessages?: Record<string, string>;
  permissions?: Record<string, string>;
  errors?: Record<string, string[]>;
}

// one chunk per language, loaded when a page opens in it
const LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  ar: () => import("../data/reference.ar.json"),
  de: () => import("../data/reference.de.json"),
};

const [texts, setTexts] = createSignal<Record<string, Reference>>({});

/** Load the reference text of a language (nothing for English) */
export async function loadReference(language: string) {
  const locale = language.slice(0, 2);
  const load = LOADERS[locale];
  if (!load || texts()[locale]) return;
  const module = await load();
  setTexts((all) => ({ ...all, [locale]: module.default as Reference }));
}

/** Reference text of the active language; empty for English */
export function useReference() {
  const { i18n } = useLingui();
  return createMemo<Reference>(() => texts()[i18n().locale.slice(0, 2)] ?? {});
}
