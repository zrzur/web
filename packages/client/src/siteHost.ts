// Which site this page is (siteKind.ts), and link helpers.
import { onMount } from "solid-js";

import { linkLanguage } from "@revolt/app/interface/discover/sites";
import { useClientLifecycle } from "@revolt/client";
import { Language } from "@revolt/i18n";
import { useState } from "@revolt/state";

export {
  designsBase,
  discoverBase,
  isDesignsSite,
  isDiscoverSite,
} from "./siteKind";

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
