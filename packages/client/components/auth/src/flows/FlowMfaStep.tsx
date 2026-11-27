import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { API } from "@zrzur/sdk/solid";

import type { MfaLoginOutcome } from "@revolt/client/mfaLogin";
import { TextField } from "@revolt/ui";

import { FlowActions, FlowLinks, FlowTitle } from "./Flow";
import { Form, SubmitButton } from "./Form";

/** What the sign-in card needs to ask for the second step */
export type MfaAsk = {
  methods: API.MFAMethod[];
  submit: (response: API.MFAResponse) => Promise<MfaLoginOutcome>;
  /** Ends the step: the outcome, or nothing when the person went back */
  done: (outcome?: MfaLoginOutcome) => void;
};

/**
 * The second step of signing in, in the sign-in card itself: the card turns
 * to the code instead of a dialog opening over it (owner, 2026-11-27: never
 * a box on a box). A wrong code stays here with its message and an empty
 * field for the next code.
 */
export function FlowMfaStep(props: { ask: MfaAsk }) {
  const { t } = useLingui();
  // the authenticator app first; a recovery code when it is the only way
  const [method, setMethod] = createSignal<"Totp" | "Recovery">(
    // eslint-disable-next-line solid/reactivity
    props.ask.methods.includes("Totp") ? "Totp" : "Recovery",
  );
  const canSwitch = () =>
    props.ask.methods.includes("Totp") &&
    props.ask.methods.includes("Recovery");
  let box: HTMLDivElement | undefined;

  async function submit(data: FormData) {
    const code = (data.get("code") as string) ?? "";
    const response: API.MFAResponse =
      method() === "Totp" ? { totp_code: code } : { recovery_code: code };
    try {
      props.ask.done(await props.ask.submit(response));
    } catch (error) {
      // ready for the next code
      const input = box?.querySelector("input");
      if (input) {
        input.value = "";
        input.focus();
      }
      throw error;
    }
  }

  return (
    <>
      <FlowTitle
        subtitle={
          <Show
            when={method() === "Totp"}
            fallback={<Trans>Enter one of the recovery codes you saved.</Trans>}
          >
            <Trans>Enter the 6-digit code from your authenticator app.</Trans>
          </Show>
        }
      >
        <Trans>Confirm it's you</Trans>
      </FlowTitle>
      <Form
        onSubmit={submit}
        actions={
          <FlowActions back={() => props.ask.done()}>
            <SubmitButton>
              <Trans>Confirm</Trans>
            </SubmitButton>
          </FlowActions>
        }
      >
        <div ref={box} style={{ display: "contents" }}>
          <Show
            when={method() === "Totp"}
            fallback={
              <TextField
                required
                name="code"
                type="text"
                autocomplete="off"
                autofocus
                label={t`Recovery code`}
              />
            }
          >
            <TextField
              required
              name="code"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              autofocus
              label={t`Code from your authenticator app`}
              placeholder="000000"
            />
          </Show>
        </div>
      </Form>
      <Show when={canSwitch()}>
        <FlowLinks aria-label={t`Other ways to confirm`}>
          <button
            type="button"
            onClick={() =>
              setMethod((current) => (current === "Totp" ? "Recovery" : "Totp"))
            }
          >
            <Show
              when={method() === "Totp"}
              fallback={<Trans>Use your authenticator app</Trans>}
            >
              <Trans>Use a recovery code instead</Trans>
            </Show>
          </button>
        </FlowLinks>
      </Show>
    </>
  );
}
