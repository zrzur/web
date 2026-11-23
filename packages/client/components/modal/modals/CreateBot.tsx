import { createFormControl, createFormGroup } from "solid-forms";
import { For, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { styled } from "styled-system/jsx";

import { Checkbox, Column, Dialog, DialogProps, Form2, Text } from "@revolt/ui";

import { Modals } from "../types";
import { BotNameField, botNameBlocks } from "./BotNameField";

/**
 * Create a new bot
 */
export function CreateBotModal(
  props: DialogProps & Modals & { type: "create_bot" },
) {
  const { t } = useLingui();

  const [accepted, setAccepted] = createSignal(false);
  // shown in this dialog, not in a second one on top of it
  const [error, setError] = createSignal<unknown>();

  /** Bot rules; creating a bot needs them read and accepted */
  const rules = () => [
    t`No spam: send messages only when people ask for them or expect them.`,
    t`Collect only the data your bot needs, say what it keeps, and delete it when asked.`,
    t`Never pretend to be a person, the Zrzur team, or another app.`,
    t`Follow each server's own rules and never get around permissions.`,
    t`Keep the token secret. You are responsible for everything your bot does.`,
  ];

  const group = createFormGroup({
    username: createFormControl("", { required: true }),
  });

  async function onSubmit() {
    if (!accepted() || botNameBlocks(group.controls.username.value)) return;
    setError(undefined);
    try {
      const bot = await props.client.bots.createBot(
        group.controls.username.value,
      );

      props.onCreate(bot);
      props.onClose();
    } catch (failure) {
      setError(failure);
    }
  }

  const submit = Form2.useSubmitHandler(group, onSubmit);

  return (
    <Dialog
      tone="create"
      iconName="robot"
      appearance="creation"
      showClose={false}
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Create a new bot</Trans>}
      actions={[
        { variant: "text", text: <Trans>Cancel</Trans> },
        {
          text: <Trans>Create</Trans>,
          onClick: () => {
            onSubmit();
            return false;
          },
          isDisabled:
            !Form2.canSubmit(group) ||
            !accepted() ||
            botNameBlocks(group.controls.username.value),
        },
      ]}
      isDisabled={group.isPending}
    >
      <form onSubmit={submit}>
        <Column>
          <BotNameField control={group.controls.username} error={error()} />
          <Text>
            <Trans>Bot rules</Trans>
          </Text>
          <Rules>
            <For each={rules()}>{(rule) => <li>{rule}</li>}</For>
          </Rules>
          <Checkbox
            checked={accepted()}
            onChange={(e) => setAccepted(e.currentTarget.checked)}
          >
            <Trans>
              I have read the bot rules and the{" "}
              <a
                href="https://zrzur.com/legal/developer-terms"
                target="_blank"
                rel="noreferrer"
              >
                Developer Terms
              </a>{" "}
              and I accept them.
            </Trans>
          </Checkbox>
        </Column>
      </form>
    </Dialog>
  );
}

const Rules = styled("ol", {
  base: {
    margin: 0,
    paddingInlineStart: "20px",
    listStyle: "decimal",
    "& li::marker": { color: "var(--z-fg-muted)" },
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    fontSize: "14px",
    lineHeight: 1.45,
    color: "var(--z-fg-secondary)",
  },
});
