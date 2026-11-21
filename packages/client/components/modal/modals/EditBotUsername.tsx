import { userTag } from "@revolt/common/lib/userTag";
import { createFormControl, createFormGroup } from "solid-forms";

import { Trans } from "@lingui/solid/macro";

import { Column, Dialog, DialogProps, Form2, Row, Text } from "@revolt/ui";

import { createSignal } from "solid-js";
import { css } from "styled-system/css";

import { Modals } from "../types";
import { BotNameField, botNameBlocks } from "./BotNameField";

/**
 * Change bot username
 */
export function EditBotUsernameModal(
  props: DialogProps & Modals & { type: "edit_bot_username" },
) {
  const [error, setError] = createSignal<unknown>();

  const group = createFormGroup({
    // the name people see: "Liro Bot" rather than the handle Liro_Bot. It
    // won't change until after editing it
    username: createFormControl(
      // eslint-disable-next-line solid/reactivity
      props.bot.user!.displayName ?? props.bot.user!.username,
      {
        required: true,
      },
    ),
  });

  async function onSubmit() {
    if (botNameBlocks(group.controls.username.value)) return;
    setError(undefined);
    try {
      await props.bot.edit({
        name: group.controls.username.value,
      });
      props.onClose();
    } catch (failure) {
      // shown in this dialog, not in a second one on top of it
      setError(failure);
    }
  }

  const submit = Form2.useSubmitHandler(group, onSubmit);

  return (
    <Dialog
      tone="edit"
      iconName="at"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Change bot name</Trans>}
      actions={[
        { text: <Trans>Close</Trans> },
        {
          text: <Trans>Change</Trans>,
          onClick: () => {
            onSubmit();
            return false;
          },
          isDisabled:
            !Form2.canSubmit(group) ||
            botNameBlocks(group.controls.username.value),
        },
      ]}
      isDisabled={group.isPending}
    >
      <form onSubmit={submit}>
        <Column>
          <Row align>
            <BotNameField control={group.controls.username} error={error()} />
            <div class={css({ flexShrink: 0 })}>
              <Text class="label">{userTag(props.bot.user)}</Text>
            </div>
          </Row>
        </Column>
      </form>
    </Dialog>
  );
}
