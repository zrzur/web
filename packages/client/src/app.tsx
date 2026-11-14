/* @refresh reload */
/**
 * The app: every page of the signed-in app, plus sign-in
 */
import { lazy, onMount } from "solid-js";

import { Navigate, Route, useParams } from "@solidjs/router";
import { PublicChannelInvite } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { isInviteCode } from "@revolt/modal/modals/inviteLink";
import { useState } from "@revolt/state";

import { MountContext, loginRoutes, renderRoutes } from "./mount";

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
const OAuthPages = lazy(() =>
  import("./interface/OAuth").then((m) => ({ default: m.OAuthPages })),
);

/**
 * Redirect PWA start to the last active path
 */
function PWARedirect() {
  const state = useState();
  return <Navigate href={state.layout.getLastActivePath()} />;
}

/**
 * Open settings and redirect to last active path
 */
function SettingsRedirect() {
  const { openModal } = useModals();

  onMount(() => openModal({ type: "settings", config: "user" }));
  return <PWARedirect />;
}

/**
 * Open invite and redirect to last active path
 */
function InviteRedirect() {
  const params = useParams();
  const client = useClient();
  const { openModal, showError } = useModals();

  onMount(() => {
    if (params.code && isInviteCode(params.code)) {
      client()
        // TODO: add a helper to stoat.js for this
        .api.get(`/invites/${params.code as ""}`)
        .then((invite) => PublicChannelInvite.from(client(), invite))
        .then((invite) => openModal({ type: "invite", invite }))
        .catch(showError);
    }
  });

  return <PWARedirect />;
}

/**
 * Open bot invite and redirect to last active path
 */
function BotRedirect() {
  const params = useParams();
  const client = useClient();
  const { openModal, showError } = useModals();

  onMount(() => {
    if (params.code && isInviteCode(params.code)) {
      client()
        // kept by the SDK: the bot's card and this dialog share one request
        .bots.fetchPublic(params.code)
        .then((invite) => {
          // invite links from the Developer Portal carry the permissions
          const asked = Number(
            new URLSearchParams(window.location.search).get("permissions"),
          );
          openModal({
            type: "add_bot",
            invite,
            permissions:
              Number.isSafeInteger(asked) && asked > 0 ? asked : undefined,
          });
        })
        .catch(showError);
    }
  });

  return <PWARedirect />;
}

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
