import { createFormControl, createFormGroup } from "solid-forms";

import { Trans, useLingui } from "@lingui/solid/macro";

import { Column, Dialog, DialogProps, Form2 } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Modal to create a new server role
 */
export function CreateRoleModal(
  props: DialogProps & Modals & { type: "create_role" },
) {
  const { t } = useLingui();
  const { showError } = useModals();

  const group = createFormGroup({
    name: createFormControl("", { required: true }),
  });

  async function onSubmit() {
    try {
      const role = await props.server.createRole(group.controls.name.value);
      props.callback(role.id);
      props.onClose();
    } catch (error) {
      showError(error);
    }
  }

  const submit = Form2.useSubmitHandler(group, onSubmit);

  return (
    <Dialog
      tone="create"
      iconName="identification-badge"
      appearance="creation"
      showClose={false}
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Create role</Trans>}
      actions={[
        { variant: "text", text: <Trans>Cancel</Trans> },
        {
          text: <Trans>Create</Trans>,
          onClick: () => {
            onSubmit();
            return false;
          },
          isDisabled: !Form2.canSubmit(group),
        },
      ]}
      isDisabled={group.isPending}
    >
      <form onSubmit={submit}>
        <Column>
          <Form2.TextField
            minlength={1}
            maxlength={32}
            counter
            name="name"
            control={group.controls.name}
            label={t`Role name`}
          />
        </Column>
      </form>
    </Dialog>
  );
}
