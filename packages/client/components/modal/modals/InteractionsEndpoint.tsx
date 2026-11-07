import { Show, createSignal, onMount } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { Button, Dialog, DialogProps, TextField, useSnackbar } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Where a bot receives interactions over HTTP: its signing secret, shown
 * once, and its address, which the server tests before saving.
 */
export function InteractionsEndpointModal(
  props: DialogProps & Modals & { type: "interactions_endpoint" },
) {
  const client = useClient();
  const snackbar = useSnackbar();
  const { t } = useLingui();
  const { showError, mfaFlow } = useModals();

  const [url, setUrl] = createSignal("");
  const [saved, setSaved] = createSignal<string>();
  const [hasSecret, setHasSecret] = createSignal(false);
  const [secret, setSecret] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);
  const [justSaved, setJustSaved] = createSignal(false);
  const [replacing, setReplacing] = createSignal(false);
  const [problem, setProblem] = createSignal<string>();
  const [details, setDetails] = createSignal<string>();

  onMount(async () => {
    try {
      const { bot } = await client().api.get(`/bots/${props.bot.id}`);
      setSaved(bot.interactions_endpoint ?? undefined);
      setUrl(bot.interactions_endpoint ?? "");
      setHasSecret((bot.interactions_secret_version ?? 0) > 0);
    } catch (error) {
      showError(error);
    }
  });

  /** A refused address in plain words; the code stays under "Details" */
  function explain(error: unknown) {
    const { type, reason } = error as { type?: string; reason?: string };
    // sent as it is, so it is not part of what is translated
    const pong = '{"type":"Pong"}';
    const reasons: Record<string, string> = {
      invalid_url: t`Enter a plain https:// address.`,
      blocked_address: t`This address is private or blocked. Use a public address.`,
      not_reachable: t`Nothing answered at this address. Check that your server is running and public.`,
      timed_out: t`Your server took longer than 3 seconds to answer.`,
      accepts_bad_signatures: t`Your server accepted a request with a wrong signature. Check signatures and answer 401.`,
      bad_status: t`Your server did not answer the test request with 200.`,
      bad_answer: t`Your server did not answer the test request with ${pong}.`,
      answer_too_large: t`Your server's answer was too large.`,
    };
    if (type === "SignedDeliveryRejected" && reason && reasons[reason]) {
      setProblem(reasons[reason]);
      setDetails(reason);
    } else if (type === "FeatureDisabled") {
      setProblem(t`This server does not offer HTTP interactions.`);
      setDetails(type);
    } else {
      setProblem(t`That didn't work. Try again in a moment.`);
      setDetails(type);
    }
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setProblem(undefined);
    setDetails(undefined);
    setJustSaved(false);
    try {
      await action();
    } catch (error) {
      explain(error);
    } finally {
      setBusy(false);
    }
  }

  const makeSecret = () =>
    run(async () => {
      const ticket = await mfaFlow(await client().account.mfa());
      // closing the confirmation leaves the secret as it is
      if (!ticket) return;
      ticket._consume();
      const created = await client().api.post(
        `/bots/${props.bot.id}/interactions/secret`,
        undefined,
        { headers: { "X-MFA-Ticket": ticket.token } },
      );
      setSecret(created.secret);
      setHasSecret(true);
      setReplacing(false);
    });

  const save = () =>
    run(async () => {
      // this address will receive what people type
      const ticket = await mfaFlow(await client().account.mfa());
      if (!ticket) return;
      ticket._consume();
      const bot = await client().api.put(
        `/bots/${props.bot.id}/interactions/endpoint`,
        { url: url().trim() },
        { headers: { "X-MFA-Ticket": ticket.token } },
      );
      setSaved(bot.interactions_endpoint ?? undefined);
      setJustSaved(true);
    });

  const remove = () =>
    run(async () => {
      await client().api.delete(`/bots/${props.bot.id}/interactions/endpoint`);
      setSaved(undefined);
      setUrl("");
    });

  const copySecret = () => {
    navigator.clipboard.writeText(secret()!);
    snackbar.show({
      message: t`Secret copied to clipboard`,
      placement: "bottom",
      closeable: true,
    });
  };

  return (
    <Dialog
      iconName="link"
      size="sm"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>HTTP interactions</Trans>}
      actions={[
        { text: <Trans>Close</Trans>, variant: "text" },
        ...(saved()
          ? [
              {
                text: <Trans>Remove address</Trans>,
                variant: "destructive" as const,
                isLoading: busy(),
                onClick: () => {
                  void remove();
                  return false;
                },
              },
            ]
          : []),
        {
          text: replacing() ? (
            <Trans>Replace secret</Trans>
          ) : hasSecret() ? (
            <Trans>New secret</Trans>
          ) : (
            <Trans>Make secret</Trans>
          ),
          variant: replacing()
            ? ("destructive" as const)
            : ("secondary" as const),
          isLoading: busy(),
          onClick: () => {
            // the secret in use stops working at once: say so first
            if (hasSecret() && !replacing()) setReplacing(true);
            else void makeSecret();
            return false;
          },
        },
        {
          text: <Trans>Test and save</Trans>,
          variant: "primary" as const,
          isLoading: busy(),
          isDisabled: !hasSecret() || !url().trim(),
          onClick: () => {
            void save();
            return false;
          },
        },
      ]}
    >
      <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
        <p style={{ margin: 0 }}>
          <Trans>
            Commands, buttons and forms go to your server instead of the
            gateway. It must check our signature.
          </Trans>
        </p>
        <TextField
          dir="ltr"
          value={url()}
          variant="filled"
          label={t`Address`}
          placeholder="https://bot.example.com/interactions"
          onInput={(e) => setUrl(e.currentTarget.value)}
        />
        <Show when={replacing()}>
          <p role="alert" style={{ margin: 0, color: "var(--z-danger)" }}>
            <Trans>
              The current secret stops working at once. Your server fails every
              check until it has the new one.
            </Trans>
          </p>
        </Show>
        <Show when={secret()}>
          <p style={{ margin: 0 }}>
            <Trans>
              Copy it now and keep it secret. Zrzur can't show it again.
            </Trans>
          </p>
          <code
            dir="ltr"
            data-testid="interactions-secret"
            style={{
              display: "block",
              "word-break": "break-all",
              padding: "8px 12px",
              "border-radius": "8px",
              background: "var(--z-bg-input)",
              "user-select": "all",
            }}
          >
            {secret()}
          </code>
          <div>
            <Button size="sm" variant="tonal" onPress={copySecret}>
              <Trans>Copy secret</Trans>
            </Button>
          </div>
        </Show>
        <Show when={justSaved()}>
          <p role="status" style={{ margin: 0 }}>
            <Trans>Address saved. Interactions now go to your server.</Trans>
          </p>
        </Show>
        <Show when={problem()}>
          <div role="alert" style={{ color: "var(--z-danger)" }}>
            {problem()}
            <Show when={details()}>
              <details>
                <summary>
                  <Trans>Details</Trans>
                </summary>
                <code dir="ltr">{details()}</code>
              </details>
            </Show>
          </div>
        </Show>
      </div>
    </Dialog>
  );
}
