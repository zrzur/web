import { JSX, Match, Switch } from "solid-js";

import { SiteFrame } from "@revolt/app/interface/discover/SiteFrame";
import { useClientLifecycle } from "@revolt/client";
import { LoadingScreen } from "@revolt/ui";

/**
 * The shell of the Discover site: the shared site header and footer around
 * Discover. Browsing needs no account; a saved session is restored first
 * so joining works in one step.
 */
export function DiscoverSite(props: { children?: JSX.Element }) {
  const { isLoggedIn, lifecycle } = useClientLifecycle();
  return (
    <SiteFrame site="discover">
      <Switch fallback={<LoadingScreen />}>
        <Match when={!isLoggedIn() || lifecycle.loadedOnce()}>
          {props.children}
        </Match>
      </Switch>
    </SiteFrame>
  );
}
