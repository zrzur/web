import { Match, Switch, createSignal, onMount } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import {
  connectionsApi,
  steamReturnFields,
} from "@revolt/app/interface/settings/user/connections/connectionsApi";
import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Button, CircularProgress } from "@revolt/ui";

/**
 * Where Steam sends people back after they signed in there. Passes what
 * Steam sent to the server, which checks it with Steam, then opens
 * Settings → Connections with the preview. The address is replaced at once,
 * so the one-use fields never stay in the history.
 */
export function SteamReturn() {
  const client = useClient();
  const state = useState();
  const navigate = useNavigate();
  const { openModal } = useModals();
  const [error, setError] = createSignal<unknown>();

  const openConnections = () => {
    navigate(state.layout.getLastActivePath(), { replace: true });
    openModal({ type: "settings", config: "user", initialPage: "connections" });
  };

  onMount(async () => {
    const { state: linkState, params } = steamReturnFields(
      window.location.search,
    );
    window.history.replaceState(null, "", window.location.pathname);
    try {
      await connectionsApi.finish(client(), linkState, params);
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
                <Trans>Linking your Steam account…</Trans>
              </p>
            </>
          }
        >
          <Match when={error()}>
            <h1>
              <Trans>Steam was not linked</Trans>
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
    borderRadius: "var(--z-radius-lg)",
    background: "var(--z-bg-raised)",

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
  },
});
