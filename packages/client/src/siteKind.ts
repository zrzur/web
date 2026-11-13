// Which site this page is. Small on purpose: the first code to run
// (index.tsx) reads it to choose between the app and the Designs / Discover
// sites before downloading either.
import CONFIGURATION from "@revolt/common/lib/env";

const env = CONFIGURATION;

/** dev only: preview the Designs site on localhost (localStorage flag) */
const DESIGNS_PREVIEW_KEY = "zrzur:designs-site";

/**
 * Whether this page is the standalone Designs site: opened on the host set
 * in VITE_DESIGNS_HOST (e.g. designs.zrzur.com). In development the flag
 * `zrzur:designs-site = "1"` in localStorage previews it on localhost.
 */
export function isDesignsSite() {
  if (env.DESIGNS_HOST && window.location.hostname === env.DESIGNS_HOST)
    return true;
  if (!import.meta.env.DEV) return false;
  try {
    return window.localStorage.getItem(DESIGNS_PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Where Designs pages live: at the root of the standalone site, under
 * /designs inside the app
 */
export function designsBase() {
  return isDesignsSite() ? "" : "/designs";
}

/** dev only: preview the Discover site on localhost (localStorage flag) */
const DISCOVER_PREVIEW_KEY = "zrzur:discover-site";

/**
 * Whether this page is the standalone Discover site: opened on the origin
 * of VITE_DISCOVER_URL (e.g. https://discover.zrzur.com). In development
 * the flag `zrzur:discover-site = "1"` in localStorage previews it on
 * localhost.
 */
export function isDiscoverSite() {
  if (env.DISCOVER_URL) {
    try {
      if (new URL(env.DISCOVER_URL).origin === window.location.origin)
        return true;
    } catch {
      // resolveDiscoverUrl already checked it; nothing to match then
    }
  }
  if (!import.meta.env.DEV) return false;
  try {
    return window.localStorage.getItem(DISCOVER_PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Where Discover pages live: at the root of the standalone site, under
 * /discover inside the app
 */
export function discoverBase() {
  return isDiscoverSite() ? "" : "/discover";
}

/** dev only: preview the documentation site on localhost (localStorage flag) */
const DOCS_PREVIEW_KEY = "zrzur:docs-site";

/**
 * Whether this page is the standalone developer documentation site: opened
 * on the origin of VITE_DOCS_URL (e.g. https://developers.zrzur.com). In
 * development the flag `zrzur:docs-site = "1"` in localStorage previews it
 * on localhost.
 */
export function isDocsSite() {
  if (env.DOCS_URL) {
    try {
      if (new URL(env.DOCS_URL).origin === window.location.origin) return true;
    } catch {
      // resolveDocsUrl already checked it; nothing to match then
    }
  }
  if (!import.meta.env.DEV) return false;
  try {
    return window.localStorage.getItem(DOCS_PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Where documentation pages live: at the root of the standalone site,
 * under /developers/docs inside the app
 */
export function docsBase() {
  return isDocsSite() ? "" : "/developers/docs";
}
