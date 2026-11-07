import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Dialog, DialogProps, iconSize } from "@revolt/ui";

import { error as MdError } from "@revolt/ui/icons/legacy";

import { TranslatedError } from "@revolt/i18n/errors";
import { Modals } from "../types";

const Error = styled("div", {
  base: {
    whiteSpace: "pre-wrap",
  },
});

export function Error2Modal(props: DialogProps & Modals & { type: "error2" }) {
  return (
    <Dialog
      icon={<MdError {...iconSize(24)} />}
      show={props.show}
      onClose={props.onClose}
      title={<Trans>An error occurred.</Trans>}
      actions={[{ text: <Trans>OK</Trans> }]}
    >
      <Error>
        <TranslatedError error={props.error} />
      </Error>
    </Dialog>
  );
}
