import { Trans } from "@lingui/solid/macro";
import { useMutation, useQueryClient } from "@tanstack/solid-query";

import { useClient } from "@revolt/client";
import { Dialog, DialogProps } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Modal to delete a bot
 */
export function DeleteBotModal(
  props: DialogProps & Modals & { type: "delete_bot" },
) {
  const client = useClient();
  const queryClient = useQueryClient();
  const { showError, mfaFlow } = useModals();

  const deleteBot = useMutation(() => ({
    mutationFn: async () => {
      const mfa = await client().account.mfa();
      const ticket = await mfaFlow(mfa);

      // closing or cancelling the confirmation leaves the bot untouched
      if (!ticket) return;

      await props.bot.delete(ticket);
      await queryClient.invalidateQueries({
        queryKey: ["bots", client().user!.id],
      });
      props.onDelete?.();
    },
    onError: showError,
  }));

  return (
    <Dialog
      tone="danger"
      size="sm"
      show={props.show}
      onClose={props.onClose}
      title={
        <Trans>Delete {props.bot.user?.displayName ?? props.bot.id}?</Trans>
      }
      actions={[
        { text: <Trans>Cancel</Trans>, variant: "text" },
        {
          text: <Trans>Delete</Trans>,
          variant: "destructive",
          onClick: () => deleteBot.mutateAsync(),
        },
      ]}
      isDisabled={deleteBot.isPending}
    >
      <Trans>Once it's deleted, there's no going back.</Trans>
    </Dialog>
  );
}
