import { type JSX, Show, createSignal } from "solid-js";

import { i18n } from "@lingui/core";
import { I18nProvider as LinguiProvider } from "@lingui/solid";

import { browserPreferredLanguage, importCatalog } from "./catalog";
import { initTime, loadTimeLocale } from "./dayjs";
import { updateDurationLocale } from "./durations";
import { type LocaleOptions, Language, Languages } from "./Languages";

export function I18nProvider(props: { children: JSX.Element }) {
  const [ready, setReady] = createSignal(false);

  // Only the device language's catalog is loaded (not English as well):
  // production builds keep no English source text, so nothing renders
  // until it has arrived. The saved choice only loads with the state, which
  // waits for the server; the locale store applies it once it hydrates.
  loadAndSwitchLocale(browserPreferredLanguage() as Language, {})
    .catch(() => loadAndSwitchLocale(Language.ENGLISH, {}))
    // the time locale needs an active language (its calendar strings are
    // translated); loading one sets it, this is the last fallback
    .catch(() => initTime())
    .finally(() => setReady(true));

  return (
    <LinguiProvider i18n={i18n}>
      <Show when={ready()}>{props.children}</Show>
    </LinguiProvider>
  );
}

export { browserPreferredLanguage } from "./catalog";
export { timeLocale, useTime } from "./dayjs";
export { translatedError, useError } from "./errors";
export { Language, Languages } from "./Languages";

/** Each switch gets a number; a slower, older one never wins the race */
let latestSwitch = 0;

export async function loadAndSwitchLocale(
  key: Language,
  localeOptions: LocaleOptions,
) {
  const mine = ++latestSwitch;
  if (key !== i18n.locale) {
    const data = await importCatalog(key);
    // e.g. the saved language still loading when a link asked for another
    if (mine !== latestSwitch) return;

    i18n.load({
      [key]: data,
    });

    i18n.activate(key);

    loadTimeLocale(Languages[key], localeOptions);

    // durations ("10 minutes") in the chosen language, not always English
    updateDurationLocale(key);
  }

  applyDocumentDirection(key, localeOptions);
}

/**
 * Reflect the active language on <html>: `lang` for fonts, hyphenation and
 * screen readers, `dir` so right-to-left languages lay out right-to-left
 * (the language's own `rtl` flag, unless the user overrode it)
 * @param key Language
 * @param localeOptions User locale options
 */
function applyDocumentDirection(key: Language, localeOptions: LocaleOptions) {
  const rtl = localeOptions.rtl ?? Languages[key].localeOptions?.rtl ?? false;
  const root = document.documentElement;
  root.lang = key;
  root.dir = rtl ? "rtl" : "ltr";
}
