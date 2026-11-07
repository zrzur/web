import { Match, Show, Switch, createSignal, onMount } from "solid-js";

import { Trans } from "@lingui/solid/macro";

import type { API } from "@zrzur/sdk/solid";

import { useApi } from "@revolt/client";
import { A, useParams } from "@revolt/routing";
import { Button } from "@revolt/ui";

import { FlowTitle, useFlowBubble } from "./Flow";

type Change = API.AccountSecurityChangeView;

type State =
  | { state: "loading" }
  | { state: "invalid" }
  | { state: "open"; change: Change }
  | { state: "done"; accepted: boolean; kind: Change["kind"] };

/**
 * Confirm or decline an email or two-factor change that Zrzur support
 * asked for. Reached from the link sent to the account's current email;
 * works without signing in, once.
 */
export default function FlowConfirmChange() {
  const api = useApi();
  const params = useParams();
  const bubble = useFlowBubble();
  const [state, setState] = createSignal<State>({ state: "loading" });
  const [busy, setBusy] = createSignal(false);
  const [failed, setFailed] = createSignal(false);

  // works without a session: the token in the link is the proof
  const path = () =>
    `/auth/account/change-request/${encodeURIComponent(params.token)}` as const;

  onMount(async () => {
    try {
      const change = await api.get(path(), undefined, { anonymous: true });
      setState(change.status === "Pending" ? { state: "open", change } : { state: "invalid" });
    } catch {
      setState({ state: "invalid" });
    }
  });

  async function answer(accept: boolean) {
    const s = state();
    if (s.state !== "open") return;
    setBusy(true);
    setFailed(false);
    try {
      await api.post(path(), { accept }, { anonymous: true });
      setState({ state: "done", accepted: accept, kind: s.change.kind });
      bubble?.flashSuccess();
    } catch {
      setFailed(true);
      bubble?.flashError();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Switch>
      <Match when={state().state === "loading"}>
        <FlowTitle>
          <Trans>Please wait…</Trans>
        </FlowTitle>
      </Match>
      <Match when={state().state === "invalid"}>
        <FlowTitle
          subtitle={
            <Trans>
              This link has expired, was already used, or was withdrawn. Nothing
              was changed. Contact Zrzur support if you still need help.
            </Trans>
          }
        >
          <Trans>This link no longer works</Trans>
        </FlowTitle>
        <A href="/login/auth">
          <Button variant="text">
            <Trans>Go back to login</Trans>
          </Button>
        </A>
      </Match>
      <Match when={(() => { const s = state(); return s.state === "open" ? s.change : undefined; })()}>
        {(change) => (
          <>
            <FlowTitle
              subtitle={
                <Trans>Nothing changes unless you confirm. If you didn't ask Zrzur for this, decline it and change your password.</Trans>
              }
            >
              {change().kind === "two_factor" ? (
                <Trans>Turn off two-factor authentication?</Trans>
              ) : (
                <Trans>Change your sign-in email?</Trans>
              )}
            </FlowTitle>
            <Show when={change().kind === "email"}>
              <p dir="ltr">{change().new_email}</p>
            </Show>
            <Show when={change().kind === "two_factor"}>
              <p>
                <Trans>You'll be signed out on every device. You can turn two-factor on again in your settings.</Trans>
              </p>
            </Show>
            <p dir="auto">{change().reason}</p>
            <Show when={failed()}>
              <p role="alert">
                <Trans>That didn't work. Try again in a moment.</Trans>
              </p>
            </Show>
            <Button isDisabled={busy()} onPress={() => void answer(true)}>
              <Trans>Confirm</Trans>
            </Button>
            <Button variant="text" isDisabled={busy()} onPress={() => void answer(false)}>
              <Trans>Decline</Trans>
            </Button>
          </>
        )}
      </Match>
      <Match when={(() => { const s = state(); return s.state === "done" ? s : undefined; })()}>
        {(done) => (
          <>
            <FlowTitle>
              {!done().accepted ? (
                <Trans>Declined. Nothing was changed.</Trans>
              ) : done().kind === "two_factor" ? (
                <Trans>Two-factor authentication is off. Sign in with your email and password.</Trans>
              ) : (
                <Trans>Almost done: open the link we sent to your new email to finish the change.</Trans>
              )}
            </FlowTitle>
            <A href="/login/auth">
              <Button>
                <Trans>Go to login</Trans>
              </Button>
            </A>
          </>
        )}
      </Match>
    </Switch>
  );
}
