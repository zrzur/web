import {
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  on,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useUsers } from "@revolt/markdown/users";
import {
  type CaptureItem,
  captureActive,
  clipBlock,
  clock,
  mayDelete,
  shouldAsk,
} from "@revolt/rtc/capture/captureModel";
import {
  captureFeatures,
  captureOf,
  captureSession,
  deleteCapture,
  listCaptures,
  startRecording,
  switchClips,
} from "@revolt/rtc/capture/captureStore";
import { Button, TextField } from "@revolt/ui/components/design";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Clips and recording of the voice room you are in.
 *
 * Everyone sees when clips are on or a recording runs, and chooses whether
 * their own voice is included. People with Manage Channel switch clips and
 * start a recording. Lazy: only a server call loads it, and only where the
 * server has one of the two features on.
 */
export default function CapturePanel(props: { channel: Channel }) {
  const { t } = useLingui();
  const client = useClient();
  const describeError = useError();

  const features = () => captureFeatures(client());
  const me = () => client().user?.id ?? "";
  const room = () => captureOf(props.channel.id);
  const state = () => room().state();
  const allowance = () => room().allowance();
  const session = () => {
    const current = captureSession();
    return current?.channel.id === props.channel.id ? current : undefined;
  };
  const manager = () => props.channel.havePermission("ManageChannel");
  const moderator = () => props.channel.havePermission("ManageMessages");
  const included = () => state().included.includes(me());
  const recording = () => state().recording ?? undefined;
  const mine = () => recording()?.by === me();

  const [error, setError] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);
  const [open, setOpen] = createSignal(false);
  const [title, setTitle] = createSignal("");
  const [confirmStop, setConfirmStop] = createSignal(false);
  const [note, setNote] = createSignal<"clip" | "episode">();

  /** One action at a time; its error shows here in plain words */
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

  const [items, { refetch }] = createResource(
    () => (open() ? props.channel.id : undefined),
    () =>
      listCaptures(client(), props.channel).catch(() => [] as CaptureItem[]),
  );
  createEffect(() => {
    const current = session();
    if (current) onCleanup(current.onChange(() => void refetch()));
  });

  // "Clip shared" goes away by itself
  createEffect(
    on(note, (value) => {
      if (!value) return;
      const timer = setTimeout(() => setNote(undefined), 5000);
      onCleanup(() => clearTimeout(timer));
    }),
  );

  const starter = useUsers(() => {
    const id = recording()?.by ?? state().clips;
    return id ? [id] : [];
  });
  const starterName = () => starter()[0]?.username ?? t`Someone`;

  const block = createMemo(() =>
    clipBlock({
      state: state(),
      allowance: allowance(),
      bufferedSeconds: session()?.bufferedSeconds() ?? 0,
      saving: session()?.saving() ?? false,
    }),
  );

  // everyone while something is on; otherwise only those who can turn it on
  const visible = () => captureActive(state()) || (manager() && !!session());

  return (
    <Show when={visible()}>
      <Panel
        data-capture-panel
        data-capture-active={captureActive(state()) ? "" : undefined}
        aria-label={t`Clips and recording`}
      >
        <Head>
          <Show
            when={recording()}
            fallback={
              <Show
                when={state().clips}
                fallback={
                  <>
                    <Icon name="waveform" size={20} />
                    <Line>
                      <Trans>Clips and recording</Trans>
                    </Line>
                  </>
                }
              >
                <Dot data-kind="clips" aria-hidden="true" />
                <Line role="status" data-capture-sign="clips">
                  <Trans>Clips are on. Turned on by {starterName()}.</Trans>
                </Line>
              </Show>
            }
          >
            <Dot data-kind="recording" aria-hidden="true" />
            <Line role="status" data-capture-sign="recording">
              <Trans>This room is being recorded by {starterName()}.</Trans>
              <Show when={mine() && session()}>
                {(current) => (
                  <Time data-capture-time>
                    {clock(current().recordedSeconds())}
                  </Time>
                )}
              </Show>
            </Line>
          </Show>
          <Button
            size="sm"
            variant="text"
            aria-expanded={open()}
            onPress={() => setOpen(!open())}
          >
            <Show when={open()} fallback={<Trans>Details</Trans>}>
              <Trans>Hide details</Trans>
            </Show>
          </Button>
        </Head>

        {/* each person's own choice, as easy to take back as to give */}
        <Show when={captureActive(state()) && session()}>
          {(current) => (
            <Choice data-capture-choice={included() ? "in" : "out"}>
              <Show
                when={!shouldAsk(state(), current().answered())}
                fallback={
                  <ChoiceText>
                    <Trans>
                      Your voice is left out until you choose. Include it?
                    </Trans>
                  </ChoiceText>
                }
              >
                <ChoiceText>
                  <Show
                    when={included()}
                    fallback={<Trans>Your voice is left out.</Trans>}
                  >
                    <Trans>Your voice is included.</Trans>
                  </Show>
                </ChoiceText>
              </Show>
              <Show
                when={included()}
                fallback={
                  <Button
                    size="sm"
                    variant="tonal"
                    isDisabled={busy()}
                    onPress={() => act(() => current().answer(true))}
                  >
                    <Trans>Include my voice</Trans>
                  </Button>
                }
              >
                <Button
                  size="sm"
                  variant="tonal"
                  isDisabled={busy()}
                  onPress={() => act(() => current().answer(false))}
                >
                  <Trans>Leave me out</Trans>
                </Button>
              </Show>
              <Show when={shouldAsk(state(), current().answered())}>
                <Button
                  size="sm"
                  variant="text"
                  isDisabled={busy()}
                  onPress={() => act(() => current().answer(false))}
                >
                  <Trans>Leave me out</Trans>
                </Button>
              </Show>
            </Choice>
          )}
        </Show>

        <Show when={session()}>
          {(current) => (
            <Actions>
              <Show when={state().clips && current().supported}>
                <Button
                  size="sm"
                  data-capture-action="clip"
                  isDisabled={busy() || !!block()}
                  onPress={() =>
                    act(async () => {
                      if (await current().saveClip()) setNote("clip");
                    })
                  }
                >
                  <Trans>
                    Save the last {allowance()?.clip_seconds ?? 30} seconds
                  </Trans>
                </Button>
              </Show>
              <Show when={mine()}>
                <Show
                  when={confirmStop()}
                  fallback={
                    <>
                      <Button
                        size="sm"
                        data-capture-action="finish"
                        isDisabled={busy()}
                        onPress={() =>
                          act(async () => {
                            if (await current().finishRecording(true))
                              setNote("episode");
                          })
                        }
                      >
                        <Trans>Stop and save the episode</Trans>
                      </Button>
                      <Button
                        size="sm"
                        variant="text"
                        isDisabled={busy()}
                        onPress={() => setConfirmStop(true)}
                      >
                        <Trans>Stop without saving</Trans>
                      </Button>
                    </>
                  }
                >
                  <Hint>
                    <Trans>The recording will be lost. Stop it?</Trans>
                  </Hint>
                  <Button
                    size="sm"
                    variant="_error"
                    isDisabled={busy()}
                    onPress={() =>
                      act(async () => {
                        await current().finishRecording(false);
                        setConfirmStop(false);
                      })
                    }
                  >
                    <Trans>Stop and delete</Trans>
                  </Button>
                  <Button
                    size="sm"
                    variant="text"
                    onPress={() => setConfirmStop(false)}
                  >
                    <Trans>Keep recording</Trans>
                  </Button>
                </Show>
              </Show>
            </Actions>
          )}
        </Show>

        <Show when={block() === "limit" && state().clips}>
          <Hint data-capture-limit>
            <Trans>
              You shared all {allowance()?.clips_per_month ?? 0} clips of this
              month. Feather gives you more.
            </Trans>
          </Hint>
        </Show>
        <Show when={session() && !session()!.supported && state().clips}>
          <Hint>
            <Trans>This browser cannot make clips.</Trans>
          </Hint>
        </Show>
        <Show when={mine() && session()?.recordingLeft() !== undefined}>
          <Hint>
            <Trans>
              Stops by itself in {clock(session()!.recordingLeft() ?? 0)}. Keep
              this page open: the recording is made on your device.
            </Trans>
          </Hint>
        </Show>
        <Show when={note()}>
          <Hint role="status" data-capture-note={note()}>
            <Show
              when={note() === "clip"}
              fallback={<Trans>Episode saved in this room's chat.</Trans>}
            >
              <Trans>Clip shared in this room's chat.</Trans>
            </Show>
          </Hint>
        </Show>
        <Show when={error()}>
          <ErrorLine role="alert">{error()}</ErrorLine>
        </Show>

        <Show when={open()}>
          <Details>
            <Explain>
              <Trans>
                Only the voices of people who chose "Include my voice" are
                saved. Everyone whose voice is in a clip or an episode can
                delete it.
              </Trans>
            </Explain>

            <Show when={manager() && session()}>
              <Manage>
                <Show when={features().clips}>
                  <Button
                    size="sm"
                    variant="tonal"
                    data-capture-action="clips-switch"
                    isDisabled={busy()}
                    onPress={() =>
                      act(() =>
                        switchClips(client(), props.channel, !state().clips),
                      )
                    }
                  >
                    <Show
                      when={state().clips}
                      fallback={<Trans>Turn clips on</Trans>}
                    >
                      <Trans>Turn clips off</Trans>
                    </Show>
                  </Button>
                </Show>
                <Show
                  when={
                    features().recordings &&
                    !recording() &&
                    session()?.supported
                  }
                >
                  <form
                    style={{ display: "contents" }}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void act(() =>
                        startRecording(
                          client(),
                          props.channel,
                          title().trim() || undefined,
                        ),
                      );
                    }}
                  >
                    <TitleField>
                      <TextField
                        label={t`Episode name`}
                        value={title()}
                        maxlength={80}
                        onInput={(event) => setTitle(event.currentTarget.value)}
                      />
                    </TitleField>
                    <Button
                      type="submit"
                      size="sm"
                      variant="tonal"
                      data-capture-action="record"
                      isDisabled={
                        busy() ||
                        (allowance()?.recording_seconds_left ?? 1) <= 0
                      }
                    >
                      <Trans>Start recording</Trans>
                    </Button>
                  </form>
                </Show>
              </Manage>
            </Show>

            <Show when={allowance()}>
              {(left) => (
                <Counts>
                  <Show when={features().clips}>
                    <span data-capture-clips-left>
                      <Trans>
                        Your clips left this month: {left().clips_left} of{" "}
                        {left().clips_per_month}
                      </Trans>
                    </span>
                  </Show>
                  <Show when={features().recordings}>
                    <span data-capture-recording-left>
                      <Show
                        when={left().recording_seconds_per_month > 0}
                        fallback={
                          <Trans>Recording needs Wings on this server.</Trans>
                        }
                      >
                        <Trans>
                          Recording time left this month:{" "}
                          {clock(left().recording_seconds_left)} of{" "}
                          {clock(left().recording_seconds_per_month)}
                        </Trans>
                      </Show>
                    </span>
                  </Show>
                </Counts>
              )}
            </Show>

            <Show
              when={(items() ?? []).length}
              fallback={
                <Show when={!items.loading}>
                  <Muted>
                    <Trans>No clips or episodes from this room yet.</Trans>
                  </Muted>
                </Show>
              }
            >
              <Items>
                <For each={items()}>
                  {(item) => (
                    <CaptureRow
                      item={item}
                      channel={props.channel}
                      canDelete={mayDelete(item, me(), moderator())}
                      busy={busy()}
                      onDelete={() =>
                        act(async () => {
                          await deleteCapture(
                            client(),
                            props.channel,
                            item._id,
                          );
                          await refetch();
                        })
                      }
                    />
                  )}
                </For>
              </Items>
            </Show>
          </Details>
        </Show>
      </Panel>
    </Show>
  );
}

/** One clip or episode: play it, see whose voices are in it, delete it */
function CaptureRow(props: {
  item: CaptureItem;
  channel: Channel;
  canDelete: boolean;
  busy: boolean;
  onDelete: () => void;
}) {
  const { t } = useLingui();
  const client = useClient();
  const voices = useUsers(() => props.item.included);
  const [playing, setPlaying] = createSignal(false);
  const [confirm, setConfirm] = createSignal(false);
  let audio: HTMLAudioElement | undefined;

  const url = () => {
    const base = client().configuration?.features.autumn.url ?? "";
    return `${base.replace(/\/$/, "")}/attachments/${props.item.file}`;
  };
  function toggle() {
    if (!audio) {
      audio = new Audio(url());
      audio.preload = "none";
      audio.addEventListener("ended", () => setPlaying(false));
      audio.addEventListener("pause", () => setPlaying(false));
      audio.addEventListener("play", () => setPlaying(true));
    }
    if (audio.paused) void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }
  onCleanup(() => audio?.pause());

  const names = () =>
    voices()
      .map((user) => user?.username)
      .filter(Boolean)
      .join(t`, `);

  return (
    <Row data-capture-item={props.item.kind}>
      <Button
        size="xs"
        variant="tonal"
        aria-label={playing() ? t`Pause` : t`Play`}
        onPress={toggle}
      >
        <Icon name={playing() ? "pause" : "play"} size={16} />
      </Button>
      <RowText>
        <RowTitle>
          <Show
            when={props.item.kind === "Episode"}
            fallback={<Trans>Clip</Trans>}
          >
            {props.item.title || <Trans>Episode</Trans>}
          </Show>
          <Time>{clock(props.item.duration)}</Time>
        </RowTitle>
        <RowVoices>
          <Show
            when={props.item.included.length}
            fallback={<Trans>No voices listed</Trans>}
          >
            <Trans>Voices: {names()}</Trans>
          </Show>
        </RowVoices>
      </RowText>
      <Show when={props.canDelete}>
        <Show
          when={confirm()}
          fallback={
            <Button
              size="xs"
              variant="text"
              isDisabled={props.busy}
              onPress={() => setConfirm(true)}
            >
              <Trans>Delete</Trans>
            </Button>
          }
        >
          <Button
            size="xs"
            variant="_error"
            isDisabled={props.busy}
            onPress={props.onDelete}
          >
            <Trans>Delete for everyone</Trans>
          </Button>
          <Button size="xs" variant="text" onPress={() => setConfirm(false)}>
            <Trans>Cancel</Trans>
          </Button>
        </Show>
      </Show>
    </Row>
  );
}

const Panel = styled("section", {
  base: {
    // phones: every control is at least 44 px tall
    _phone: { "& button": { minHeight: "44px" } },
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    flexShrink: 0,
    padding: "12px 16px",
    borderRadius: "var(--z-box-radius)",
    border: "var(--z-box-border)",
    background: "var(--z-box-bg)",
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

const Dot = styled("span", {
  base: {
    flexShrink: 0,
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    background: "var(--z-status-warning)",
    "&[data-kind='recording']": { background: "var(--z-status-error)" },
  },
});

const Line = styled("span", {
  base: {
    flex: "1 1 200px",
    minWidth: 0,
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: 600,
    overflowWrap: "anywhere",
  },
});

const Time = styled("span", {
  base: {
    marginInlineStart: "8px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 500,
    color: "var(--z-fg-secondary)",
    // a clock reads left to right in every language
    direction: "ltr",
    unicodeBidi: "isolate",
  },
});

const Choice = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
  },
});

const ChoiceText = styled("span", {
  base: {
    flex: "1 1 200px",
    minWidth: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
    "&:empty": { display: "none" },
  },
});

const Hint = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
});

const ErrorLine = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-status-error)",
  },
});

const Details = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    paddingBlockStart: "8px",
    borderBlockStart: "1px solid var(--z-border-subtle)",
  },
});

const Explain = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
});

const Manage = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
  },
});

const TitleField = styled("div", {
  base: { flex: "1 1 200px", minWidth: 0 },
});

const Counts = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px 16px",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
});

const Muted = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
  },
});

const Items = styled("ul", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    margin: 0,
    padding: 0,
    listStyle: "none",
    maxHeight: "240px",
    overflowY: "auto",
  },
});

const Row = styled("li", {
  base: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
    minHeight: "44px",
  },
});

const RowText = styled("div", {
  base: {
    flex: "1 1 160px",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
});

const RowTitle = styled("span", {
  base: {
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: 600,
    overflowWrap: "anywhere",
  },
});

const RowVoices = styled("span", {
  base: {
    fontSize: "12px",
    lineHeight: "18px",
    color: "var(--z-fg-secondary)",
    overflowWrap: "anywhere",
  },
});
