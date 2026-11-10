import { Trans, useLingui } from "@lingui/solid/macro";
import { tagEmojiFromPicker } from "@revolt/app/interface/settings/channel/tagEmoji";
import { useError } from "@revolt/i18n";
import { Emoji } from "@revolt/markdown/emoji";
import {
  Column,
  Dialog,
  DialogProps,
  FloatingSelect,
  Form2,
  IconButton,
  MenuItem,
} from "@revolt/ui";
import { CompositionMediaPicker } from "@revolt/ui/components/features/messaging/composition/picker/CompositionMediaPicker";
import { Icon } from "@revolt/ui/icons/Icon";
import { createFormControl, createFormGroup } from "solid-forms";
import { For, Show, createSignal, onCleanup, untrack } from "solid-js";
import { styled } from "styled-system/jsx";
import {
  type StatusExpiry,
  STATUS_EXPIRIES,
  customStatusPatch,
} from "../../common/lib/statusPatch";
import { writeStatusWithRetry } from "../../common/lib/statusWrite";
import { Modals } from "../types";

/**
 * Set the custom status: an optional emoji, the text, and when it clears
 * itself. Never overwrites the account's presence selection.
 */
export function CustomStatusModal(
  props: DialogProps & Modals & { type: "custom_status" },
) {
  const { t } = useLingui();
  const translateError = useError();
  // Snapshot on open; incoming presence events must not replace a draft.
  const initial = untrack(() => props.client.user?.status);
  const group = createFormGroup({
    text: createFormControl(initial?.text ?? ""),
  });
  const [emoji, setEmoji] = createSignal<string | undefined>(
    initial?.emoji ?? undefined,
  );
  // an expiry already set stays unless another choice is made
  const keptExpiry = initial?.expires_at ?? undefined;
  const [expiry, setExpiry] = createSignal<StatusExpiry | "keep">(
    keptExpiry ? "keep" : "never",
  );
  const choices: (StatusExpiry | "keep")[] = keptExpiry
    ? ["keep", ...STATUS_EXPIRIES]
    : STATUS_EXPIRIES;
  const keptTime = () =>
    keptExpiry
      ? new Date(keptExpiry).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
  const [saving, setSaving] = createSignal(false);
  const [retrying, setRetrying] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const cancellation = new AbortController();
  onCleanup(() => cancellation.abort());

  const expiryLabel = (choice: StatusExpiry | "keep") => {
    switch (choice) {
      case "keep":
        return t`Keep: until ${keptTime()}`;
      case "30m":
        return t`30 minutes`;
      case "1h":
        return t`1 hour`;
      case "4h":
        return t`4 hours`;
      case "today":
        return t`Today`;
      default:
        return t`Never`;
    }
  };

  async function save() {
    if (saving()) return;
    const account = props.client.user;
    if (!account) return;
    const choice = expiry();
    const patch = customStatusPatch(group.controls.text.value, {
      emoji: emoji(),
      expiry: choice === "keep" ? "never" : choice,
      keepExpiresAt: choice === "keep" ? keptExpiry : undefined,
    });
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
            <TextRow>
              <CompositionMediaPicker
                closeOnPick
                placement="bottom-start"
                onMessage={() => undefined}
                onTextReplacement={(text) =>
                  setEmoji(tagEmojiFromPicker(text) || undefined)
                }
              >
                {(picker) => (
                  <EmojiButton
                    ref={picker.ref}
                    type="button"
                    data-testid="status-emoji"
                    aria-label={
                      emoji() ? t`Change the status emoji` : t`Choose an emoji`
                    }
                    onClick={(event) => picker.onClickEmoji(event)}
                  >
                    <Show
                      when={emoji()}
                      fallback={<Icon name="smiley" size={20} />}
                    >
                      <Emoji emoji={emoji()!} />
                    </Show>
                  </EmojiButton>
                )}
              </CompositionMediaPicker>
              <TextGrow>
                <Form2.TextField
                  maxlength={128}
                  counter
                  name="text"
                  control={group.controls.text}
                  label={t`Custom status`}
                />
              </TextGrow>
              <Show when={emoji()}>
                <IconButton
                  variant="toolbar"
                  size="xs"
                  aria-label={t`Remove the emoji`}
                  onPress={() => setEmoji(undefined)}
                >
                  <Icon name="x" size={16} />
                </IconButton>
              </Show>
            </TextRow>
            <FloatingSelect
              label={t`Clear after`}
              value={expiry()}
              data-testid="status-expiry"
              onChange={(event) =>
                setExpiry(event.currentTarget.value as StatusExpiry | "keep")
              }
            >
              {/* the select reads its items as elements: no empty <Show> here */}
              <For each={choices}>
                {(choice) => (
                  <MenuItem value={choice}>{expiryLabel(choice)}</MenuItem>
                )}
              </For>
            </FloatingSelect>
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

const TextRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    minWidth: 0,
  },
});

const TextGrow = styled("div", {
  base: { flex: 1, minWidth: 0 },
});

const EmojiButton = styled("button", {
  base: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    inlineSize: "40px",
    blockSize: "40px",
    marginBlockStart: "20px",
    borderRadius: "var(--z-radius-sm)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-input)",
    color: "var(--z-fg-secondary)",
    cursor: "pointer",
    fontSize: "20px",
    "& img": { inlineSize: "20px", blockSize: "20px" },
    "&:hover": { borderColor: "var(--z-border-strong)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { inlineSize: "44px", blockSize: "44px" },
  },
});
