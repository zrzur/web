import { createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useMutation } from "@tanstack/solid-query";

import {
  Avatar,
  Column,
  Dialog,
  DialogProps,
  Text,
  TextField,
} from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Kick a server member
 */
export function KickMemberModal(
  props: DialogProps & Modals & { type: "kick_member" },
) {
  const { t } = useLingui();
  const { showError } = useModals();
  const [reason, setReason] = createSignal("");

  const kick = useMutation(() => ({
    // the reason goes to the audit log
    mutationFn: () => props.member.kick(reason()),
    onError: showError,
  }));

  return (
    <Dialog
      tone="danger"
      iconName="user-minus"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Kick member</Trans>}
      size="sm"
      actions={[
        { text: <Trans>Cancel</Trans>, variant: "text" },
        {
          text: <Trans>Kick</Trans>,
          variant: "destructive",
          onClick: kick.mutateAsync,
        },
      ]}
      isDisabled={kick.isPending}
    >
      <Column align>
        <Avatar src={props.member.user?.animatedAvatarURL} size={64} />
        <Text>
          <Trans>You are about to kick {props.member.user?.username}</Trans>
        </Text>
        <TextField
          label={t`Reason (optional)`}
          placeholder={t`Shown in the audit log`}
          maxlength={512}
          value={reason()}
          onInput={(e) => setReason(e.currentTarget.value)}
        />
      </Column>
    </Dialog>
  );
}
