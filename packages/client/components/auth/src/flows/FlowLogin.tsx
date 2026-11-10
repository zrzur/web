import { Match, Switch, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClientLifecycle } from "@revolt/client";
import {
  isAgeRefusal,
  isUnderMinimumAge,
  toBirthMonth,
} from "@revolt/client/age";
import {
  AgeRefusedText,
  UnderMinimumConfirmText,
} from "@revolt/client/ageTexts";
import { State, TransitionType } from "@revolt/client/Controller";
import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { A, Navigate } from "@revolt/routing";

import { useState } from "@revolt/state";
import {
  AuthButton,
  FlowActions,
  FlowLinks,
  FlowText,
  FlowTitle,
} from "./Flow";
import { Fields, Form, SubmitButton } from "./Form";
import { asksForCaptcha, loginCredentials } from "./loginStepUp";

/**
 * Flow for logging into an account
 *
 * Email and password; an account without a month and year of birth is asked
 * for it right after logging in, before anything else (the server refuses
 * everything else until then).
 */
export default function FlowLogin() {
  const { t } = useLingui();
  const state = useState();
  const modals = useModals();
  const { config } = useInstance();
  // set once the server asks for a captcha after many wrong passwords
  const [stepUp, setStepUp] = createSignal(false);
  const {
    lifecycle,
    isLoggedIn,
    isError,
    login,
    logout,
    selectUsername,
    declareAge,
  } = useClientLifecycle();

  /**
   * Log into account
   * @param data Form Data
   */
  async function performLogin(data: FormData) {
    // the app is what comes next: fetch it while the server answers
    void import("../../../../src/Interface");
    void import("../../../../src/interface/Home");

    const email = data.get("email") as string;
    const password = data.get("password") as string;

    if (!email || !password) return false;

    try {
      return await login(
        loginCredentials(email, password, data.get("captcha") as string),
        modals,
      );
    } catch (error) {
      if (asksForCaptcha(error) && config.features.captcha.enabled)
        setStepUp(true);
      throw error;
    }
  }

  /**
   * Leave the error state so the login form works again
   */
  function dismissError() {
    lifecycle.transition({
      type: TransitionType.Dismiss,
    });
  }

  /**
   * Select a new username
   * @param data Form Data
   */
  async function select(data: FormData) {
    const username = data.get("username") as string;
    await selectUsername(username);
  }

  /**
   * Declare the month and year of birth
   * @param data Form Data
   */
  async function declare(data: FormData) {
    const birthMonth = toBirthMonth(
      Number(data.get("birth-year")),
      Number(data.get("birth-month")),
    );

    // below 16: ask once more, so a slip of the finger doesn't end it
    if (isUnderMinimumAge(birthMonth)) {
      setConfirmUnder16(birthMonth);
      return;
    }

    await send(birthMonth);
  }

  /**
   * Send the age. Below the minimum the server removes the new account; the
   * app signs out and says so.
   */
  async function send(birthMonth: string) {
    try {
      await declareAge(birthMonth);
    } catch (error) {
      if (isAgeRefusal(error)) {
        setConfirmUnder16(undefined);
        setRefused(true);
        logout();
        return;
      }
      throw error;
    }
  }

  const [confirmUnder16, setConfirmUnder16] = createSignal<string>();
  const [refused, setRefused] = createSignal(false);

  return (
    <Switch
      fallback={
        <>
          <FlowTitle
            subtitle={
              <Trans>Log in to pick up right where you left off.</Trans>
            }
          >
            <Trans>Welcome back</Trans>
          </FlowTitle>
          <Form
            onSubmit={performLogin}
            captcha={stepUp() ? config.features.captcha.key : undefined}
            actions={
              <FlowActions>
                <SubmitButton>
                  <Trans>Log in</Trans>
                </SubmitButton>
              </FlowActions>
            }
          >
            <Fields fields={["email", "password"]} />
          </Form>
          <FlowLinks aria-label={t`Account help`}>
            <A href="/login/reset">
              <Trans>Forgot password?</Trans>
            </A>
            <A href="/login/resend">
              <Trans>Resend verification</Trans>
            </A>
          </FlowLinks>
        </>
      }
    >
      <Match when={refused()}>
        <FlowTitle subtitle={<AgeRefusedText />}>
          <Trans>Sorry, we can't create your account</Trans>
        </FlowTitle>
        <FlowActions>
          <AuthButton onPress={() => setRefused(false)}>
            <Trans>OK</Trans>
          </AuthButton>
        </FlowActions>
      </Match>
      <Match when={isLoggedIn()}>
        <Navigate href={state.layout.popNextPath() ?? "/app"} />
      </Match>
      <Match when={isError() && lifecycle.permanentError === "InvalidSession"}>
        <FlowTitle
          subtitle={
            <Trans>
              Your session ended, possibly because you logged out on another
              device. Log in again to continue.
            </Trans>
          }
        >
          <Trans>You've been logged out</Trans>
        </FlowTitle>
        <FlowActions>
          <AuthButton onPress={dismissError}>
            <Trans>Log in again</Trans>
          </AuthButton>
        </FlowActions>
      </Match>
      <Match when={isError()}>
        <FlowTitle
          subtitle={
            <Trans>
              We couldn't finish logging you in. Try again, and if it keeps
              happening, check your connection to Zrzur.
            </Trans>
          }
        >
          <Trans>Something went wrong</Trans>
        </FlowTitle>
        <FlowActions>
          <AuthButton onPress={dismissError}>
            <Trans>Try again</Trans>
          </AuthButton>
        </FlowActions>
      </Match>
      <Match when={lifecycle.state() === State.LoggingIn}>
        {/* the shared bubble shows the loading state */}
        <FlowTitle>
          <Trans>Logging you in…</Trans>
        </FlowTitle>
        <FlowActions>
          <AuthButton status="submitting">
            <Trans>Log in</Trans>
          </AuthButton>
        </FlowActions>
      </Match>
      <Match
        when={lifecycle.state() === State.AgeRequired && confirmUnder16()}
      >
        <FlowTitle subtitle={<UnderMinimumConfirmText />}>
          <Trans>The date you entered is under 16</Trans>
        </FlowTitle>
        <FlowActions
          back={() => setConfirmUnder16(undefined)}
          backLabel={<Trans>Go back</Trans>}
        >
          <AuthButton onPress={() => send(confirmUnder16()!)}>
            <Trans>Continue</Trans>
          </AuthButton>
        </FlowActions>
      </Match>
      <Match when={lifecycle.state() === State.AgeRequired}>
        <FlowTitle
          subtitle={
            <Trans>We ask everyone once, to keep younger people safe.</Trans>
          }
        >
          <Trans>Add your month and year of birth</Trans>
        </FlowTitle>
        <Form
          onSubmit={declare}
          actions={
            <FlowActions back={logout} backLabel={<Trans>Log out</Trans>}>
              <SubmitButton>
                <Trans>Continue</Trans>
              </SubmitButton>
            </FlowActions>
          }
        >
          <Fields fields={["birth-month"]} />
        </Form>
      </Match>
      <Match when={lifecycle.state() === State.Onboarding}>
        <FlowTitle>
          <Trans>Choose a username</Trans>
        </FlowTitle>

        <FlowText>
          <Trans>
            Pick a username that you want people to be able to find you by. This
            can be changed later in your user settings.
          </Trans>
        </FlowText>

        <Form
          onSubmit={select}
          actions={
            <FlowActions
              back={() =>
                lifecycle.transition({
                  type: TransitionType.Cancel,
                })
              }
              backLabel={<Trans>Cancel</Trans>}
            >
              <SubmitButton>
                <Trans>Confirm</Trans>
              </SubmitButton>
            </FlowActions>
          }
        >
          <Fields fields={["username"]} />
        </Form>
      </Match>
    </Switch>
  );
}
