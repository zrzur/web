import { createFormControl, createFormGroup } from "solid-forms";
import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useError } from "@revolt/i18n";
import { Column, Dialog, DialogProps, Form2 } from "@revolt/ui";

import { MFATicket } from "@zrzur/sdk/solid";
import { useModals } from "..";
import { Modals } from "../types";

const RE_EMAIL = /^[^\s@]+@[^\s@]+$/;

/**
 * Change account email address
 */
export function EditEmailModal(
  props: DialogProps & Modals & { type: "edit_email" },
) {
  const { t } = useLingui();
  const { mfaFlow } = useModals();
  const describeError = useError();

  const group = createFormGroup({
    email: createFormControl("", { required: true }),
    currentPassword: createFormControl("", { required: true }),
  });

  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [sentTo, setSentTo] = createSignal<string>();

  const email = () => group.controls.email.value.trim();

  const emailError = () =>
    group.controls.email.isDirty && email() && !RE_EMAIL.test(email())
      ? t`Enter a valid email address.`
      : undefined;

  const canSubmit = () =>
    !loading() &&
    RE_EMAIL.test(email()) &&
    !!group.controls.currentPassword.value;

  // servers without email delivery apply the change immediately
  const verifiesByEmail = () =>
    props.client.configuration?.features.email ?? true;

  async function onSubmit() {
    if (!canSubmit()) return;
    setError(undefined);
    setLoading(true);
    try {
      const mfa = await props.client.account.mfa();

      let ticket: MFATicket | undefined;
      if (mfa.authenticatorEnabled) {
        ticket = await mfaFlow(mfa);
        // User canceled the MFA flow.
        if (!ticket) {
          return;
        }
      }

      await props.client.account.changeEmail(
        email(),
        group.controls.currentPassword.value,
        ticket,
      );

      setSentTo(email());
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      tone="security"
      iconName="envelope"
      show={props.show}
      onClose={props.onClose}
      persistent={group.isDirty && !sentTo()}
      title={
        <Show when={!sentTo()} fallback={<Trans>Check your inbox</Trans>}>
          <Trans>Change your email</Trans>
        </Show>
      }
      description={
        <Show when={!sentTo()}>
          <Trans>
            You sign in with this address and we use it for account security
            notices. Enter your current password to confirm.
          </Trans>
        </Show>
      }
      error={error()}
      actions={
        sentTo()
          ? [{ text: <Trans>Done</Trans> }]
          : [
              { text: <Trans>Cancel</Trans> },
              {
                text: <Trans>Change email</Trans>,
                onClick: () => {
                  onSubmit();
                  return false;
                },
                isDisabled: !canSubmit(),
                isLoading: loading(),
              },
            ]
      }
    >
      <Show
        when={!sentTo()}
        fallback={
          <p style={{ margin: 0 }}>
            <Show
              when={verifiesByEmail()}
              fallback={<Trans>Your login email has been changed.</Trans>}
            >
              <Trans>
                We sent a confirmation link to{" "}
                <strong style={{ color: "var(--z-fg-primary)" }}>
                  {sentTo()}
                </strong>
                . Your login email changes once you open it.
              </Trans>
            </Show>
          </p>
        }
      >
        <form {...Form2.enterSubmits(onSubmit)}>
          <Column gap="lg">
            <Form2.TextField
              name="email"
              type="email"
              inputmode="email"
              autocomplete="email"
              autocapitalize="none"
              spellcheck={false}
              label={t`New email address`}
              control={group.controls.email}
              placeholder={t`name@example.com`}
              error={emailError()}
            />
            <Form2.TextField
              name="currentPassword"
              control={group.controls.currentPassword}
              label={t`Current password`}
              type="password"
              toggle-password
              autocomplete="current-password"
            />
          </Column>
        </form>
      </Show>
    </Dialog>
  );
}
