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

import CONFIGURATION from "@revolt/common/lib/env";
import {
  browserPreferredLanguage,
  importCatalog,
  preferSiteCatalogs,
} from "@revolt/i18n/catalog";
import type { Language } from "@revolt/i18n/Languages";
import { startEarlyConfig } from "@revolt/instance/earlyConfig";

import siteCatalogs from "virtual:zrzur-site-catalogs";
import { bootFailed, bootLoaded, opensSignIn } from "./boot";
import "./index.css";
import { opensWall, startEarlyDesigns } from "./interface/designs/early";
import "./serviceWorkerInterface";
import { isDesignsSite, isDiscoverSite, isDocsSite } from "./siteKind";
import { watchForStaleBuild } from "./staleBuild";

// a tab opened before an update loads the new build instead of failing
watchForStaleBuild();

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
  const site = isDesignsSite() || isDiscoverSite() || isDocsSite();
  const signIn = opensSignIn(window.location.pathname);
  // the sites' own pages need a fifth of the messages: a small file first,
  // the full one right after (sign-in pages need the full one at once)
  if (site && !signIn) preferSiteCatalogs(siteCatalogs);

  // the provider asks for the same catalog and gets this download; a
  // failure is handled there (it falls back to English)
  importCatalog(browserPreferredLanguage() as Language).catch(() => {});

  if (signIn) {
    // on the sites too: their /login is the same sign-in page; a failure
    // here shows when the page itself asks for it
    import("./Auth").catch(() => {});
    import("@revolt/auth/src/flows/FlowLogin").catch(() => {});
  }

  const session = () => {
    try {
      return window.sessionStorage;
    } catch {
      return undefined;
    }
  };
  // nothing shows before the server's configuration has arrived: ask now,
  // with the language file, not after it
  if (!isDocsSite()) startEarlyConfig(CONFIGURATION.DEFAULT_API_URL);

  // the Designs page and, on its own site, its first designs start now, with
  // the shell: they used to wait for the language file and the first render
  const designs = isDesignsSite()
    ? !signIn
    : window.location.pathname.split("/")[1] === "designs";
  if (designs) {
    import("./interface/Designs").catch(() => {});
    if (isDesignsSite() && opensWall(window.location.pathname))
      startEarlyDesigns(CONFIGURATION.DEFAULT_API_URL);
  }

  // two separate imports on purpose: written as one `site ? import(a) :
  // import(b)`, the build gave both the same list of files to download
  // with them, so a site page also downloaded the chat app and the reverse
  let page: Promise<unknown>;
  if (site) page = import("./sites");
  else page = import("./app");
  page.then(
    () => bootLoaded(session()),
    () =>
      bootFailed({
        storage: session(),
        reload: () => window.location.reload(),
        root: document.getElementById("root"),
        languages: navigator.languages,
      }),
  );
}
