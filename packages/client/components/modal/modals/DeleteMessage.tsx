import { Trans } from "@lingui/solid/macro";
import { useMutation } from "@tanstack/solid-query";

import { Dialog, DialogProps } from "@revolt/ui";

import { Message } from "@revolt/app";
import { styled } from "styled-system/jsx";
import { useModals } from "..";
import { Modals } from "../types";

/**
 * Modal to delete a message
 */
export function DeleteMessageModal(
  props: DialogProps & Modals & { type: "delete_message" },
) {
  const { showError } = useModals();

  const deleteMessage = useMutation(() => ({
    mutationFn: () => props.message.delete(),
    onError: showError,
  }));

  return (
    <Dialog
      tone="danger"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Delete message</Trans>}
      size="sm"
      actions={[
        { text: <Trans>Cancel</Trans>, variant: "text" },
        {
          text: <Trans>Delete</Trans>,
          variant: "destructive",
          onClick: () => deleteMessage.mutateAsync(),
        },
      ]}
      isDisabled={deleteMessage.isPending}
    >
      <Trans>Are you sure you want to delete this?</Trans>
      <MessagePreview>
        <Message isLink="hide" message={props.message} />
      </MessagePreview>
    </Dialog>
  );
}

const MessagePreview = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    paddingBlock: "var(--gap-md)",
    gap: "var(--message-group-spacing)",
    pointerEvents: "none",
  },
});
