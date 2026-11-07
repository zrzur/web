import { createFormControl, createFormGroup } from "solid-forms";
import { createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useError } from "@revolt/i18n";
import { Column, Dialog, DialogProps, Form2, useSnackbar } from "@revolt/ui";

import { Modals } from "../types";

/**
 * Change account password
 *
 * Strength rules stay on the server; the only client check is that the
 * confirmation matches, so a typo can't lock the user out.
 */
export function EditPasswordModal(
  props: DialogProps & Modals & { type: "edit_password" },
) {
  const { t } = useLingui();
  const describeError = useError();

  const snackbar = useSnackbar();

  const group = createFormGroup({
    currentPassword: createFormControl("", { required: true }),
    password: createFormControl("", { required: true }),
    confirmPassword: createFormControl("", { required: true }),
  });

  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const mismatch = () =>
    !!group.controls.confirmPassword.value &&
    group.controls.confirmPassword.value !== group.controls.password.value;

  const canSubmit = () =>
    !loading() &&
    !!group.controls.currentPassword.value &&
    !!group.controls.password.value &&
    group.controls.confirmPassword.value === group.controls.password.value;

  async function onSubmit() {
    if (!canSubmit()) return;
    setError(undefined);
    setLoading(true);
    try {
      await props.client.account.changePassword(
        group.controls.password.value,
        group.controls.currentPassword.value,
      );

      snackbar.show({ message: t`Password changed successfully.` });
      props.onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      tone="security"
      iconName="password"
      show={props.show}
      onClose={props.onClose}
      persistent={group.isDirty}
      title={<Trans>Change your password</Trans>}
      description={
        <Trans>
          Enter your current password, then choose a new one you don't use
          anywhere else.
        </Trans>
      }
      error={error()}
      actions={[
        { text: <Trans>Cancel</Trans> },
        {
          text: <Trans>Change password</Trans>,
          onClick: () => {
            onSubmit();
            return false;
          },
          isDisabled: !canSubmit(),
          isLoading: loading(),
        },
      ]}
    >
      <form {...Form2.enterSubmits(onSubmit)}>
        <Column gap="lg">
          <Form2.TextField
            name="currentPassword"
            control={group.controls.currentPassword}
            label={t`Current password`}
            type="password"
            toggle-password
            autocomplete="current-password"
          />
          <Form2.TextField
            name="password"
            control={group.controls.password}
            label={t`New password`}
            type="password"
            toggle-password
            autocomplete="new-password"
          />
          <Form2.TextField
            name="confirmPassword"
            control={group.controls.confirmPassword}
            label={t`Confirm new password`}
            type="password"
            toggle-password
            autocomplete="new-password"
            error={mismatch() ? t`Passwords don't match.` : undefined}
          />
        </Column>
      </form>
    </Dialog>
  );
}
