import { createFormControl, createFormGroup } from "solid-forms";
import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { hasOldTag, userHandle } from "@revolt/common/lib/userTag";
import { useError } from "@revolt/i18n";
import { useState } from "@revolt/state";
import { Column, Dialog, DialogProps, Form2 } from "@revolt/ui";

import { Modals } from "../types";

/**
 * Mirrors the backend rule (`RE_USERNAME`, length 2..=32)
 */
const RE_USERNAME = /^(\p{L}|[\d_.-])+$/u;

/**
 * Change account username. Usernames are unique: the name picked here belongs
 * to this account alone. An account that still has a number tag from before
 * may also keep its name as it is, which makes the name its own and drops
 * the tag.
 */
export function EditUsernameModal(
  props: DialogProps & Modals & { type: "edit_username" },
) {
  const { t } = useLingui();
  const describeError = useError();
  const state = useState();

  // the dialog edits the signed-in user, which never changes underneath it
  // eslint-disable-next-line solid/reactivity
  const currentUsername = props.client.user!.username;
  // eslint-disable-next-line solid/reactivity
  const hadOldTag = hasOldTag(props.client.user);
  const group = createFormGroup({
    username: createFormControl(currentUsername, {
      required: true,
    }),
    currentPassword: createFormControl("", { required: true }),
  });

  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const username = () => group.controls.username.value.trim();

  const usernameError = () => {
    const value = username();
    if (!group.controls.username.isDirty || !value) return undefined;
    if (value.length < 2) return t`Use at least 2 characters.`;
    if (!RE_USERNAME.test(value))
      return t`Use letters, numbers, underscores (_), dots (.) or dashes (-).`;
    return undefined;
  };

  const canSubmit = () =>
    !loading() &&
    !usernameError() &&
    username().length >= 2 &&
    // an account with an old tag may keep its name: that makes it its own
    (hadOldTag || username() !== currentUsername) &&
    !!group.controls.currentPassword.value;

  async function onSubmit() {
    if (!canSubmit()) return;
    setError(undefined);
    setLoading(true);
    try {
      await props.client.user!.changeUsername(
        username(),
        group.controls.currentPassword.value,
      );
      props.onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      tone="edit"
      iconName="at"
      show={props.show}
      onClose={props.onClose}
      persistent={group.isDirty}
      title={
        <Show when={hadOldTag} fallback={<Trans>Change your username</Trans>}>
          <Trans>Choose your username</Trans>
        </Show>
      }
      description={
        // only the move away from number tags needs saying
        <Show when={hadOldTag}>
          <Trans>
            Usernames no longer have a number tag. Choose a username that will
            be yours alone; you can keep{" "}
            <strong dir="ltr" style={{ color: "var(--z-fg-primary)" }}>
              {currentUsername}
            </strong>{" "}
            if nobody has taken it. Until then you stay{" "}
            <span dir="ltr">
              {userHandle(props.client.user, state.settings.streamerMode)}
            </span>
            .
          </Trans>
        </Show>
      }
      error={error()}
      actions={[
        { text: <Trans>Cancel</Trans> },
        {
          text: <Trans>Save username</Trans>,
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
            minlength={2}
            maxlength={32}
            counter
            name="username"
            autocomplete="username"
            autocapitalize="none"
            spellcheck={false}
            control={group.controls.username}
            label={t`Username`}
            error={usernameError()}
            helper={t`2 to 32 characters. You can change it twice a day.`}
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
    </Dialog>
  );
}
