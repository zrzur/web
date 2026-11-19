/* @refresh reload */
/**
 * The app: every page of the signed-in app, plus sign-in
 */
import { lazy } from "solid-js";

import { Route } from "@solidjs/router";

import { MountContext, loginRoutes, renderRoutes } from "./mount";
import {
  BotRedirect,
  InviteRedirect,
  PWARedirect,
  SettingsRedirect,
} from "./redirects";

// pages that are not part of chatting load on first visit
// The signed-in app loads after the first screen: someone on the login page
// only downloads the login code (the service worker keeps the app for later)
const Interface = lazy(() => import("./Interface"));
const HomePage = lazy(() =>
  import("./interface/Home").then((m) => ({ default: m.HomePage })),
);
const ServerHome = lazy(() =>
  import("./interface/ServerHome").then((m) => ({ default: m.ServerHome })),
);
const ChannelPage = lazy(() =>
  import("./interface/channels/ChannelPage").then((m) => ({
    default: m.ChannelPage,
  })),
);

// pages that are not the first screen load when opened
const Friends = lazy(() =>
  import("./interface/Friends").then((m) => ({ default: m.Friends })),
);
const You = lazy(() =>
  import("./interface/You").then((m) => ({ default: m.You })),
);
const EventsPage = lazy(() =>
  import("./interface/events/EventsPage").then((m) => ({
    default: m.EventsPage,
  })),
);
const LobbyPage = lazy(() =>
  import("./interface/lobby/Lobby").then((m) => ({ default: m.LobbyPage })),
);
const Designs = lazy(() =>
  import("./interface/Designs").then((m) => ({ default: m.Designs })),
);
const Developers = lazy(() =>
  import("./interface/Developers").then((m) => ({ default: m.Developers })),
);
// the developer docs: their own chunk, shown without the chat client
const DevelopersDocs = lazy(() =>
  import("./interface/DevelopersDocs").then((m) => ({
    default: m.DevelopersDocs,
  })),
);
const DevelopmentPage = lazy(() =>
  import("./interface/Development").then((m) => ({
    default: m.DevelopmentPage,
  })),
);
const Discover = lazy(() =>
  import("./interface/Discover").then((m) => ({ default: m.Discover })),
);
const SteamReturn = lazy(() =>
  import("./interface/SteamReturn").then((m) => ({ default: m.SteamReturn })),
);
const ServiceReturn = lazy(() =>
  import("./interface/ServiceReturn").then((m) => ({
    default: m.ServiceReturn,
  })),
);
const OAuthPages = lazy(() =>
  import("./interface/OAuth").then((m) => ({ default: m.OAuthPages })),
);

const appRoutes = () => (
  <Route component={MountContext}>
    {loginRoutes()}
    {/* the docs never wait for the gateway, signed in or not */}
    <Route path="/developers/docs/*" component={DevelopersDocs} />
    <Route path="/" component={Interface}>
      <Route path="/pwa" component={PWARedirect} />
      <Route path="/dev" component={DevelopmentPage} />
      <Route path="/discover/*" component={Discover} />
      <Route path="/developers/*" component={Developers} />
      <Route path="/oauth2/*" component={OAuthPages} />
      <Route path="/connections/steam/return" component={SteamReturn} />
      <Route
        path="/connections/:service/return"
        component={ServiceReturn}
      />
      <Route path="/designs/*" component={Designs} />
      <Route path="/settings" component={SettingsRedirect} />
      <Route path="/invite/:code" component={InviteRedirect} />
      <Route path="/bot/:code" component={BotRedirect} />
      {/* the short form, for a server whose short-link origin is the app itself */}
      <Route path="/b/:code" component={BotRedirect} />
      <Route path="/friends" component={Friends} />
      <Route path="/you" component={You} />
      <Route path="/server/:server/*">
        <Route path="/channel/:channel/*" component={ChannelPage} />
        <Route path="/lobby" component={LobbyPage} />
        <Route path="/events/:event?" component={EventsPage} />
        <Route path="/*" component={ServerHome} />
      </Route>
      <Route path="/channel/:channel/*" component={ChannelPage} />
      <Route path="/*" component={HomePage} />
    </Route>
  </Route>
);

renderRoutes(appRoutes);
