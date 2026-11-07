import { createFormControl, createFormGroup } from "solid-forms";
import { createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { PublicChannelInvite } from "@zrzur/sdk/solid";

import { translatedError } from "@revolt/i18n";
import { Column, Dialog, DialogProps, Form2, Text } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";

import { parseInviteCode } from "./inviteLink";

/**
 * Paste a code or invite URL, then open the invite preview (same as /invite/:code).
 * Replaces the old post-without-preview path (TODO). Group invites show an error until supported.
 * Callers: CreateOrJoinServer hub. Schemas: GET/POST /invites/:code via PublicChannelInvite.
 */
export function JoinServerModal(
  props: DialogProps & Modals & { type: "join_server" },
) {
  const { t } = useLingui();
  const { showError, openModal } = useModals();
  const [pending, setPending] = createSignal(false);

  const group = createFormGroup({
    link: createFormControl("", { required: true }),
  });

  async function onSubmit() {
    if (pending()) return;
    setPending(true);
    try {
      const code = parseInviteCode(group.controls.link.value);
      if (!code) {
        showError(translatedError(t`This is not a valid invite link or code.`));
        return;
      }

      const data = await props.client.api.get(`/invites/${code as ""}`);
      const invite = PublicChannelInvite.from(props.client, data);

      if (invite.type !== "Server") {
        showError(translatedError(t`This invite is not for a server.`));
        return;
      }

      props.onClose();
      openModal({ type: "invite", invite });
    } catch (error) {
      showError(error);
    } finally {
      setPending(false);
    }
  }

  const submit = Form2.useSubmitHandler(group, onSubmit);

  return (
    <Dialog
      tone="invite"
      iconName="sign-in"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Join a server</Trans>}
      actions={[
        { text: <Trans>Close</Trans> },
        {
          text: <Trans>Continue</Trans>,
          onClick: () => {
            onSubmit();
            return false;
          },
          isDisabled: !Form2.canSubmit(group) || pending(),
        },
      ]}
      isDisabled={pending() || group.isPending}
    >
      <form onSubmit={submit}>
        <Column>
          <Text>
            <Trans>Use a code or invite link</Trans>
          </Text>
          <Form2.TextField
            name="link"
            control={group.controls.link}
            label={t`Code`}
            placeholder="invite/abc123"
          />
        </Column>
      </form>
    </Dialog>
  );
}
