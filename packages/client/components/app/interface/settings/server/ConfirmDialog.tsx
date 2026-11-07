import { type JSX, Show, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";

import { useError } from "@revolt/i18n";
import { Dialog } from "@revolt/ui";

/**
 * "Are you sure?" before something that can't be taken back (deleting a
 * filter rule or an invite, lifting a ban). If it fails, the reason shows
 * here in plain words and the dialog stays open.
 */
export function ConfirmDialog(props: {
  title: JSX.Element;
  children: JSX.Element;
  confirm: JSX.Element;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const describeError = useError();
  const [error, setError] = createSignal<string>();

  async function run() {
    setError(undefined);
    try {
      await props.onConfirm();
    } catch (err) {
      setError(describeError(err));
      // a rejected action keeps the dialog open (a resolved one closes it)
      throw err;
    }
  }

  return (
    <Dialog
      show
      tone="danger"
      size="sm"
      onClose={props.onClose}
      title={props.title}
      actions={[
        { text: <Trans>Cancel</Trans> },
        { text: props.confirm, variant: "destructive", onClick: run },
      ]}
    >
      {props.children}
      <Show when={error()}>
        <span role="alert">{error()}</span>
      </Show>
    </Dialog>
  );
}
