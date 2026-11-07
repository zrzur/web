import type { DialogProps } from "@revolt/ui";
import { CreateServerFlow } from "../lib/CreateServerFlow";
import { Modals } from "../types";

export function CreateServerModal(
  props: DialogProps & Modals & { type: "create_server" },
) {
  return (
    <CreateServerFlow
      show={props.show}
      onClose={props.onClose}
      modalId={props.modalId}
      client={props.client}
    />
  );
}
