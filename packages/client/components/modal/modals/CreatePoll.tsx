import { For, Show, createSignal } from "solid-js";
import { createStore } from "solid-js/store";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";
import { ulid } from "ulid";

import {
  type DraftAnswer,
  ANSWERS_MAX,
  ANSWER_MAX,
  POLL_DURATIONS,
  QUESTION_MAX,
  draftProblem,
  moveItem,
  toDataPoll,
} from "@revolt/app/interface/channels/text/poll/pollModel";
import { tagEmojiFromPicker } from "@revolt/app/interface/settings/channel/tagEmoji";
import { ContextMenu, ContextMenuButton } from "@revolt/app/menus/ContextMenu";
import Breakpoint from "@revolt/common/Breakpoint";
import { TranslatedError } from "@revolt/i18n/errors";
import { Emoji } from "@revolt/markdown/emoji";
import {
  Button,
  Dialog,
  DialogProps,
  FloatingSelect,
  IconButton,
  MenuItem,
  TextField,
  Toggle,
} from "@revolt/ui";
import { CompositionMediaPicker } from "@revolt/ui/components/features/messaging/composition/picker/CompositionMediaPicker";
import { Icon } from "@revolt/ui/icons/Icon";

import { Modals } from "../types";

/**
 * Write a poll: a question, two to ten answers (each may have an emoji, and
 * can be moved up or down), how long it stays open and whether people may
 * pick more than one answer. A preview shows it as it will look.
 *
 * Answer rows live in a store changed by path, so typing never rebuilds a
 * row and the field keeps its focus.
 */
export function CreatePollModal(
  props: DialogProps & Modals & { type: "create_poll" },
) {
  const { t } = useLingui();

  const [question, setQuestion] = createSignal("");
  const [answers, setAnswers] = createStore<DraftAnswer[]>([
    { key: ulid(), text: "" },
    { key: ulid(), text: "" },
  ]);
  const [duration, setDuration] = createSignal<number>(24);
  const [multiple, setMultiple] = createSignal(false);
  const [error, setError] = createSignal<unknown>();
  const [sending, setSending] = createSignal(false);
  const [tried, setTried] = createSignal(false);

  // one key for this window: a double press or a retry sends once
  let idempotencyKey = ulid();

  const problem = () => draftProblem(question(), answers);
  const phone = window.matchMedia(Breakpoint.phone).matches;

  const durationLabel = (hours: number) => {
    switch (hours) {
      case 1:
        return t`1 hour`;
      case 4:
        return t`4 hours`;
      case 8:
        return t`8 hours`;
      case 24:
        return t`24 hours`;
      case 72:
        return t`3 days`;
      case 168:
        return t`1 week`;
      default:
        return t`2 weeks`;
    }
  };

  const problemText = () => {
    switch (problem()) {
      case "question":
        return t`Write a question.`;
      case "answers":
        return t`Add at least two answers.`;
      case "answer":
        return t`An answer can be at most ${ANSWER_MAX} characters.`;
      default:
        return undefined;
    }
  };

  function addAnswer() {
    if (answers.length >= ANSWERS_MAX) return;
    const index = answers.length;
    setAnswers(index, { key: ulid(), text: "" });
    // focus the new row's field once it is drawn
    queueMicrotask(() =>
      document
        .querySelector<HTMLInputElement>(`[data-poll-answer="${index}"] input`)
        ?.focus(),
    );
  }

  function removeAnswer(index: number) {
    if (answers.length <= 2) {
      setAnswers(index, { text: "", emoji: undefined });
      return;
    }
    setAnswers((list) => list.filter((_, i) => i !== index));
  }

  function move(index: number, step: number) {
    setAnswers((list) => moveItem([...list], index, index + step));
  }

  async function send() {
    setTried(true);
    if (problem() || sending()) return;
    setSending(true);
    setError(undefined);
    try {
      await props.channel.sendMessage(
        {
          poll: toDataPoll(question(), answers, duration(), multiple()),
        },
        idempotencyKey,
      );
      props.onClose();
    } catch (err) {
      setError(err);
      idempotencyKey = ulid();
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      tone="create"
      iconName="list-checks"
      size="md"
      show={props.show}
      onClose={props.onClose}
      persistent={!!question() || answers.some((a) => a.text)}
      title={<Trans>Create poll</Trans>}
      description={
        <Trans>Ask a question and let people vote. Results update live.</Trans>
      }
      actions={[
        { variant: "text", text: <Trans>Cancel</Trans> },
        {
          text: <Trans>Post poll</Trans>,
          onClick: () => {
            void send();
            return false;
          },
          isLoading: sending(),
        },
      ]}
      isDisabled={sending()}
      error={
        <Show when={error() || (tried() && problemText())}>
          <Show when={error()} fallback={problemText()}>
            <TranslatedError error={error()} />
          </Show>
        </Show>
      }
    >
      <Fields data-testid="create-poll">
        <TextField
          variant="filled"
          autoFocus
          label={t`Question`}
          placeholder={t`What do you want to ask?`}
          maxlength={QUESTION_MAX}
          counter
          value={question()}
          onInput={(event) => setQuestion(event.currentTarget.value)}
          data-testid="poll-question"
        />

        <Group role="group" aria-labelledby="poll-answers-label">
          <Label id="poll-answers-label">
            <Trans>Answers</Trans>
          </Label>
          <For each={answers}>
            {(answer, index) => (
              <AnswerRow data-poll-answer={index()}>
                <CompositionMediaPicker
                  channel={props.channel}
                  closeOnPick
                  placement="bottom-start"
                  onMessage={() => undefined}
                  onTextReplacement={(text) =>
                    setAnswers(index(), "emoji", tagEmojiFromPicker(text))
                  }
                >
                  {(picker) => (
                    <EmojiButton
                      ref={picker.ref}
                      type="button"
                      aria-label={
                        answer.emoji
                          ? t`Change the emoji of answer ${index() + 1}`
                          : t`Choose an emoji for answer ${index() + 1}`
                      }
                      onClick={(event) => picker.onClickEmoji(event)}
                    >
                      <Show
                        when={answer.emoji}
                        fallback={<Icon name="smiley" size={20} />}
                      >
                        <Emoji emoji={answer.emoji!} />
                      </Show>
                    </EmojiButton>
                  )}
                </CompositionMediaPicker>
                <AnswerField>
                  <TextField
                    variant="filled"
                    value={answer.text}
                    maxlength={ANSWER_MAX}
                    placeholder={t`Answer ${index() + 1}`}
                    aria-label={t`Answer ${index() + 1}`}
                    onInput={(event) =>
                      setAnswers(index(), "text", event.currentTarget.value)
                    }
                    onKeyDown={(event: KeyboardEvent) => {
                      if (event.key === "Enter" && !event.isComposing) {
                        event.preventDefault();
                        if (index() === answers.length - 1) addAnswer();
                      }
                    }}
                  />
                </AnswerField>
                <Show
                  when={!phone}
                  fallback={
                    /* phones: one 44 px button opens the row's actions */
                    <div
                      style={{ display: "contents" }}
                      use:floating={{
                        contextMenu: () => (
                          <ContextMenu>
                            <Show when={index() > 0}>
                              <ContextMenuButton
                                icon={<Icon name="caret-up" size={20} />}
                                onClick={() => move(index(), -1)}
                              >
                                {t`Move up`}
                              </ContextMenuButton>
                            </Show>
                            <Show when={index() < answers.length - 1}>
                              <ContextMenuButton
                                icon={<Icon name="caret-down" size={20} />}
                                onClick={() => move(index(), 1)}
                              >
                                {t`Move down`}
                              </ContextMenuButton>
                            </Show>
                            <ContextMenuButton
                              icon={<Icon name="x" size={20} />}
                              onClick={() => removeAnswer(index())}
                            >
                              {t`Remove`}
                            </ContextMenuButton>
                          </ContextMenu>
                        ),
                        contextMenuHandler: "click",
                      }}
                    >
                      <IconButton
                        variant="toolbar"
                        size="sm"
                        aria-haspopup="menu"
                        aria-label={t`Actions for answer ${index() + 1}`}
                      >
                        <Icon name="dots-three-vertical" size={20} />
                      </IconButton>
                    </div>
                  }
                >
                  <RowTools>
                    <IconButton
                      variant="toolbar"
                      size="xs"
                      aria-label={t`Move answer ${index() + 1} up`}
                      isDisabled={index() === 0}
                      onPress={() => move(index(), -1)}
                    >
                      <Icon name="caret-up" size={16} />
                    </IconButton>
                    <IconButton
                      variant="toolbar"
                      size="xs"
                      aria-label={t`Move answer ${index() + 1} down`}
                      isDisabled={index() === answers.length - 1}
                      onPress={() => move(index(), 1)}
                    >
                      <Icon name="caret-down" size={16} />
                    </IconButton>
                    <IconButton
                      variant="toolbar"
                      size="xs"
                      aria-label={t`Remove answer ${index() + 1}`}
                      onPress={() => removeAnswer(index())}
                    >
                      <Icon name="x" size={16} />
                    </IconButton>
                  </RowTools>
                </Show>
              </AnswerRow>
            )}
          </For>
          <Show when={answers.length < ANSWERS_MAX}>
            <div>
              <Button
                variant="tonal"
                size="sm"
                onPress={addAnswer}
                data-testid="poll-add-answer"
              >
                <Icon name="plus" size={16} />
                <Trans>Add answer</Trans>
              </Button>
            </div>
          </Show>
        </Group>

        <FloatingSelect
          label={t`Open for`}
          value={String(duration())}
          onChange={(event) => setDuration(Number(event.currentTarget.value))}
          data-testid="poll-duration"
        >
          <For each={[...POLL_DURATIONS]}>
            {(hours) => (
              <MenuItem value={String(hours)}>{durationLabel(hours)}</MenuItem>
            )}
          </For>
        </FloatingSelect>

        <ToggleRow>
          <ToggleText>
            <span id="poll-multiple-label">
              <Trans>Allow more than one answer</Trans>
            </span>
            <small id="poll-multiple-hint">
              <Trans>People can pick several answers.</Trans>
            </small>
          </ToggleText>
          <Toggle
            checked={multiple()}
            onChange={setMultiple}
            aria-labelledby="poll-multiple-label"
            aria-describedby="poll-multiple-hint"
          />
        </ToggleRow>

        <Preview aria-label={t`Preview`} data-testid="poll-preview">
          <PreviewLabel>
            <Trans>Preview</Trans>
          </PreviewLabel>
          <PreviewQuestion>
            {question().trim() || t`Your question`}
          </PreviewQuestion>
          <PreviewHint>
            <Show when={multiple()} fallback={<Trans>Choose one answer</Trans>}>
              <Trans>Choose one or more answers</Trans>
            </Show>
          </PreviewHint>
          <For each={answers.filter((a) => a.text.trim())}>
            {(answer) => (
              <PreviewRow>
                <PreviewMark data-multiple={multiple()} aria-hidden="true" />
                <Show when={answer.emoji}>
                  <Emoji emoji={answer.emoji!} />
                </Show>
                <span>{answer.text}</span>
              </PreviewRow>
            )}
          </For>
          <PreviewHint>{t`Open for ${durationLabel(duration())}`}</PreviewHint>
        </Preview>
      </Fields>
    </Dialog>
  );
}

const Fields = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: 0,
  },
});

const Group = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: 0,
  },
});

const Label = styled("span", {
  base: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
  },
});

const AnswerRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
  },
});

const EmojiButton = styled("button", {
  base: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    inlineSize: "40px",
    blockSize: "40px",
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

const AnswerField = styled("div", {
  base: { flex: 1, minWidth: 0 },
});

const RowTools = styled("div", {
  base: {
    display: "flex",
    flexShrink: 0,
    gap: "4px",
  },
});

const ToggleRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
});

const ToggleText = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    fontSize: "14px",
    color: "var(--z-fg-primary)",
    "& small": { fontSize: "12px", color: "var(--z-fg-muted)" },
  },
});

const Preview = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    borderRadius: "var(--z-radius-md)",
    border: "1px dashed var(--z-border-strong)",
    background: "var(--z-bg-raised)",
    minWidth: 0,
  },
});

const PreviewLabel = styled("span", {
  base: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
  },
});

const PreviewQuestion = styled("p", {
  base: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
    wordBreak: "break-word",
  },
});

const PreviewHint = styled("p", {
  base: {
    margin: 0,
    fontSize: "12px",
    color: "var(--z-fg-muted)",
  },
});

const PreviewRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "44px",
    paddingBlock: "12px",
    paddingInline: "12px",
    borderRadius: "var(--z-radius-sm)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-input)",
    fontSize: "14px",
    color: "var(--z-fg-primary)",
    wordBreak: "break-word",
    "& img": { inlineSize: "20px", blockSize: "20px" },
  },
});

const PreviewMark = styled("span", {
  base: {
    flexShrink: 0,
    inlineSize: "16px",
    blockSize: "16px",
    borderRadius: "var(--z-radius-pill)",
    border: "2px solid var(--z-border-strong)",
    "&[data-multiple='true']": { borderRadius: "var(--z-radius-xs)" },
  },
});
