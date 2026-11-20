import { Match, Switch, createSignal, onMount } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import {
  isServiceId,
  serviceConnectionsApi,
  serviceReturnFields,
} from "@revolt/app/interface/settings/user/connections/serviceConnectionsApi";
import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import { useModals } from "@revolt/modal";
import { useNavigate, useParams } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Button, CircularProgress } from "@revolt/ui";

/**
 * Where Twitch, GitHub and Battle.net send people back after they signed in
 * there. Passes the state and code to the server, which finishes the link,
 * then opens Settings → Connections with the preview. The address is
 * replaced at once, so the one-use code never stays in the history.
 */
export function ServiceReturn() {
  const client = useClient();
  const state = useState();
  const params = useParams<{ service: string }>();
  const navigate = useNavigate();
  const { openModal } = useModals();
  const [error, setError] = createSignal<unknown>();
  const [denied, setDenied] = createSignal(false);

  const openConnections = () => {
    navigate(state.layout.getLastActivePath(), { replace: true });
    openModal({ type: "settings", config: "user", initialPage: "connections" });
  };

  onMount(async () => {
    const fields = serviceReturnFields(window.location.search);
    window.history.replaceState(null, "", window.location.pathname);
    const service = params.service;
    if (!isServiceId(service)) {
      setError(new Error("Unknown service"));
      return;
    }
    if (fields.denied || !fields.code || !fields.state) {
      setDenied(true);
      return;
    }
    try {
      await serviceConnectionsApi.finish(
        client(),
        service,
        fields.state,
        fields.code,
      );
      openConnections();
    } catch (err) {
      setError(err);
    }
  });

  return (
    <Base>
      <Card aria-live="polite">
        <Switch
          fallback={
            <>
              <CircularProgress />
              <p>
                <Trans>Linking your account…</Trans>
              </p>
            </>
          }
        >
          <Match when={denied()}>
            <h1>
              <Trans>Nothing was linked</Trans>
            </h1>
            <p>
              <Trans>The sign-in was cancelled, so nothing was copied.</Trans>
            </p>
            <div>
              <Button onPress={openConnections}>
                <Trans>Back to Connections</Trans>
              </Button>
            </div>
          </Match>
          <Match when={error()}>
            <h1>
              <Trans>The account was not linked</Trans>
            </h1>
            <p role="alert">
              <TranslatedError error={error()} />
            </p>
            <div>
              <Button onPress={openConnections}>
                <Trans>Back to Connections</Trans>
              </Button>
            </div>
          </Match>
        </Switch>
      </Card>
    </Base>
  );
}

const Base = styled("main", {
  base: {
    width: "100%",
    minHeight: 0,
    overflowY: "auto",
    display: "flex",
    justifyContent: "center",
    padding: "32px 16px",
    color: "var(--z-fg-primary)",
  },
});

const Card = styled("section", {
  base: {
    width: "min(100%, 460px)",
    height: "fit-content",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "12px",
    padding: "24px",
    borderRadius: "var(--z-box-radius)",
    background: "var(--z-box-bg)",

    "& h1": {
      margin: 0,
      fontSize: "20px",
      lineHeight: "28px",
      fontWeight: 600,
    },
    "& p": {
      margin: 0,
      fontSize: "14px",
      lineHeight: "20px",
      color: "var(--z-fg-secondary)",
    },
    border: "var(--z-box-border)",
  },
});
