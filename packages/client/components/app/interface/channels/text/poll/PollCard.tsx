import {
  For,
  Show,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/solid/macro";
import { type Message, pollClosed } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { threadIsReadOnly } from "@revolt/app/interface/channels/threadAccess";
import { useTime } from "@revolt/i18n";
import { TranslatedError } from "@revolt/i18n/errors";
import { Emoji } from "@revolt/markdown/emoji";
import { useModals } from "@revolt/modal";
import { Icon } from "@revolt/ui/icons/Icon";

import { pollPercents, pollTotal, voteAction } from "./pollModel";

/**
 * A poll in the message list: each answer is a large row people press to
 * vote, with a bar, the share and the count; your own choice is marked.
 * Single-choice polls behave as radio buttons, multiple-choice ones as
 * checkboxes (arrow keys move between answers). Counts update live.
 */
export function PollCard(props: { message: Message }) {
  const { t } = useLingui();
  const dayjs = useTime();
  const { openModal } = useModals();

  const [now, setNow] = createSignal(new Date());
  onMount(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    onCleanup(() => clearInterval(timer));
  });

  const [busy, setBusy] = createSignal<number>();
  const [error, setError] = createSignal<unknown>();

  const poll = () => props.message.poll!;
  const closed = () => pollClosed(poll(), now());
  const total = createMemo(() => pollTotal(poll()));
  const percents = createMemo(() => pollPercents(poll()));
  const canVote = () =>
    !closed() &&
    !!props.message.channel?.havePermission("React") &&
    !(props.message.channel && threadIsReadOnly(props.message.channel));

  const rows: HTMLButtonElement[] = [];

  async function press(answer: number) {
    if (!canVote() || busy()) return;
    setBusy(answer);
    setError(undefined);
    try {
      if (voteAction(poll(), answer) === "vote") {
        await props.message.votePoll(answer);
      } else {
        await props.message.unvotePoll(answer);
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(undefined);
    }
  }

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const count = poll().answers.length;
    rows[(index + step + count) % count]?.focus();
  }

  const votes = () =>
    t`${plural(total(), { one: "# vote", other: "# votes" })}`;
  const ends = () => dayjs(poll().expires_at).fromNow();

  return (
    <Card data-testid="poll-card" aria-labelledby={`poll-${props.message.id}`}>
      <Question id={`poll-${props.message.id}`}>{poll().question}</Question>
      <Hint>
        <Show
          when={poll().allow_multiselect}
          fallback={<Trans>Choose one answer</Trans>}
        >
          <Trans>Choose one or more answers</Trans>
        </Show>
      </Hint>
      <Answers
        role={poll().allow_multiselect ? "group" : "radiogroup"}
        aria-labelledby={`poll-${props.message.id}`}
      >
        <For each={poll().answers}>
          {(answer, index) => {
            const mine = () => !!poll().me?.includes(answer.id);
            return (
              <Row
                ref={(el) => (rows[index()] = el)}
                type="button"
                role={poll().allow_multiselect ? "checkbox" : "radio"}
                aria-checked={mine()}
                aria-disabled={!canVote()}
                aria-busy={busy() === answer.id}
                data-mine={mine()}
                data-testid="poll-answer"
                onClick={() => void press(answer.id)}
                onKeyDown={(event) => onKeyDown(event, index())}
              >
                <Bar
                  aria-hidden="true"
                  data-mine={mine()}
                  style={{ "inline-size": `${percents()[index()] ?? 0}%` }}
                />
                <Mark
                  aria-hidden="true"
                  data-mine={mine()}
                  data-multiple={!!poll().allow_multiselect}
                >
                  <Show when={mine()}>
                    <Icon name="check" size={14} />
                  </Show>
                </Mark>
                <Show when={answer.emoji}>
                  <AnswerEmoji aria-hidden="true">
                    <Emoji emoji={answer.emoji!} />
                  </AnswerEmoji>
                </Show>
                <AnswerText>{answer.text}</AnswerText>
                <Share>
                  <span>{percents()[index()] ?? 0}%</span>
                  <Count>
                    {t`${plural(answer.count ?? 0, { one: "# vote", other: "# votes" })}`}
                  </Count>
                </Share>
              </Row>
            );
          }}
        </For>
      </Answers>
      <Footer>
        <Status data-testid="poll-status">
          <Show
            when={closed()}
            fallback={
              <>
                {votes()} · {t`Ends ${ends()}`}
              </>
            }
          >
            {votes()} · <Trans>Final results</Trans>
          </Show>
        </Status>
        <Show when={total() > 0}>
          <Link
            type="button"
            data-testid="poll-voters"
            onClick={() =>
              openModal({ type: "poll_voters", message: props.message })
            }
          >
            <Trans>See who voted</Trans>
          </Link>
        </Show>
      </Footer>
      <Show when={error()}>
        <Failure role="alert">
          <TranslatedError error={error()} />
        </Failure>
      </Show>
    </Card>
  );
}

const Card = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    inlineSize: "100%",
    maxInlineSize: "480px",
    marginBlock: "4px",
    padding: "12px",
    borderRadius: "var(--z-radius-md)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-raised)",
    minWidth: 0,
  },
});

const Question = styled("h3", {
  base: {
    margin: 0,
    fontSize: "15px",
    lineHeight: "22px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
    wordBreak: "break-word",
  },
});

const Hint = styled("p", {
  base: {
    margin: 0,
    fontSize: "12px",
    color: "var(--z-fg-muted)",
  },
});

const Answers = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
});

const Row = styled("button", {
  base: {
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "44px",
    paddingBlock: "8px",
    paddingInline: "12px",
    borderRadius: "var(--z-radius-sm)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-input)",
    color: "var(--z-fg-primary)",
    textAlign: "start",
    fontSize: "14px",
    cursor: "pointer",
    transition: "border-color var(--z-motion-fast) var(--z-ease-standard)",
    "&:hover:not([aria-disabled='true'])": {
      borderColor: "var(--z-border-strong)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "&:active:not([aria-disabled='true'])": {
      background: "var(--z-hover)",
    },
    "&[aria-disabled='true']": { cursor: "default" },
    "&[aria-busy='true']": { opacity: 0.7 },
    "&[data-mine='true']": { borderColor: "var(--z-accent)" },
  },
});

const Bar = styled("span", {
  base: {
    position: "absolute",
    insetBlock: 0,
    insetInlineStart: 0,
    zIndex: -1,
    background: "var(--z-hover)",
    transition: "inline-size var(--z-motion-base) var(--z-ease-standard)",
    "&[data-mine='true']": { background: "var(--z-accent-muted)" },
    "@media (prefers-reduced-motion: reduce)": { transition: "none" },
  },
});

const Mark = styled("span", {
  base: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    inlineSize: "20px",
    blockSize: "20px",
    borderRadius: "var(--z-radius-pill)",
    border: "2px solid var(--z-border-strong)",
    "--z-icon-color": "var(--z-on-accent)",
    "&[data-multiple='true']": { borderRadius: "var(--z-radius-xs)" },
    "&[data-mine='true']": {
      borderColor: "var(--z-accent)",
      background: "var(--z-accent)",
    },
  },
});

const AnswerEmoji = styled("span", {
  base: {
    flexShrink: 0,
    display: "inline-flex",
    fontSize: "20px",
    "& img": { inlineSize: "20px", blockSize: "20px" },
  },
});

const AnswerText = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    wordBreak: "break-word",
  },
});

const Share = styled("span", {
  base: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    fontSize: "13px",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
});

const Count = styled("span", {
  base: {
    fontSize: "12px",
    fontWeight: 400,
    color: "var(--z-fg-muted)",
  },
});

const Footer = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
});

const Status = styled("span", {
  base: {
    fontSize: "12px",
    color: "var(--z-fg-muted)",
  },
});

const Link = styled("button", {
  base: {
    minHeight: "24px",
    padding: "0 4px",
    border: "none",
    background: "transparent",
    color: "var(--z-accent-text)",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    borderRadius: "var(--z-radius-xs)",
    "&:hover": { textDecoration: "underline" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { minHeight: "44px" },
  },
});

const Failure = styled("div", {
  base: {
    color: "var(--z-danger)",
    fontSize: "13px",
  },
});
