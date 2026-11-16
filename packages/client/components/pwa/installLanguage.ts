/**
 * The app's name on a home screen follows the app's language: the page links
 * the manifest of that language (scripts/webManifest.mjs writes one for
 * Arabic) and sets the name iOS uses. The browser reads both when the person
 * installs. In the first download (the language provider calls it): small.
 */

/** Languages that have their own manifest file */
const MANIFEST_LOCALES = ["ar"];

/** Address of the manifest for a language of the app */
export function manifestHref(base: string, locale: string | undefined) {
  const short = locale?.toLowerCase().split("-")[0];
  return short && MANIFEST_LOCALES.includes(short)
    ? `${base}manifest.${short}.webmanifest`
    : `${base}manifest.webmanifest`;
}

/** The app's name on a home screen */
export function appTitle(locale: string | undefined) {
  return locale?.toLowerCase().startsWith("ar")
    ? "\u0632\u0631\u0632\u0648\u0631"
    : "Zrzur";
}

export function setInstallLanguage(
  locale: string | undefined,
  doc: Document = document,
  base: string = import.meta.env.BASE_URL,
) {
  const link = doc.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const href = manifestHref(base, locale);
  if (link && link.getAttribute("href") !== href)
    link.setAttribute("href", href);

  doc
    .querySelector('meta[name="apple-mobile-web-app-title"]')
    ?.setAttribute("content", appTitle(locale));

  // the service worker writes its "no connection" page in this language
  if (locale)
    navigator.serviceWorker?.ready
      .then((registration) =>
        registration.active?.postMessage({ type: "LANGUAGE", locale }),
      )
      .catch(() => {});
}
