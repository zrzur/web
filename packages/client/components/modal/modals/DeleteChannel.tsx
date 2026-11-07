import { Match, Switch } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { useMutation } from "@tanstack/solid-query";

import { Dialog, DialogProps, DialogSubject } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Modal to delete a channel (or leave a group / close a conversation)
 *
 * [trash] Delete #name?
 *         Once it's deleted, there's no going back.
 * [ # name  · channel and all its messages ]
 * [                    Cancel   [ Delete ] ]
 */
export function DeleteChannelModal(
  props: DialogProps & Modals & { type: "delete_channel" },
) {
  const { showError } = useModals();

  const deleteChannel = useMutation(() => ({
    mutationFn: () => props.channel.delete(),
    onError: showError,
  }));

  const group = () => props.channel.type === "Group";
  const dm = () => props.channel.type === "DirectMessage";

  return (
    <Dialog
      size="sm"
      tone="danger"
      iconName={group() ? "sign-out" : dm() ? "x-circle" : "trash"}
      show={props.show}
      onClose={props.onClose}
      title={
        <Switch fallback={<Trans>Delete {props.channel.name}?</Trans>}>
          <Match when={group()}>
            <Trans>Leave {props.channel.name}?</Trans>
          </Match>
          <Match when={dm()}>
            <Trans>
              Close conversation with {props.channel.recipient?.displayName}?
            </Trans>
          </Match>
        </Switch>
      }
      description={
        <Switch
          fallback={<Trans>Once it's deleted, there's no going back.</Trans>}
        >
          <Match when={group()}>
            <Trans>
              You won't be able to rejoin unless you are re-invited.
            </Trans>
          </Match>
          <Match when={dm()}>
            <Trans>
              You can re-open it later, but it will disappear on both sides.
            </Trans>
          </Match>
        </Switch>
      }
      actions={[
        { text: <Trans>Cancel</Trans>, variant: "text" },
        {
          text: (
            <Switch fallback={<Trans>Delete</Trans>}>
              <Match when={group()}>
                <Trans>Leave</Trans>
              </Match>
              <Match when={dm()}>
                <Trans>Close</Trans>
              </Match>
            </Switch>
          ),
          variant: "destructive",
          isLoading: deleteChannel.isPending,
          onClick: () => deleteChannel.mutateAsync(),
        },
      ]}
      isDisabled={deleteChannel.isPending}
    >
      <Switch>
        <Match when={!group() && !dm()}>
          <DialogSubject>
            <Icon
              name={props.channel.isVoice ? "speaker-high" : "hash"}
              size={20}
            />
            <div>
              <strong>{props.channel.name}</strong>
              <small>
                <Trans>The channel and all of its messages</Trans>
              </small>
            </div>
          </DialogSubject>
        </Match>
      </Switch>
    </Dialog>
  );
}
