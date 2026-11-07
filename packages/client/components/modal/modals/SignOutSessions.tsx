import { Match, Show, Switch, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { useMutation } from "@tanstack/solid-query";
import { styled } from "styled-system/jsx";

import { useClient, useClientLifecycle } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import { Column, Dialog, DialogProps } from "@revolt/ui";

import {
  isAlreadyClosed,
  isAlreadySignedOut,
} from "@revolt/app/interface/settings/user/sessionList";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Modal to log out of one session, or of all the others.
 * A failure stays in this dialog, in plain words.
 */
export function SignOutSessionsModal(
  props: DialogProps & Modals & { type: "sign_out_sessions" },
) {
  const { mfaFlow } = useModals();
  const { logout } = useClientLifecycle();
  const client = useClient();
  const [error, setError] = createSignal<unknown>();

  // read once: the session leaves the collection while the dialog closes
  // eslint-disable-next-line solid/reactivity
  const session = props.session;
  const name = session?.name;
  const isCurrent = session?.current;

  const signOutSessions = useMutation(() => ({
    mutationFn: async () => {
      setError(undefined);

      // this device needs no confirmation code. Ask the server first: the
      // normal way out ignores a failure and leaves the session open
      if (isCurrent) {
        await client()
          .logout()
          .catch((failure) => {
            if (!isAlreadySignedOut(failure)) throw failure;
          });
        return logout();
      }

      const mfa = await client().account.mfa();
      const ticket = await mfaFlow(mfa);

      // closing or cancelling the confirmation keeps every session
      if (!ticket) return;

      if (!session) return props.client.sessions.deleteAll(ticket);

      try {
        await session.delete(ticket);
      } catch (failure) {
        if (!isAlreadyClosed(failure)) throw failure;
        props.client.sessions.delete(session.id);
      }
    },
    onError: setError,
  }));

  return (
    <Dialog
      tone="danger"
      iconName="sign-out"
      size="sm"
      show={props.show}
      onClose={props.onClose}
      title={
        <Switch fallback={<Trans>Log out of all other sessions?</Trans>}>
          <Match when={isCurrent}>
            <Trans>Log out of this device?</Trans>
          </Match>
          <Match when={session}>
            <Trans>
              Log out of <bdi>{name}</bdi>?
            </Trans>
          </Match>
        </Switch>
      }
      actions={[
        { text: <Trans>Cancel</Trans>, variant: "text" },
        {
          text: <Trans>Log out</Trans>,
          variant: "destructive",
          isLoading: signOutSessions.isPending,
          onClick: () => signOutSessions.mutateAsync(),
        },
      ]}
      isDisabled={signOutSessions.isPending}
    >
      <Column>
        <span>
          <Switch fallback={<Trans>This device stays signed in.</Trans>}>
            <Match when={isCurrent}>
              <Trans>You will need to sign in again.</Trans>
            </Match>
            <Match when={session}>
              <Trans>That device will need to sign in again.</Trans>
            </Match>
          </Switch>
        </span>
        <Show when={error()}>
          <Failure role="alert">
            <TranslatedError error={error()} />
          </Failure>
        </Show>
      </Column>
    </Dialog>
  );
}

const Failure = styled("div", {
  base: {
    padding: "12px 16px",
    borderRadius: "var(--z-radius-md, 10px)",
    background: "color-mix(in srgb, var(--z-danger) 12%, transparent)",
    color: "var(--z-fg-primary)",
    fontSize: "13px",
  },
});
