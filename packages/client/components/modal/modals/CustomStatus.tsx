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
  typography,
} from "@revolt/ui";
import { CompositionMediaPicker } from "@revolt/ui/components/features/messaging/composition/picker/CompositionMediaPicker";
import { Icon } from "@revolt/ui/icons/Icon";
import { createFormControl, createFormGroup } from "solid-forms";
import { For, Show, createSignal, onCleanup, untrack } from "solid-js";
import { css } from "styled-system/css";
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
  // the time alone today, the day and time when it ends on another day
  const keptTime = () => {
    if (!keptExpiry) return "";
    const at = new Date(keptExpiry);
    const today = at.toDateString() === new Date().toDateString();
    return at.toLocaleString(undefined, {
      ...(today ? {} : { weekday: "short", day: "numeric", month: "short" }),
      hour: "2-digit",
      minute: "2-digit",
    });
  };
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
            <Form2.TextField
              maxlength={128}
              counter
              name="text"
              control={group.controls.text}
              label={t`Custom status`}
            />
            <ChoiceRow>
              <CompositionMediaPicker
                closeOnPick
                placement="bottom-start"
                onMessage={() => undefined}
                onTextReplacement={(text) =>
                  setEmoji(tagEmojiFromPicker(text) || undefined)
                }
              >
                {(picker) => (
                  <span ref={picker.ref} class={anchor}>
                    <IconButton
                      variant="outlined"
                      size="sm"
                      data-testid="status-emoji"
                      aria-label={
                        emoji()
                          ? t`Change the status emoji`
                          : t`Choose an emoji`
                      }
                      onPress={(event) => picker.onClickEmoji(event)}
                    >
                      <Show
                        when={emoji()}
                        fallback={<Icon name="smiley" size={20} />}
                      >
                        <Emoji emoji={emoji()!} />
                      </Show>
                    </IconButton>
                  </span>
                )}
              </CompositionMediaPicker>
              <Show when={emoji()}>
                <IconButton
                  variant="toolbar"
                  size="sm"
                  aria-label={t`Remove the emoji`}
                  onPress={() => setEmoji(undefined)}
                >
                  <Icon name="x" size={16} />
                </IconButton>
              </Show>
              <SelectGrow>
                <FloatingSelect
                  label={t`Clear after`}
                  value={expiry()}
                  data-testid="status-expiry"
                  onChange={(event) =>
                    setExpiry(
                      event.currentTarget.value as StatusExpiry | "keep",
                    )
                  }
                >
                  {/* the select reads its items as elements: no <Show> here */}
                  <For each={choices}>
                    {(choice) => (
                      <MenuItem value={choice}>{expiryLabel(choice)}</MenuItem>
                    )}
                  </For>
                </FloatingSelect>
              </SelectGrow>
            </ChoiceRow>
          </Column>
        </fieldset>
        <Show when={error()}>
          <p
            role="alert"
            class={typography({ class: "body", size: "small" })}
            style={{
              color: "var(--z-status-error)",
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

const ChoiceRow = styled("div", {
  base: {
    display: "flex",
    // the buttons line up with the select, not with its label
    alignItems: "flex-end",
    gap: "8px",
    minWidth: 0,
  },
});

const SelectGrow = styled("div", {
  base: { flex: 1, minWidth: 0 },
});

/** The picker opens beside this box: the button itself takes no ref */
const anchor = css({
  display: "inline-flex",
  flexShrink: 0,
  "& img": { inlineSize: "20px", blockSize: "20px" },
  fontSize: "20px",
});
