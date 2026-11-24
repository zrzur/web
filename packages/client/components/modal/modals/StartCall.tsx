import { Trans, useLingui } from "@lingui/solid/macro";

import { conversationName } from "@revolt/app/interface/channels/conversationName";
import { Dialog, DialogProps } from "@revolt/ui";

import { Modals } from "../types";

/**
 * Asked before a call in a direct message or group rings anyone. Joining a
 * call that is already on, or answering one, does not ask.
 */
export function StartCallModal(
  props: DialogProps & Modals & { type: "start_call" },
) {
  const { t } = useLingui();
  const name = () => conversationName(props.channel) ?? "";

  return (
    <Dialog
      tone="info"
      iconName={props.video ? "video-camera" : "phone"}
      size="sm"
      show={props.show}
      onClose={props.onClose}
      title={
        props.video
          ? t({
              id: "call.confirm.title.video",
              message: "Start a video call?",
            })
          : t({
              id: "call.confirm.title.voice",
              message: "Start a voice call?",
            })
      }
      actions={[
        { text: <Trans>Cancel</Trans> },
        {
          text: t({ id: "call.confirm.start", message: "Start call" }),
          variant: "primary",
          onClick: () => {
            props.onStart();
            return true;
          },
        },
      ]}
    >
      <span data-start-call-confirm={props.video ? "video" : "voice"}>
        {props.channel.type === "Group"
          ? t({
              id: "call.confirm.body.group",
              message: `Everyone in ${name()} will be rung.`,
            })
          : t({
              id: "call.confirm.body.dm",
              message: `${name()} will be rung on their devices.`,
            })}
      </span>
    </Dialog>
  );
}
