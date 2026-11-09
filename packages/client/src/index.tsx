/**
 * Configure contexts and render App
 */
import "./sentry";

import { JSX, Suspense, lazy, onMount } from "solid-js";
import { render } from "solid-js/web";

import "@revolt/ui/icons/icon.css";
import "@revolt/ui/zrzur-controls.css";
import { Navigate, Route, Router, useParams } from "@solidjs/router";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
// only the outlined style is used (Symbol fallback, editor widgets)
import { PublicBot, PublicChannelInvite } from "@zrzur/sdk/solid";

import FlowLogin from "@revolt/auth/src/flows/FlowLogin";
import { ClientContext, SoundContext, useClient } from "@revolt/client";
import { DeviceContext } from "@revolt/common";
import { I18nProvider } from "@revolt/i18n";
import { InstanceContext } from "@revolt/instance";
import { KeybindContext } from "@revolt/keybinds";
import { ModalContext, ModalRenderer, useModals } from "@revolt/modal";
import { isInviteCode } from "@revolt/modal/modals/inviteLink";
import { VoiceContext } from "@revolt/rtc";
import { StateContext, SyncWorker, useState } from "@revolt/state";
import {
  FloatingManager,
  LoadTheme,
  SnackbarController,
  SnackbarProvider,
} from "@revolt/ui";

/* @refresh reload */
import "@revolt/ui/styles";

import AuthPage from "./Auth";
import "./index.css";
import { FirstScreen } from "./interface/home/FirstScreen";
import "./serviceWorkerInterface";
import { isDesignsSite, isDiscoverSite, useLinkLanguage } from "./siteHost";

const AndroidNag = lazy(() =>
  import("./AndroidNag").then((m) => ({ default: m.AndroidNag })),
);

// the sign-in steps other than the login form
const FlowCheck = lazy(() => import("@revolt/auth/src/flows/FlowCheck"));
const FlowConfirmChange = lazy(
  () => import("@revolt/auth/src/flows/FlowConfirmChange"),
);
const FlowConfirmReset = lazy(
  () => import("@revolt/auth/src/flows/FlowConfirmReset"),
);
const FlowCreate = lazy(() => import("@revolt/auth/src/flows/FlowCreate"));
const FlowDeleteAccount = lazy(
  () => import("@revolt/auth/src/flows/FlowDelete"),
);
const FlowResend = lazy(() => import("@revolt/auth/src/flows/FlowResend"));
const FlowReset = lazy(() => import("@revolt/auth/src/flows/FlowReset"));
const FlowVerify = lazy(() => import("@revolt/auth/src/flows/FlowVerify"));

// the shells of the standalone Designs and Discover sites
const DesignsSite = lazy(() =>
  import("./DesignsSite").then((m) => ({ default: m.DesignsSite })),
);
const DiscoverSite = lazy(() =>
  import("./DiscoverSite").then((m) => ({ default: m.DiscoverSite })),
);

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
        // TODO: add a helper to stoat.js for this
        .api.get(`/bots/${params.code as ""}/invite`)
        .then((invite) => new PublicBot(client(), invite))
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

/** A link may ask for a language (?hl=ar), on the sites and in the app */
function LinkLanguage() {
  useLinkLanguage();
  return null;
}

function MountContext(props: { children?: JSX.Element }) {
  const client = new QueryClient();

  return (
    <StateContext>
      <KeybindContext>
        <ModalContext>
          <ClientContext>
            <LoadTheme />
            <LinkLanguage />
            <SoundContext>
              <VoiceContext>
                <QueryClientProvider client={client}>
                  {/* the app, a page or a sign-in step is still loading */}
                  <Suspense fallback={<FirstScreen />}>
                    {props.children}
                  </Suspense>
                  <ModalRenderer />
                  <FloatingManager />
                  <Suspense>
                    <AndroidNag />
                  </Suspense>
                </QueryClientProvider>
              </VoiceContext>
            </SoundContext>
            <SyncWorker />
          </ClientContext>
        </ModalContext>
      </KeybindContext>
    </StateContext>
  );
}

/** Sign-in pages, shared by the app and the standalone Designs site */
const loginRoutes = () => (
  <Route path="/login" component={AuthPage}>
    <Route path="/delete/:token" component={FlowDeleteAccount} />
    <Route path="/confirm-change/:token" component={FlowConfirmChange} />
    <Route path="/check" component={FlowCheck} />
    <Route path="/create" component={FlowCreate} />
    <Route path="/create/:code" component={FlowCreate} />
    <Route path="/auth" component={FlowLogin} />
    <Route path="/resend" component={FlowResend} />
    <Route path="/reset" component={FlowReset} />
    <Route path="/verify/:token" component={FlowVerify} />
    <Route path="/reset/:token" component={FlowConfirmReset} />
    <Route path="/*" component={FlowLogin} />
  </Route>
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
      <Route path="/designs/*" component={Designs} />
      <Route path="/settings" component={SettingsRedirect} />
      <Route path="/invite/:code" component={InviteRedirect} />
      <Route path="/bot/:code" component={BotRedirect} />
      <Route path="/friends" component={Friends} />
      <Route path="/you" component={You} />
      <Route path="/server/:server/*">
        <Route path="/channel/:channel/*" component={ChannelPage} />
        <Route path="/lobby" component={LobbyPage} />
        <Route path="/*" component={ServerHome} />
      </Route>
      <Route path="/channel/:channel/*" component={ChannelPage} />
      <Route path="/*" component={HomePage} />
    </Route>
  </Route>
);

const routes = () =>
  isDesignsSite()
    ? designsSiteRoutes()
    : isDiscoverSite()
      ? discoverSiteRoutes()
      : appRoutes();

const snackbarCtrl = new SnackbarController();

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

if (!escapeSelfEmbed())
  render(
    () => (
      <DeviceContext>
        <I18nProvider>
          <SnackbarProvider controller={snackbarCtrl}>
            <Router>
              <Route path="/i/:host" component={InstanceContext}>
                {routes()}
              </Route>
              <Route path="/" component={InstanceContext}>
                {routes()}
              </Route>
            </Router>
            {/* <ReportBug /> */}
          </SnackbarProvider>
        </I18nProvider>
      </DeviceContext>
    ),
    document.getElementById("root") as HTMLElement,
  );
