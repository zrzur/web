import { createFormControl, createFormGroup } from "solid-forms";

import { createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";


import { Dialog, DialogProps, Form2 } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Add a new friend by username
 */
export function AddFriendModal(
  props: DialogProps & Modals & { type: "add_friend" },
) {
  const { t } = useLingui();
  const { showError } = useModals();

  const group = createFormGroup({
    username: createFormControl("", { required: true }),
  });

  const [refused, setRefused] = createSignal<string>();

  async function onSubmit() {
    setRefused(undefined);
    try {
      await props.client.api.post(`/users/friend`, {
        username: group.controls.username.value,
      });

      props.onClose();
    } catch (error) {
      if ((error as { type?: string })?.type === "OfficialAccount") {
        setRefused(t`This is an official Zrzur account. It can't be added.`);
        return;
      }
      showError(error);
    }
  }

  const submit = Form2.useSubmitHandler(group, onSubmit);

  return (
    <Dialog
      tone="invite"
      iconName="user-plus"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Add a new friend</Trans>}
      actions={[
        { text: <Trans>Close</Trans> },
        {
          text: <Trans>Send request</Trans>,
          onClick: () => {
            onSubmit();
            return false;
          },
          isDisabled: !Form2.canSubmit(group),
        },
      ]}
      isDisabled={group.isPending}
      error={refused()}
    >
      <form onSubmit={submit}>
        <Form2.TextField
          name="username"
          control={group.controls.username}
          label={t`Username`}
          placeholder={t`username#1234`}
        />
      </form>
    </Dialog>
  );
}
