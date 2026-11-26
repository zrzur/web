import { Trans, useLingui } from "@lingui/solid/macro";

import { conversationName } from "@revolt/app/interface/channels/conversationName";
import { Dialog, DialogProps } from "@revolt/ui";

import { Modals } from "../types";

/**
 * Asked before a call in a direct message or group rings anyone. Joining a
 * call that is already on, or answering one, does not ask. The wording is
 * shared with the phone app (same msgids).
 */
export function StartCallModal(
  props: DialogProps & Modals & { type: "start_call" },
) {
  const { t } = useLingui();

  return (
    <Dialog
      tone="info"
      iconName={props.video ? "video-camera" : "phone"}
      size="sm"
      show={props.show}
      onClose={props.onClose}
      title={<bdi>{conversationName(props.channel) ?? ""}</bdi>}
      actions={[
        { text: <Trans>Cancel</Trans> },
        {
          text: props.video ? t`Start a video call` : t`Start a call`,
          variant: "primary",
          onClick: () => {
            props.onStart();
            return true;
          },
        },
      ]}
    >
      <span data-start-call-confirm={props.video ? "video" : "voice"}>
        {t`No one is here yet. Start the call and others can join.`}
      </span>
    </Dialog>
  );
}
