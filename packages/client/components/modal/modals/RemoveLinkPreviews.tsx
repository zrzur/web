import { Trans } from "@lingui/solid/macro";
import { useMutation } from "@tanstack/solid-query";

import { Dialog, DialogProps } from "@revolt/ui";

import { styled } from "styled-system/jsx";
import { useModals } from "..";
import { Modals } from "../types";

/**
 * Asks before a message's link previews are removed for everyone. The link
 * itself stays in the message. Holding Shift on the X or the menu entry
 * skips this question (the same shortcut as deleting a message).
 */
export function RemoveLinkPreviewsModal(
  props: DialogProps & Modals & { type: "remove_link_previews" },
) {
  const { showError } = useModals();

  const remove = useMutation(() => ({
    mutationFn: () => props.message.removeEmbeds(),
    onError: showError,
  }));

  return (
    <Dialog
      tone="danger"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Remove link previews?</Trans>}
      size="sm"
      actions={[
        { text: <Trans>Cancel</Trans>, variant: "text" },
        {
          text: <Trans>Remove previews</Trans>,
          variant: "destructive",
          onClick: () => remove.mutateAsync(),
        },
      ]}
      isDisabled={remove.isPending}
    >
      <span data-testid="remove-previews-question">
        <Trans>
          The previews under this message will be removed for everyone. The
          link stays in the message.
        </Trans>
      </span>
      <Hint>
        <Trans>Hold Shift while you remove them to skip this question.</Trans>
      </Hint>
    </Dialog>
  );
}

const Hint = styled("p", {
  base: {
    marginBlock: "var(--gap-md) 0",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
    // no keyboard on a phone: the hint would only confuse
    _phone: { display: "none" },
  },
});
