import { Trans } from "@lingui/solid/macro";

import { Avatar, Column, Dialog, DialogProps, Text } from "@revolt/ui";

import { useMutation } from "@tanstack/solid-query";
import { useModals } from "..";
import { Modals } from "../types";

/**
 * Remove a member from a group
 */
export function RemoveMemberModal(
  props: DialogProps & Modals & { type: "remove_member" },
) {
  const { showError } = useModals();

  const removeMember = useMutation(() => ({
    mutationFn: (user: string) => {
      return props.group.removeMember(user);
    },
    onError: showError,
  }));

  return (
    <Dialog
      tone="danger"
      iconName="user-minus"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Remove member</Trans>}
      actions={[
        { text: <Trans>Cancel</Trans>, variant: "text" },
        {
          text: <Trans>Remove</Trans>,
          variant: "destructive",
          onClick: () => removeMember.mutateAsync(props.user.id),
        },
      ]}
      isDisabled={removeMember.isPending}
    >
      <Column align>
        <Avatar src={props.user.animatedAvatarURL} size={64} />
        <Text>
          <Trans>
            Are you sure you want to remove{" "}
            {props.user?.displayName ?? props.user.username} from{" "}
            {props.group.name}?
          </Trans>
        </Text>
      </Column>
    </Dialog>
  );
}
