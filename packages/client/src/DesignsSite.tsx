import { JSX, Match, Switch } from "solid-js";

import { SiteFrame } from "@revolt/app/interface/discover/SiteFrame";
import { appLinks } from "@revolt/app/interface/discover/sites";
import { useClientLifecycle } from "@revolt/client";
import { LoadingScreen } from "@revolt/ui";

export { appUrl } from "@revolt/app/interface/discover/sites";
import { designsBase } from "./siteHost";

export { designsBase, isDesignsSite } from "./siteHost";

/**
 * The shell of the Designs site: the shared site header and footer around
 * Designs. Browsing needs no account; using a design signs in first.
 */
export function DesignsSite(props: { children?: JSX.Element }) {
  const { isLoggedIn, lifecycle } = useClientLifecycle();
  return (
    <SiteFrame site="designs">
      <Switch fallback={<LoadingScreen />}>
        <Match when={!isLoggedIn() || lifecycle.loadedOnce()}>
          {props.children}
        </Match>
      </Switch>
    </SiteFrame>
  );
}

/**
 * Wearing or saving needs an account. Without one (the public site), go
 * to the same Designs page in the app, which signs in first and comes
 * back. Returns whether the caller may go on.
 */
export function useAccountGate() {
  const { isLoggedIn } = useClientLifecycle();
  return () => {
    if (isLoggedIn()) return true;
    const base = designsBase();
    const path = window.location.pathname;
    const rest = base && path.startsWith(base) ? path.slice(base.length) : path;
    // in the language the page is shown in (set on <html> by the i18n code)
    const hl = document.documentElement.lang;
    const query = ["ar", "en", "de"].includes(hl) ? `?hl=${hl}` : "";
    window.location.assign(
      appLinks(`/designs${rest === "/" ? "" : rest}${query}`).web,
    );
    return false;
  };
}
