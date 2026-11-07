import { createMemo } from "solid-js";

import { useLingui } from "@lingui/solid/macro";

import arabic from "../data/reference.ar.json";
import german from "../data/reference.de.json";

/** Translated text of the generated reference */
export interface Reference {
  events?: Record<string, string>;
  clientMessages?: Record<string, string>;
  permissions?: Record<string, string>;
  errors?: Record<string, string[]>;
}

const TEXT: Record<string, Reference> = {
  ar: arabic as Reference,
  de: german as Reference,
};

/** Reference text of the active language; empty for English */
export function useReference() {
  const { i18n } = useLingui();
  return createMemo<Reference>(() => TEXT[i18n().locale.slice(0, 2)] ?? {});
}
