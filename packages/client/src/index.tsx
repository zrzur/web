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

import {
  browserPreferredLanguage,
  importCatalog,
  preferSiteCatalogs,
} from "@revolt/i18n/catalog";
import type { Language } from "@revolt/i18n/Languages";

import siteCatalogs from "virtual:zrzur-site-catalogs";
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
  const site = isDesignsSite() || isDiscoverSite();
  // the sites' own pages need a fifth of the messages: a small file first,
  // the full one right after (sign-in pages need the full one at once)
  if (site && !opensSignIn(window.location.pathname))
    preferSiteCatalogs(siteCatalogs);

  // the provider asks for the same catalog and gets this download; a
  // failure is handled there (it falls back to English)
  importCatalog(browserPreferredLanguage() as Language).catch(() => {});

  if (site) {
    import("./sites");
  } else {
    if (opensSignIn(window.location.pathname)) {
      import("./Auth");
      import("@revolt/auth/src/flows/FlowLogin");
    }
    import("./app");
  }
}
