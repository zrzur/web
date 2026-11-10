import { For, Show, createEffect, createSignal, on } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { User } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { TranslatedError } from "@revolt/i18n/errors";
import { Emoji } from "@revolt/markdown/emoji";
import { Avatar, Button, Dialog, DialogProps } from "@revolt/ui";

import { Modals } from "../types";

/**
 * Who chose each answer of a poll: one answer at a time (chips above the
 * list), oldest vote first, more on request.
 */
export function PollVotersModal(
  props: DialogProps & Modals & { type: "poll_voters" },
) {
  const { t } = useLingui();

  const poll = () => props.message.poll!;
  const [answer, setAnswer] = createSignal(
    poll().answers.find((a) => (a.count ?? 0) > 0)?.id ?? poll().answers[0].id,
  );
  const [users, setUsers] = createSignal<User[]>([]);
  const [next, setNext] = createSignal<string>();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<unknown>();

  // Each request has a number; an answer for anything but the latest one
  // (another answer chosen meanwhile) is dropped
  let latest = 0;

  async function load(more: boolean) {
    const request = ++latest;
    setLoading(true);
    setError(undefined);
    try {
      const page = await props.message.fetchPollVoters(answer(), {
        limit: 50,
        after: more ? next() : undefined,
      });
      if (request !== latest) return;
      setUsers((list) => (more ? [...list, ...page.users] : page.users));
      setNext(page.next);
    } catch (err) {
      if (request === latest) setError(err);
    } finally {
      if (request === latest) setLoading(false);
    }
  }

  // a new answer starts from its first page
  createEffect(
    on(answer, () => {
      setUsers([]);
      setNext(undefined);
      void load(false);
    }),
  );

  const name = (user: User) =>
    props.message.server?.getMember(user.id)?.nickname ?? user.displayName;

  return (
    <Dialog
      tone="info"
      size="md"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Votes</Trans>}
      description={poll().question}
      actions={[{ text: <Trans>Close</Trans> }]}
      error={error() ? <TranslatedError error={error()} /> : undefined}
    >
      <Body data-testid="poll-voters-dialog">
        <Choices role="tablist" aria-label={t`Answers`}>
          <For each={poll().answers}>
            {(item) => (
              <Choice
                type="button"
                role="tab"
                aria-selected={answer() === item.id}
                onClick={() => setAnswer(item.id)}
              >
                <Show when={item.emoji}>
                  <Emoji emoji={item.emoji!} />
                </Show>
                <ChoiceText>{item.text}</ChoiceText>
                <ChoiceCount>{item.count ?? 0}</ChoiceCount>
              </Choice>
            )}
          </For>
        </Choices>
        <List role="tabpanel" aria-busy={loading()}>
          <For
            each={users()}
            fallback={
              <Show when={!loading()}>
                <Empty>
                  <Trans>Nobody chose this answer yet.</Trans>
                </Empty>
              </Show>
            }
          >
            {(user) => (
              <Person>
                <Avatar
                  size={32}
                  src={user.animatedAvatarURL}
                  fallback={name(user)}
                />
                <PersonName>{name(user)}</PersonName>
              </Person>
            )}
          </For>
        </List>
        <Show when={next()}>
          <div>
            <Button
              variant="tonal"
              size="sm"
              isDisabled={loading()}
              onPress={() => void load(true)}
            >
              <Trans>Show more</Trans>
            </Button>
          </div>
        </Show>
      </Body>
    </Dialog>
  );
}

const Body = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
  },
});

const Choices = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
});

const Choice = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    minHeight: "32px",
    maxInlineSize: "100%",
    paddingInline: "12px",
    borderRadius: "var(--z-radius-pill)",
    border: "1px solid var(--z-border-subtle)",
    background: "transparent",
    color: "var(--z-fg-primary)",
    fontSize: "13px",
    cursor: "pointer",
    "& img": { inlineSize: "16px", blockSize: "16px" },
    "&:hover": { background: "var(--z-hover)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "&[aria-selected='true']": {
      borderColor: "var(--z-accent)",
      background: "var(--z-accent-muted)",
    },
    _phone: { minHeight: "44px" },
  },
});

const ChoiceText = styled("span", {
  base: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxInlineSize: "200px",
  },
});

const ChoiceCount = styled("span", {
  base: {
    color: "var(--z-fg-muted)",
    fontVariantNumeric: "tabular-nums",
  },
});

const List = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    maxHeight: "320px",
    overflowY: "auto",
    padding: "12px",
    borderRadius: "var(--z-radius-md)",
    border: "1px solid var(--z-border-subtle)",
    _phone: { maxHeight: "45vh" },
  },
});

const Person = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "44px",
  },
});

const PersonName = styled("span", {
  base: {
    fontSize: "14px",
    color: "var(--z-fg-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Empty = styled("p", {
  base: {
    margin: 0,
    fontSize: "14px",
    color: "var(--z-fg-muted)",
  },
});
