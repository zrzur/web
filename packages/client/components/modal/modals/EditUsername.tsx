import { createFormControl, createFormGroup } from "solid-forms";
import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useError } from "@revolt/i18n";
import { useState } from "@revolt/state";
import { Column, Dialog, DialogProps, Form2 } from "@revolt/ui";

import { Modals } from "../types";

/**
 * Mirrors the backend rule (`RE_USERNAME`, length 2..=32)
 */
const RE_USERNAME = /^(\p{L}|[\d_.-])+$/u;

/**
 * Change account username
 */
export function EditUsernameModal(
  props: DialogProps & Modals & { type: "edit_username" },
) {
  const { t } = useLingui();
  const describeError = useError();
  const state = useState();
  // the own tag stays off screen in streamer mode
  const tag = (value?: string) =>
    state.settings.streamerMode ? "••••" : value;

  // the dialog edits the signed-in user, which never changes underneath it
  // eslint-disable-next-line solid/reactivity
  const currentUsername = props.client.user!.username;
  const group = createFormGroup({
    username: createFormControl(currentUsername, {
      required: true,
    }),
    currentPassword: createFormControl("", { required: true }),
  });

  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  // set when the server had to assign a new number tag
  const [newTag, setNewTag] = createSignal<string>();

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
    username() !== currentUsername &&
    !!group.controls.currentPassword.value;

  async function onSubmit() {
    if (!canSubmit()) return;
    setError(undefined);
    setLoading(true);
    try {
      const previousDiscriminator = props.client.user!.discriminator;
      await props.client.user!.changeUsername(
        username(),
        group.controls.currentPassword.value,
      );

      if (props.client.user!.discriminator !== previousDiscriminator) {
        setNewTag(props.client.user!.discriminator);
      } else {
        props.onClose();
      }
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
      persistent={group.isDirty && !newTag()}
      title={<Trans>Change your username</Trans>}
      description={
        <Show
          when={!newTag()}
          fallback={<Trans>Your username has been updated.</Trans>}
        >
          <Trans>
            Friends use your username and number tag to find you. Enter your
            current password to confirm.
          </Trans>
        </Show>
      }
      error={error()}
      actions={
        newTag()
          ? [{ text: <Trans>Done</Trans> }]
          : [
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
            ]
      }
    >
      <Show
        when={!newTag()}
        fallback={
          <p style={{ margin: 0 }}>
            <Trans>
              That name was already taken with your previous number, so you are
              now{" "}
              <strong style={{ color: "var(--z-fg-primary)" }}>
                {props.client.user!.username}#{tag(newTag())}
              </strong>
              .
            </Trans>
          </p>
        }
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
              suffix={`#${tag(props.client.user!.discriminator)}`}
              error={usernameError()}
              helper={t`2 to 32 characters. Your number tag may change if this name is taken.`}
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
