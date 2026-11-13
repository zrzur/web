/* @refresh reload */
/**
 * The standalone Designs, Discover and developer documentation sites: their
 * own first download, without the chat app's pages
 */
import { lazy } from "solid-js";

import { Navigate, Route } from "@solidjs/router";

import { MountContext, loginRoutes, renderRoutes } from "./mount";
import { isDesignsSite, isDocsSite } from "./siteKind";

// the shells of the standalone Designs and Discover sites
const DesignsSite = lazy(() =>
  import("./DesignsSite").then((m) => ({ default: m.DesignsSite })),
);
const DiscoverSite = lazy(() =>
  import("./DiscoverSite").then((m) => ({ default: m.DiscoverSite })),
);

const DevelopersDocs = lazy(() =>
  import("./interface/DevelopersDocs").then((m) => ({
    default: m.DevelopersDocs,
  })),
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

/**
 * The standalone documentation site (origin of VITE_DOCS_URL): one page per
 * address at the root, no account; addresses copied from inside the app
 * (/developers/docs/…) lose the prefix
 */
const docsSiteRoutes = () => (
  <Route component={MountContext}>
    <Route
      path="/developers/docs/*rest"
      component={(props: { params: { rest?: string } }) => (
        <Navigate href={`/${props.params.rest ?? ""}`} />
      )}
    />
    <Route path="/*" component={DevelopersDocs} />
  </Route>
);

renderRoutes(
  isDocsSite()
    ? docsSiteRoutes
    : isDesignsSite()
      ? designsSiteRoutes
      : discoverSiteRoutes,
);
