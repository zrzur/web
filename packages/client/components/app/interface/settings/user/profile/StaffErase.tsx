import { createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import { Dialog, TextField } from "@revolt/ui";

import { communityApi } from "./communityApi";

/** The longest reason the server keeps */
const MAX_REASON = 500;

/** The server's answer as an object, so "Details" shows its type */
const parsed = (failure: unknown) => {
  if (typeof failure !== "string") return failure;
  try {
    return JSON.parse(failure) as unknown;
  } catch {
    return failure;
  }
};

/**
 * Staff (`cosmetics.manage_all`) delete anyone's design for good. A reason
 * is required: the creator gets it with a statement they can appeal. The
 * server checks the permission again.
 */
export function StaffEraseDialog(props: {
  show: boolean;
  item: { _id: string; name: string; version?: number | null };
  onClose: () => void;
  onErased: (id: string) => void;
}) {
  const { t } = useLingui();
  const client = useClient();
  const [reason, setReason] = createSignal("");
  const [missing, setMissing] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [failure, setFailure] = createSignal<unknown>();

  const close = () => {
    if (busy()) return;
    setReason("");
    setMissing(false);
    setFailure(undefined);
    props.onClose();
  };

  async function erase() {
    if (!reason().trim()) {
      setMissing(true);
      return false;
    }
    const id = props.item._id;
    setBusy(true);
    setFailure(undefined);
    try {
      await communityApi.erase(
        client(),
        id,
        reason(),
        props.item.version ?? undefined,
      );
      setReason("");
      props.onErased(id);
    } catch (error) {
      setFailure(parsed(error));
    } finally {
      setBusy(false);
    }
    return false;
  }

  return (
    <Dialog
      show={props.show}
      onClose={close}
      tone="danger"
      persistent={!!reason()}
      title={<Trans>Delete this design for everyone?</Trans>}
      actions={[
        { text: <Trans>Cancel</Trans>, onClick: () => void close() },
        {
          text: <Trans>Delete for everyone</Trans>,
          variant: "destructive",
          isLoading: busy(),
          // the dialog stays open: a missing reason or a refusal shows in it,
          // and the caller closes it once the design is gone
          onClick: () => {
            void erase();
            return false;
          },
        },
      ]}
      isDisabled={busy()}
      error={
        failure() !== undefined ? (
          <div role="alert" data-testid="staff-erase-error">
            <TranslatedError error={failure()} />
          </div>
        ) : undefined
      }
    >
      <Body data-testid="staff-erase-dialog">
        <p>
          <Trans>
            <bdi>{props.item.name}</bdi> and its image are deleted for good,
            from Designs and from everyone wearing it. This can't be undone.
          </Trans>
        </p>
        <p>
          <Trans>
            The creator is told why, with a statement of reasons they can
            appeal.
          </Trans>
        </p>
        <TextField
          rows={3}
          label={t`Reason for the creator`}
          helper={t`Required. The creator sees it in the notice.`}
          error={missing() && t`Write a reason first. The creator will see it.`}
          maxlength={MAX_REASON}
          counter
          value={reason()}
          dir="auto"
          data-testid="staff-erase-reason"
          onInput={(event) => {
            setReason(event.currentTarget.value);
            if (event.currentTarget.value.trim()) setMissing(false);
          }}
        />
      </Body>
    </Dialog>
  );
}

const Body = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    "& p": {
      margin: 0,
      fontSize: "14px",
      lineHeight: "22px",
      color: "var(--z-fg-secondary)",
      overflowWrap: "anywhere",
    },
  },
});
