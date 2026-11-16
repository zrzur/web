import {
  Language,
  Languages,
  browserPreferredLanguage,
  loadAndSwitchLocale,
} from "@revolt/i18n";
import type { LocaleOptions } from "@revolt/i18n/Languages";
import { updateTimeLocaleOptions } from "@revolt/i18n/dayjs";

import { State } from "..";

import { AbstractStore } from ".";

export type TypeLocale = {
  /**
   * Current language in use
   */
  lang: Language;

  /**
   * Options
   */
  options: LocaleOptions;
};

/**
 * The desktop app has words of its own outside the page (its start-up
 * window, the tray menu, the page shown while Zrzur cannot be reached). It
 * shows them in the language saved here, so they match the app; without
 * this it only knows the device's language. A language shown for one visit
 * (`switchForSession`) is not told: the shell keeps what it is told.
 */
function tellDesktopShell(language: Language) {
  try {
    window.desktopConfig?.set({ language });
  } catch {
    // an older desktop app, or no shell at all: the page works without it
  }
}

/**
 * Manage localisation of the application
 */
export class Locale extends AbstractStore<"locale", TypeLocale> {
  /**
   * Construct store
   * @param state State
   */
  constructor(state: State) {
    super(state, "locale");
  }

  /**
   * Hydrate external context
   */
  hydrate(): void {
    const { lang, options } = this.get();
    loadAndSwitchLocale(lang, options);
    tellDesktopShell(lang);
  }

  /**
   * Generate default values
   */
  default(): TypeLocale {
    return {
      lang: browserPreferredLanguage() as Language,
      options: {},
    };
  }

  /**
   * Validate the given data to see if it is compliant and return a compliant object
   */
  clean(input: Partial<TypeLocale>): TypeLocale {
    let lang: Language = input.lang!;
    if (!(lang in Languages)) {
      lang = this.default().lang;
    }

    const options: LocaleOptions = {};
    if (typeof input.options?.dateFormat === "string") {
      options.dateFormat = input.options.dateFormat;
    }

    if (typeof input.options?.timeFormat === "string") {
      options.timeFormat = input.options.timeFormat;
    }

    if (typeof input.options?.rtl === "boolean") {
      options.rtl = input.options.rtl;
    }

    return {
      lang,
      options,
    };
  }

  /**
   * Switch to another language
   * @param language Language
   */
  switch(language: Language): void {
    this.set("lang", language);
    this.hydrate();
  }

  /**
   * Show the app in another language for this visit only. The saved
   * language (and so the account's choice) is not changed; used when a
   * shared link asks for a language (`?hl=`).
   * @param language Language
   */
  switchForSession(language: Language): void {
    void loadAndSwitchLocale(language, this.get().options);
  }

  /**
   * Change date format
   * @param dateFormat Date format
   */
  setDateFormat(dateFormat: string): void {
    this.set("options", "dateFormat", dateFormat);
    updateTimeLocaleOptions({
      dateFormat,
    });
  }

  /**
   * Change time format
   * @param timeFormat Time format
   */
  setTimeFormat(timeFormat: string): void {
    this.set("options", "timeFormat", timeFormat);
    updateTimeLocaleOptions({
      timeFormat,
    });
  }
}
