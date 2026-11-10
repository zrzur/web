import { Match, Show, Switch, createSignal, onMount } from "solid-js";

import { Trans } from "@lingui/solid/macro";

import { useApi, useClientLifecycle } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { useNavigate, useParams } from "@revolt/routing";

import { TranslatedError } from "@revolt/i18n/errors";

import {
  AuthButton,
  FlowActions,
  FlowText,
  FlowTitle,
  showDevMocks,
} from "./Flow";

type State =
  | {
      state: "verifying";
    }
  | {
      state: "error";
      error: unknown;
    }
  | {
      state: "success";
      mfa_ticket?: string;
    };

/**
 * Flow for confirming email
 */
export default function FlowVerify() {
  const api = useApi();
  const params = useParams();
  const modals = useModals();
  const navigate = useNavigate();
  const { login } = useClientLifecycle();

  const [state, setState] = createSignal<State>({
    state: "verifying",
  });
  const [continuing, setContinuing] = createSignal<"ready" | "submitting">(
    "ready",
  );
  const [loginError, setLoginError] = createSignal<unknown>();

  onMount(async () => {
    try {
      if (showDevMocks()) {
        if (confirm("Mock verification?")) {
          if (confirm("Successful verification?")) {
            setState({ state: "success", mfa_ticket: "token" });
          } else {
            setState({ state: "error", error: "InvalidToken" });
          }

          return;
        }
      }

      const data = (await api.post(`/auth/account/verify/${params.token}`)) as {
        ticket?: { token: string };
      };

      setState({ state: "success", mfa_ticket: data.ticket?.token });
    } catch (err) {
      setState({ state: "error", error: err });
    }
  });

  /**
   * Only the server's own "bad token" means the link is bad. A limit or a lost
   * connection says nothing about it: the link in the mail still works.
   */
  const linkIsBad = () => {
    const v = state();
    if (v.state !== "error") return false;
    const error = v.error as { type?: string } | string;
    return (typeof error === "string" ? error : error?.type) === "InvalidToken";
  };

  /**
   * Use MFA ticket to login
   */
  async function performLogin() {
    const v = state();
    // the ticket works once: ignore a second press while logging in
    if (v.state === "success" && v.mfa_ticket && continuing() === "ready") {
      setContinuing("submitting");
      try {
        await login(
          {
            mfa_ticket: v.mfa_ticket,
          },
          modals,
        );
      } catch (err) {
        // the account is verified either way: say what went wrong and offer
        // the normal login (the ticket can't be used again)
        setLoginError(err);
        setState({ state: "success" });
        return;
      } finally {
        setContinuing("ready");
      }

      navigate("/login/auth", { replace: true });
    }
  }

  return (
    <Switch>
      <Match when={state().state === "verifying"}>
        <FlowTitle>
          <Trans>Verifying your account…</Trans>
        </FlowTitle>
      </Match>
      <Match when={state().state === "error"}>
        <FlowTitle
          subtitle={
            <Show
              when={linkIsBad()}
              fallback={
                <span role="alert">
                  <TranslatedError
                    error={(state() as { error: unknown }).error}
                  />
                </span>
              }
            >
              <Trans>
                This link is invalid or has already been used. Request a new one
                if your account still needs verifying.
              </Trans>
            </Show>
          }
        >
          <Trans>Failed to verify!</Trans>
        </FlowTitle>
        <FlowActions back="/login/auth">
          <AuthButton onPress={() => navigate("/login/resend")}>
            <Trans>Resend verification</Trans>
          </AuthButton>
        </FlowActions>
      </Match>
      <Match when={state().state === "success"}>
        <FlowTitle>
          <Trans>Your account has been verified!</Trans>
        </FlowTitle>
        <Show when={loginError()}>
          <FlowText role="alert">
            <TranslatedError error={loginError()} />
          </FlowText>
        </Show>
        <Show
          when={(state() as { mfa_ticket?: string }).mfa_ticket}
          fallback={
            <FlowActions>
              <AuthButton onPress={() => navigate("/login/auth")}>
                <Trans>Log in</Trans>
              </AuthButton>
            </FlowActions>
          }
        >
          <FlowActions back="/login/auth">
            <AuthButton status={continuing()} onPress={performLogin}>
              <Trans>Continue to app</Trans>
            </AuthButton>
          </FlowActions>
        </Show>
      </Match>
    </Switch>
  );
}
