import { Trans, useLingui } from "@lingui/solid/macro";
import { useError } from "@revolt/i18n";
import { Column, Dialog, DialogProps, Form2 } from "@revolt/ui";
import { createFormControl, createFormGroup } from "solid-forms";
import { createSignal, onCleanup, Show, untrack } from "solid-js";
import {
  customStatusPatch,
  writeStatusWithRetry,
} from "../../common/lib/statusWrite";
import { Modals } from "../types";

/** Edit only custom text; never overwrite the account's presence selection. */
export function CustomStatusModal(
  props: DialogProps & Modals & { type: "custom_status" },
) {
  const { t } = useLingui();
  const translateError = useError();
  const group = createFormGroup({
    // Snapshot on open; incoming presence events must not replace a draft.
    text: createFormControl(
      untrack(() => props.client.user?.status?.text ?? ""),
    ),
  });
  const [saving, setSaving] = createSignal(false);
  const [retrying, setRetrying] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const cancellation = new AbortController();
  onCleanup(() => cancellation.abort());

  async function save() {
    if (saving()) return;
    const account = props.client.user;
    if (!account) return;
    const patch = customStatusPatch(group.controls.text.value);
    setSaving(true);
    setError(undefined);
    try {
      await writeStatusWithRetry(() => account.edit(patch), {
        signal: cancellation.signal,
        retrying: setRetrying,
      });
      if (!cancellation.signal.aborted) props.onClose();
    } catch (failure) {
      if (!cancellation.signal.aborted)
        setError(
          translateError(failure) ||
            t`Couldn't update your status. Please try again.`,
        );
    } finally {
      if (!cancellation.signal.aborted) setSaving(false);
    }
  }
  return (
    <Dialog
      tone="edit"
      iconName="smiley"
      show={props.show}
      onClose={() => {
        cancellation.abort();
        props.onClose();
      }}
      title={<Trans>Set your status</Trans>}
      actions={[
        { text: <Trans>Close</Trans> },
        {
          text: saving() ? (
            retrying() ? (
              t`Retrying…`
            ) : (
              t`Saving…`
            )
          ) : (
            <Trans>Save</Trans>
          ),
          onClick: () => {
            void save();
            return false;
          },
          isDisabled: saving() || !group.isValid,
        },
      ]}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset
          disabled={saving()}
          style={{ border: 0, margin: 0, padding: 0, "min-width": 0 }}
        >
          <Column>
            <Form2.TextField
              maxlength={128}
              counter
              name="text"
              control={group.controls.text}
              label={t`Custom status`}
            />
          </Column>
        </fieldset>
        <Show when={error()}>
          <p
            role="alert"
            style={{
              color: "var(--z-status-error)",
              "font-size": "13px",
              "margin-top": "12px",
            }}
          >
            {error()}
          </p>
        </Show>
      </form>
    </Dialog>
  );
}
