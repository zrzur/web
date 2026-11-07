import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { Dialog, DialogProps, useSnackbar } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Reset a bot's token. The owner signs in again first (password or code);
 * the new token is shown once here, since Zrzur only keeps a hash of it.
 */
export function ResetBotTokenModal(
  props: DialogProps & Modals & { type: "reset_bot_token" },
) {
  const client = useClient();
  const snackbar = useSnackbar();
  const { t } = useLingui();
  const { showError, mfaFlow } = useModals();
  const [token, setToken] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);

  async function reset() {
    setBusy(true);
    try {
      const ticket = await mfaFlow(await client().account.mfa());
      // closing or cancelling the confirmation leaves the token as it is
      if (!ticket) return;
      ticket._consume();
      const bot = await client().api.post(
        `/bots/${props.bot.id}/token/reset`,
        undefined,
        { headers: { "X-MFA-Ticket": ticket.token } },
      );
      setToken(bot.token);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  const copy = () => {
    navigator.clipboard.writeText(token()!);
    snackbar.show({
      message: t`Token copied to clipboard`,
      placement: "bottom",
      closeable: true,
    });
  };

  return (
    <Dialog
      tone={token() ? undefined : "danger"}
      iconName="key"
      size="sm"
      show={props.show}
      onClose={props.onClose}
      title={
        token() ? (
          <Trans>Your new token</Trans>
        ) : (
          <Trans>Reset {props.bot.user!.username}'s token?</Trans>
        )
      }
      actions={
        token()
          ? [
              {
                text: <Trans>Copy token</Trans>,
                variant: "secondary",
                onClick: () => {
                  copy();
                  return false;
                },
              },
              { text: <Trans>Done</Trans>, variant: "primary" },
            ]
          : [
              { text: <Trans>Cancel</Trans>, variant: "text" },
              {
                text: <Trans>Reset</Trans>,
                variant: "destructive",
                isLoading: busy(),
                onClick: () => {
                  void reset();
                  return false;
                },
              },
            ]
      }
    >
      <Show
        when={token()}
        fallback={
          <Trans>
            This will invalidate the current token and stop any existing
            instances of the bot from running.
          </Trans>
        }
      >
        <p style={{ margin: "0 0 12px" }}>
          <Trans>
            Copy it now and keep it secret. Zrzur can't show it again.
          </Trans>
        </p>
        <code
          dir="ltr"
          style={{
            display: "block",
            "word-break": "break-all",
            padding: "8px 12px",
            "border-radius": "8px",
            background: "var(--z-bg-input)",
            "user-select": "all",
          }}
        >
          {token()}
        </code>
      </Show>
    </Dialog>
  );
}
