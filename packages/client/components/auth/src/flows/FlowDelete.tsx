import { Match, Switch, createSignal, onMount } from "solid-js";

import { Trans } from "@lingui/solid/macro";

import { useApi } from "@revolt/client";
import { useParams } from "@revolt/routing";

import { FlowText, FlowTitle } from "./Flow";

/**
 * Temporary flow for account deletion
 */
export default function FlowDeleteAccount() {
  const api = useApi();
  const params = useParams();
  const [deleted, setDeleted] = createSignal<boolean | "error">(false);

  onMount(() => {
    api
      .put("/auth/account/delete", {
        token: params.token,
      })
      .then(() => setDeleted(true))
      .catch(() => setDeleted("error"));
  });

  return (
    <>
      <FlowTitle>
        <Trans>Delete account</Trans>
      </FlowTitle>
      <FlowText role="status">
        <Switch fallback={<Trans>Please wait…</Trans>}>
          <Match when={deleted() === "error"}>
            <Trans>Something went wrong. Please contact support.</Trans>
          </Match>
          <Match when={deleted() === true}>
            <Trans>Your account has been queued for deletion.</Trans>
          </Match>
        </Switch>
      </FlowText>
    </>
  );
}
