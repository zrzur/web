// Kept small on purpose: the first code to run (src/index.tsx) starts the
// catalog download from here, at the same time as the app's own code,
// instead of after it.
import { type Messages, i18n } from "@lingui/core";

import { Language, Languages } from "./Languages";

const downloads = new Map<string, Promise<Messages>>();

/** Small catalogs of the Discover and Designs sites, by catalog code */
let siteCatalogs: Record<string, string> | undefined;

/**
 * On the Discover and Designs sites: show a language's small file (only
 * the messages those pages use, scripts/siteCatalogs.mjs) and add the full
 * file as soon as it has arrived
 */
export function preferSiteCatalogs(urls: Record<string, string>) {
  siteCatalogs = urls;
}

/** The full catalog file of a language */
function importFullCatalog(code: string) {
  // explicit .ts: `lingui compile` (CommonJS by default) rewrites
  // messages.js, which Vite can't import as `{ messages }` (white screen);
  // the .ts twin is always an ES module
  return import(`./catalogs/${code}/messages.ts`).then(
    (module) => module.messages as Messages,
  );
}

let fullCatalog = importFullCatalog;

/** Tests only: replace how the full file loads (no argument: the real one) */
export function setFullCatalogLoader(
  loader: (code: string) => Promise<Messages> = importFullCatalog,
) {
  fullCatalog = loader;
}

/** Languages whose full file failed after their small one was shown */
const fullMissing = new Map<string, Language>();

/** Add the full file of a language that shows its small one */
function completeCatalog(key: Language, code: string) {
  fullMissing.delete(code);
  fullCatalog(code)
    .then((full) => i18n.load(key, full))
    // keep the small file and try again on the next ask or when online
    .catch(() => fullMissing.set(code, key));
}

if (typeof window !== "undefined")
  window.addEventListener("online", () => {
    for (const [code, key] of [...fullMissing]) completeCatalog(key, code);
  });

/** The small file of a site, then the full file added in the background */
async function siteCatalog(key: Language, code: string, url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`site catalog ${response.status}`);
  const messages = (await response.json()) as Messages;
  // after the page's own files and pictures have had their turn, at most
  // a second later
  const later = (fn: () => void) =>
    typeof requestIdleCallback === "function"
      ? requestIdleCallback(fn, { timeout: 1000 })
      : setTimeout(fn, 200);
  later(() => completeCatalog(key, code));
  return messages;
}

/**
 * The message catalog of a language. Every caller asking for the same
 * language shares one download; a failed one is forgotten, so the next ask
 * tries again.
 */
export function importCatalog(key: Language): Promise<Messages> {
  const code = Languages[key]?.i18n;
  if (!code) return Promise.reject(new Error(`no catalog for ${key}`));
  if (fullMissing.has(code)) completeCatalog(key, code);
  let download = downloads.get(code);
  if (!download) {
    const site = siteCatalogs?.[code];
    download = site
      ? siteCatalog(key, code, site).catch(() => fullCatalog(code))
      : fullCatalog(code);
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
