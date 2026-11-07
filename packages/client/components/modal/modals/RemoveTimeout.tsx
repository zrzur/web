import { Trans } from "@lingui/solid/macro";
import { useMutation } from "@tanstack/solid-query";

import { Avatar, Column, Dialog, DialogProps, Text } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Remove a server member's timeout
 */
export function RemoveTimeoutModal(
  props: DialogProps & Modals & { type: "remove_timeout" },
) {
  const { showError } = useModals();

  const removeTimeout = useMutation(() => ({
    mutationFn: () => props.member.removeTimeout(),
    onError: showError,
  }));

  return (
    <Dialog
      tone="info"
      iconName="clock-counter-clockwise"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Remove timeout</Trans>}
      actions={[
        { text: <Trans>Cancel</Trans>, variant: "text" },
        {
          text: <Trans>Remove timeout</Trans>,
          variant: "destructive",
          onClick: removeTimeout.mutateAsync,
        },
      ]}
      isDisabled={removeTimeout.isPending}
    >
      <Column align>
        <Avatar src={props.member.user?.animatedAvatarURL} size={64} />
        <Text>
          <Trans>
            {props.member.user?.username}'s timeout will be removed and they
            will be able to interact with the server again.
          </Trans>
        </Text>
      </Column>
    </Dialog>
  );
}
