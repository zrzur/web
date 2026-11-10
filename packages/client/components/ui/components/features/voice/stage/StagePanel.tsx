import { For, Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useUsers } from "@revolt/markdown/users";
import { Avatar, Button, TextField } from "@revolt/ui/components/design";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  type StageState,
  editStage,
  endStage,
  inviteToSpeak,
  lowerHand,
  moveToAudience,
  raiseHand,
  stageOf,
} from "@revolt/rtc/voiceExtrasStore";

import { stageRoles } from "./stageRoles";

/**
 * Stage controls above the call: topic, who speaks, raised hands, and the
 * buttons for what you may do. Lazy: only a stage call loads it.
 */
export default function StagePanel(props: { channel: Channel }) {
  const { t } = useLingui();
  const client = useClient();
  const describeError = useError();

  const me = () => client().user?.id ?? "";
  const stage = () => stageOf(props.channel.id);
  /** An answer carries the whole state: show it at once */
  const keep = (state: StageState) => stage().set(state);
  const moderator = () => props.channel.havePermission("MuteMembers");
  const roles = createMemo(() =>
    stageRoles(
      stage().state(),
      [...props.channel.voiceParticipants.keys()],
      me(),
    ),
  );
  const speakers = useUsers(() => roles().speakers);
  const hands = useUsers(() => roles().hands);

  const [error, setError] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [topic, setTopic] = createSignal("");
  const [confirmEnd, setConfirmEnd] = createSignal(false);

  /** Run one stage action; its error shows in the panel in plain words */
  async function act(action: () => Promise<unknown>) {
    if (busy()) return;
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    setTopic(stage().state().topic ?? "");
    setEditing(true);
  }

  return (
    <Panel data-stage-panel aria-label={t`Stage`}>
      <Head>
        <Icon name="waveform" size={20} />
        <Show
          when={editing()}
          fallback={
            <Topic data-stage-topic>
              {stage().state().topic ?? (
                <Muted>
                  <Trans>No topic yet</Trans>
                </Muted>
              )}
            </Topic>
          }
        >
          <form
            style={{ display: "contents" }}
            onSubmit={(event) => {
              event.preventDefault();
              void act(async () => {
                await editStage(client(), props.channel, topic()).then(keep);
                setEditing(false);
              });
            }}
          >
            <TopicField>
              <TextField
                label={t`Topic`}
                value={topic()}
                maxlength={120}
                counter
                autofocus
                onInput={(event) => setTopic(event.currentTarget.value)}
              />
            </TopicField>
            <Button type="submit" size="sm" isDisabled={busy()}>
              <Trans>Save</Trans>
            </Button>
            <Button size="sm" variant="text" onPress={() => setEditing(false)}>
              <Trans>Cancel</Trans>
            </Button>
          </form>
        </Show>
        <Show when={moderator() && !editing()}>
          <Button size="sm" variant="text" onPress={startEdit}>
            <Trans>Edit topic</Trans>
          </Button>
        </Show>
      </Head>

      <Counts>
        <span data-stage-speaker-count>
          <Trans>Speakers: {roles().speakers.length}</Trans>
        </span>
        <span data-stage-audience-count>
          <Trans>Listening: {roles().audience.length}</Trans>
        </span>
      </Counts>

      <Show when={roles().speakers.length}>
        <People aria-label={t`Speakers`}>
          <For each={roles().speakers}>
            {(id, index) => (
              <Person data-stage-speaker={id}>
                <Avatar
                  size={24}
                  src={speakers()[index()]?.avatar}
                  fallback={speakers()[index()]?.username}
                />
                <Name>{speakers()[index()]?.username}</Name>
                <Show when={moderator() && id !== me()}>
                  <Button
                    size="xs"
                    variant="text"
                    isDisabled={busy()}
                    onPress={() =>
                      act(() =>
                        moveToAudience(client(), props.channel, id).then(keep),
                      )
                    }
                  >
                    <Trans>Back to listeners</Trans>
                  </Button>
                </Show>
              </Person>
            )}
          </For>
        </People>
      </Show>

      <Show when={moderator() && roles().hands.length}>
        <People aria-label={t`Asking to speak`} data-stage-hands>
          <For each={roles().hands}>
            {(id, index) => (
              <Person data-stage-hand={id}>
                <Icon name="hand-waving" size={18} />
                <Avatar
                  size={24}
                  src={hands()[index()]?.avatar}
                  fallback={hands()[index()]?.username}
                />
                <Name>{hands()[index()]?.username}</Name>
                <Button
                  size="xs"
                  isDisabled={busy()}
                  onPress={() =>
                    act(() =>
                      inviteToSpeak(client(), props.channel, id).then(keep),
                    )
                  }
                >
                  <Trans>Give the floor</Trans>
                </Button>
                <Button
                  size="xs"
                  variant="text"
                  isDisabled={busy()}
                  onPress={() =>
                    act(() => lowerHand(client(), props.channel, id).then(keep))
                  }
                >
                  <Trans>Put hand down</Trans>
                </Button>
              </Person>
            )}
          </For>
        </People>
      </Show>

      <Actions>
        <Show when={roles().mine === "audience"}>
          <Button
            size="sm"
            data-stage-action="raise-hand"
            isDisabled={busy()}
            onPress={() =>
              act(() => raiseHand(client(), props.channel).then(keep))
            }
          >
            <Icon name="hand-waving" size={18} />
            <Trans>Ask to speak</Trans>
          </Button>
        </Show>
        <Show when={roles().mine === "hand"}>
          <Button
            size="sm"
            variant="tonal"
            data-stage-action="lower-hand"
            isDisabled={busy()}
            onPress={() =>
              act(() => lowerHand(client(), props.channel).then(keep))
            }
          >
            <Trans>Put hand down</Trans>
          </Button>
        </Show>
        <Show when={roles().mine === "speaker"}>
          <Button
            size="sm"
            variant="tonal"
            data-stage-action="stop-speaking"
            isDisabled={busy()}
            onPress={() =>
              act(() => moveToAudience(client(), props.channel).then(keep))
            }
          >
            <Trans>Back to listeners</Trans>
          </Button>
        </Show>
        <Show when={moderator() && roles().mine !== "speaker"}>
          <Button
            size="sm"
            variant="tonal"
            data-stage-action="speak"
            isDisabled={busy()}
            onPress={() =>
              act(() =>
                inviteToSpeak(client(), props.channel, "@me").then(keep),
              )
            }
          >
            <Icon name="microphone" size={18} />
            <Trans>Speak</Trans>
          </Button>
        </Show>
        <Show when={moderator()}>
          <Show
            when={confirmEnd()}
            fallback={
              <Button
                size="sm"
                variant="text"
                data-stage-action="end"
                onPress={() => setConfirmEnd(true)}
              >
                <Trans>Close the stage</Trans>
              </Button>
            }
          >
            <Confirm role="group" aria-label={t`Close the stage`}>
              <span>
                <Trans>Everyone leaves the stage.</Trans>
              </span>
              <Button
                size="sm"
                variant="_error"
                data-stage-action="end-confirm"
                isDisabled={busy()}
                onPress={() =>
                  act(async () => {
                    await endStage(client(), props.channel).then(keep);
                    setConfirmEnd(false);
                  })
                }
              >
                <Trans>Close the stage</Trans>
              </Button>
              <Button
                size="sm"
                variant="text"
                onPress={() => setConfirmEnd(false)}
              >
                <Trans>Cancel</Trans>
              </Button>
            </Confirm>
          </Show>
        </Show>
      </Actions>

      <Show when={error()}>
        <ErrorLine role="alert">{error()}</ErrorLine>
      </Show>
    </Panel>
  );
}

const Panel = styled("section", {
  base: {
    // phones: every control is at least 44 px tall
    _phone: { "& button": { minHeight: "44px" } },
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    flexShrink: 0,
    padding: "12px 16px",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px solid var(--z-border-subtle)",
    // the same surface as the call tiles below it (ParticipantTile)
    background: "var(--z-bg-nav, var(--z-bg-sidebar))",
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-icon-muted)",
  },
});

const Head = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
    minHeight: "32px",
  },
});

const Topic = styled("h2", {
  base: {
    flex: "1 1 160px",
    minWidth: 0,
    margin: 0,
    fontSize: "16px",
    lineHeight: "24px",
    fontWeight: 600,
    overflowWrap: "anywhere",
  },
});

const TopicField = styled("div", {
  base: { flex: "1 1 200px", minWidth: 0 },
});

const Muted = styled("span", {
  base: { color: "var(--z-fg-muted)", fontWeight: 400 },
});

const Counts = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
});

const People = styled("ul", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
});

const Person = styled("li", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "36px",
    "--z-icon-color": "var(--z-warning)",
  },
});

const Name = styled("span", {
  base: {
    flex: "1 1 auto",
    minWidth: 0,
    fontSize: "14px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    "& button": { gap: "8px" },
    _phone: {
      "& > button": { flex: "1 1 auto", minHeight: "44px" },
    },
  },
});

const Confirm = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    color: "var(--z-fg-secondary)",
  },
});

const ErrorLine = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-danger)",
  },
});
