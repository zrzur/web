/**
 * The standalone Designs and Discover sites: their own first download, without
 * the chat app's pages
 */
import { lazy } from "solid-js";

import { Navigate, Route } from "@solidjs/router";

import { MountContext, loginRoutes, renderRoutes } from "./mount";
import { isDesignsSite } from "./siteKind";

// the shells of the standalone Designs and Discover sites
const DesignsSite = lazy(() =>
  import("./DesignsSite").then((m) => ({ default: m.DesignsSite })),
);
const DiscoverSite = lazy(() =>
  import("./DiscoverSite").then((m) => ({ default: m.DiscoverSite })),
);

const Designs = lazy(() =>
  import("./interface/Designs").then((m) => ({ default: m.Designs })),
);
const Discover = lazy(() =>
  import("./interface/Discover").then((m) => ({ default: m.Discover })),
);

/**
 * The standalone Designs site (VITE_DESIGNS_HOST): Designs at the root,
 * browsable without an account; old /designs/… links lose the prefix
 */
const designsSiteRoutes = () => (
  <Route component={MountContext}>
    {loginRoutes()}
    <Route path="/" component={DesignsSite}>
      <Route
        path="/designs/*rest"
        component={(props: { params: { rest?: string } }) => (
          <Navigate href={`/${props.params.rest ?? ""}`} />
        )}
      />
      <Route path="/*" component={Designs} />
    </Route>
  </Route>
);

/**
 * The standalone Discover site (origin of VITE_DISCOVER_URL): Discover at
 * the root, browsable without an account, plus sign-in
 */
const discoverSiteRoutes = () => (
  <Route component={MountContext}>
    {loginRoutes()}
    <Route path="/" component={DiscoverSite}>
      <Route path="/*" component={Discover} />
    </Route>
  </Route>
);

renderRoutes(isDesignsSite() ? designsSiteRoutes : discoverSiteRoutes);
