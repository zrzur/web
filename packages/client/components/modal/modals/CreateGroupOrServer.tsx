import { Trans } from "@lingui/solid/macro";

import { Dialog, DialogProps } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Modal to create a group or server
 */
export function CreateGroupOrServer(
  props: DialogProps & Modals & { type: "create_group_or_server" },
) {
  const { openModal } = useModals();

  return (
    <Dialog
      tone="create"
      iconName="plus-circle"
      appearance="creation"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Create a group or server</Trans>}
      actions={[
        {
          text: <Trans>Group</Trans>,
          onClick: () => {
            openModal({
              type: "create_group",
              client: props.client,
            });
          },
        },
        {
          text: <Trans>Server</Trans>,
          onClick: () => {
            openModal({
              type: "create_server",
              client: props.client,
            });
          },
        },
      ]}
    >
      <Trans>Would you like to create a new group or server?</Trans>
    </Dialog>
  );
}
