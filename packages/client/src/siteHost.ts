// Which site this page is, and link helpers. Small on purpose: the first code
// to run needs these, the site shells around them load only on their own host.
import { onMount } from "solid-js";

import { linkLanguage } from "@revolt/app/interface/discover/sites";
import { useClientLifecycle } from "@revolt/client";
import { CONFIGURATION as env } from "@revolt/common";
import { Language } from "@revolt/i18n";
import { useState } from "@revolt/state";

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

/**
 * A shared link may ask for a language (`?hl=ar`): the language links
 * search engines follow, and links people pass on in their own language
 */
export function useLinkLanguage() {
  const state = useState();
  const { isLoggedIn } = useClientLifecycle();
  onMount(() => {
    const language = linkLanguage(window.location.search);
    if (!language) return;
    if (isLoggedIn()) {
      // a signed-in person already chose a language: a shared link shows
      // this page in the link's language, but never overwrites the choice
      state.locale.switchForSession(language as Language);
    } else {
      state.locale.switch(language as Language);
    }
  });
}
