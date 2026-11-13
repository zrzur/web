import { Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import type { Message } from "@zrzur/sdk/solid";

import {
  isSelecting,
  startSelection,
} from "@revolt/app/interface/channels/text/messageSelection";
import { Icon } from "@revolt/ui/icons/Icon";

import { ContextMenuButton } from "../ContextMenu";

/**
 * Message menu entry for moderators: start selecting messages here, with
 * this one selected, to delete several together
 */
export function SelectMessagesMenuItem(props: { message?: Message }) {
  const canSelect = () =>
    !!props.message &&
    props.message.channel?.type === "TextChannel" &&
    !!props.message.channel.havePermission("ManageMessages") &&
    !isSelecting(props.message.channelId);

  return (
    <Show when={canSelect()}>
      <ContextMenuButton
        icon={<Icon name="check-square" size={18} />}
        onClick={() =>
          startSelection(props.message!.channelId, props.message!.id)
        }
      >
        <Trans>Select messages</Trans>
      </ContextMenuButton>
    </Show>
  );
}
