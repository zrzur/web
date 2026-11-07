import { Trans } from "@lingui/solid/macro";
import { useMutation } from "@tanstack/solid-query";

import { useClient } from "@revolt/client";
import { Dialog, DialogProps } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Modal to delete a server
 */
export function DeleteServerModal(
  props: DialogProps & Modals & { type: "delete_server" },
) {
  const client = useClient();
  const { showError, mfaFlow } = useModals();

  const deleteServer = useMutation(() => ({
    mutationFn: async () => {
      const mfa = await client().account.mfa();
      const ticket = await mfaFlow(mfa);

      // closing or cancelling the confirmation leaves the server untouched
      if (!ticket) return;

      await props.server.delete(undefined, ticket);
    },
    onError: showError,
  }));

  return (
    <Dialog
      tone="danger"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Delete {props.server.name}?</Trans>}
      size="sm"
      actions={[
        { text: <Trans>Cancel</Trans>, variant: "text" },
        {
          text: <Trans>Delete</Trans>,
          variant: "destructive",
          onClick: () => deleteServer.mutateAsync(),
        },
      ]}
      isDisabled={deleteServer.isPending}
    >
      <Trans>Once it's deleted, there's no going back.</Trans>
    </Dialog>
  );
}
