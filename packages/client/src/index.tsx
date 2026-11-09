/**
 * The first code to run. Kept small: it starts, at the same moment, the
 * download of this page's own code (the app, or the Designs / Discover
 * site, which never downloads the chat app) and of the message catalog,
 * which used to wait until the whole app had arrived.
 */
import "./sentry";

import "@revolt/ui/icons/icon.css";
import "@revolt/ui/zrzur-controls.css";

/* @refresh reload */
import "@revolt/ui/styles";

import { browserPreferredLanguage, importCatalog } from "@revolt/i18n/catalog";
import type { Language } from "@revolt/i18n/Languages";

import { opensSignIn } from "./boot";
import "./index.css";
import "./serviceWorkerInterface";
import { isDesignsSite, isDiscoverSite } from "./siteKind";

/**
 * Move into top window if the client was loaded inside itself
 */
function escapeSelfEmbed() {
  if (window.self === window.top) return false;

  try {
    // reading a cross-origin parent's location throws, leave those embeds be
    if (window.top!.location.origin !== window.location.origin) return false;
  } catch {
    return false;
  }

  window.top!.location.href = window.location.href;
  return true;
}

if (!escapeSelfEmbed()) {
  // the provider asks for the same catalog and gets this download; a
  // failure is handled there (it falls back to English)
  importCatalog(browserPreferredLanguage() as Language).catch(() => {});

  if (isDesignsSite() || isDiscoverSite()) {
    import("./sites");
  } else {
    if (opensSignIn(window.location.pathname)) {
      import("./Auth");
      import("@revolt/auth/src/flows/FlowLogin");
    }
    import("./app");
  }
}
