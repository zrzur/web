/**
 * What the app and the Designs / Discover sites share: the contexts every
 * page runs in, the sign-in routes and the render call
 */
import { JSX, Suspense, lazy } from "solid-js";
import { render } from "solid-js/web";

import { Route, Router } from "@solidjs/router";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";

import { ClientContext, SoundContext } from "@revolt/client";
import { DeviceContext } from "@revolt/common";
import { I18nProvider } from "@revolt/i18n";
import { InstanceContext } from "@revolt/instance";
import { KeybindContext } from "@revolt/keybinds";
import { ModalContext, ModalRenderer } from "@revolt/modal";
import { VoiceContext } from "@revolt/rtc";
import { StateContext, SyncWorker } from "@revolt/state";
import {
  FloatingManager,
  LoadTheme,
  SnackbarController,
  SnackbarProvider,
} from "@revolt/ui";

import { FirstScreen } from "./interface/home/FirstScreen";
import { useLinkLanguage } from "./siteHost";

const AndroidNag = lazy(() =>
  import("./AndroidNag").then((m) => ({ default: m.AndroidNag })),
);

// The sign-in pages load when opened; on a /login address index.tsx starts
// them together with the rest of the first download
const AuthPage = lazy(() => import("./Auth"));
const FlowLogin = lazy(() => import("@revolt/auth/src/flows/FlowLogin"));
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

/** A link may ask for a language (?hl=ar), on the sites and in the app */
function LinkLanguage() {
  useLinkLanguage();
  return null;
}

export function MountContext(props: { children?: JSX.Element }) {
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
export const loginRoutes = () => (
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

const snackbarCtrl = new SnackbarController();

/** Render the page with these routes, at the root and under /i/:host */
export function renderRoutes(routes: () => JSX.Element) {
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
}
