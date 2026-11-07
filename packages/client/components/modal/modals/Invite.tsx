import { Match, Switch, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { useNavigate } from "@solidjs/router";
import { useMutation } from "@tanstack/solid-query";
import { JoinRequestCreated, ServerPublicInvite } from "@zrzur/sdk/solid";

import { Avatar, Dialog, DialogProps, Row } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Modal to join a server. On a server that needs approval the button sends
 * a request instead, and the dialog says it is waiting for approval.
 */
export function InviteModal(props: DialogProps & Modals & { type: "invite" }) {
  const navigate = useNavigate();
  const { showError } = useModals();
  const [requested, setRequested] = createSignal(false);

  const invite = () => props.invite as ServerPublicInvite;
  const needsApproval = () =>
    props.invite.type === "Server" &&
    invite().serverAccess === "Approval" &&
    !invite().server;

  const join = useMutation(() => ({
    mutationFn: () => invite().join(),
    onSuccess(server) {
      navigate(server.path);
    },
    onError(error) {
      // a request was recorded: not a failure, and not a membership
      if (error instanceof JoinRequestCreated) setRequested(true);
      else showError(error);
    },
  }));

  return (
    <Dialog
      tone="invite"
      iconName="sign-in"
      show={props.show}
      onClose={props.onClose}
      title={
        <Switch>
          <Match when={props.invite.type === "Server"}>
            <Row>
              <Avatar
                size={32}
                src={invite().serverIcon?.previewUrl}
                fallback={invite().serverName}
              />
              <span>{invite().serverName}</span>
            </Row>
          </Match>
        </Switch>
      }
      actions={
        requested()
          ? [{ text: <Trans>Close</Trans> }]
          : [
              { text: <Trans>Cancel</Trans> },
              {
                text: (
                  <Switch fallback={<Trans>Join</Trans>}>
                    <Match
                      when={props.invite.type === "Server" && invite().server}
                    >
                      <Trans>Open</Trans>
                    </Match>
                    <Match when={needsApproval()}>
                      <Trans>Request to join</Trans>
                    </Match>
                  </Switch>
                ),
                // keep the dialog open to show the outcome of a request
                onClick: () =>
                  join.mutateAsync().then(
                    () => true,
                    () => false,
                  ),
              },
            ]
      }
      isDisabled={join.isPending}
      scrimBackground={
        props.invite instanceof ServerPublicInvite
          ? props.invite.serverBanner?.originalUrl
          : undefined
      }
    >
      <Switch>
        <Match when={requested()}>
          <Trans>
            Request sent. You'll join this server as soon as someone who runs it
            approves you.
          </Trans>
        </Match>
        <Match when={props.invite.type === "Server" && invite().server}>
          <Trans>You're already part of this server.</Trans>
        </Match>
        <Match when={needsApproval()}>
          <Trans>
            This server is private. Send a request, and you'll join once someone
            who runs it approves you.
          </Trans>
        </Match>
        <Match when={props.invite.type === "Server"}>
          <Trans>
            You've been invited to join this server.
            <br />
            Would you like to join?
          </Trans>
        </Match>
      </Switch>
    </Dialog>
  );
}
