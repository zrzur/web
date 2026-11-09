// Kept small on purpose: the first code to run (src/index.tsx) starts the
// catalog download from here, at the same time as the app's own code,
// instead of after it.
import type { Messages } from "@lingui/core";

import { Language, Languages } from "./Languages";

const downloads = new Map<string, Promise<Messages>>();

/**
 * The message catalog of a language. Every caller asking for the same
 * language shares one download; a failed one is forgotten, so the next ask
 * tries again.
 */
export function importCatalog(key: Language): Promise<Messages> {
  const code = Languages[key]?.i18n;
  if (!code) return Promise.reject(new Error(`no catalog for ${key}`));
  let download = downloads.get(code);
  if (!download) {
    // explicit .ts: `lingui compile` (CommonJS by default) rewrites
    // messages.js, which Vite can't import as `{ messages }` (white screen);
    // the .ts twin is always an ES module
    download = import(`./catalogs/${code}/messages.ts`).then(
      (module) => module.messages as Messages,
    );
    downloads.set(code, download);
    download.catch(() => downloads.delete(code));
  }
  return download;
}

/**
 * Preferred language as reported by the browser
 * @returns Preferred language
 */
export function browserPreferredLanguage() {
  const languages = Object.keys(Languages).map(
    (x) => [x, Languages[x as keyof typeof Languages]] as const,
  );

  // Get the user's system language. Check for exact
  // matches first, otherwise check for partial matches
  return (
    navigator.languages
      .map((lang) => languages.find((l) => l[0].replace(/_/g, "-") == lang))
      .filter((lang) => lang)[0]?.[0] ??
    navigator.languages
      .map((x) => x.split("-")[0])
      .map((lang) => languages.find((l) => l[0] == lang))
      .filter((lang) => lang)[0]?.[0] ??
    Language.ENGLISH
  );
}
