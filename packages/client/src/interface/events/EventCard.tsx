import { For, Match, Show, Switch, createSignal } from "solid-js";

import { Plural, Trans, useLingui } from "@lingui/solid/macro";
import {
  type API,
  type Server,
  type User,
  File as StoatFile,
  serverEventChannel,
  serverEventLink,
} from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { timeLocale } from "@revolt/i18n";
import { TranslatedError } from "@revolt/i18n/errors";
import { Markdown } from "@revolt/markdown";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { useVoice } from "@revolt/rtc";
import { useState } from "@revolt/state";
import { Avatar, Button } from "@revolt/ui";
import { hour12From } from "@revolt/ui/components/design/dateTime";
import { Icon } from "@revolt/ui/icons/Icon";

import { eventLink, eventPhase, eventWhen, startsIn } from "./eventFormat";

type Props = {
  event: API.ServerEvent;
  server: Server;
  now: number;
  /** Opened from a shared link */
  highlighted?: boolean;
};

/**
 * One event: cover, when (in your language and time zone), where, how many
 * are interested, and what you can do with it.
 */
export function EventCard(props: Props) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const { openModal } = useModals();
  const [error, setError] = createSignal<unknown>();
  const [busy, setBusy] = createSignal(false);
  const [copied, setCopied] = createSignal<"yes" | "failed">();
  const [confirm, setConfirm] = createSignal<"cancel" | "series" | "delete">();
  // a mark on its way: further presses wait (the button keeps its focus)
  const [marking, setMarking] = createSignal(false);
  const [people, setPeople] = createSignal<User[]>();
  const [next, setNext] = createSignal<string>();
  const [showPeople, setShowPeople] = createSignal(false);

  const phase = () => eventPhase(props.event, props.now);
  const interested = () => client().serverEvents.isInterested(props.event._id);
  // being the creator gives no rights: Manage Server, like the server
  const manager = () => props.server.havePermission("ManageServer");
  const repeating = () => !!props.event.repeat;
  const upcoming = () =>
    props.event.status === "Scheduled" || props.event.status === "Active";
  const channel = () => {
    const id = serverEventChannel(props.event.place);
    return id ? client().channels.get(id) : undefined;
  };
  const link = () => serverEventLink(props.event.place);
  const cover = () =>
    props.event.cover
      ? new StoatFile(client(), props.event.cover).createFileURL()
      : undefined;
  const when = () =>
    eventWhen(
      props.event,
      i18n().locale ?? "en",
      hour12From(timeLocale()[1].formats?.LT),
    );

  async function act(action: () => Promise<unknown>) {
    setError(undefined);
    setBusy(true);
    try {
      await action();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  async function toggleInterest() {
    if (marking()) return;
    setMarking(true);
    setError(undefined);
    try {
      await client().serverEvents.setInterested(
        props.server.id,
        props.event._id,
        !interested(),
      );
    } catch (failure) {
      setError(failure);
    } finally {
      setMarking(false);
    }
  }

  async function loadPeople(more = false) {
    await act(async () => {
      const page = await client().serverEvents.fetchInterested(
        props.server.id,
        props.event._id,
        more ? next() : undefined,
      );
      setPeople([
        ...(more ? (people() ?? []) : []),
        ...page.users
          .map((user) => client().users.get(user._id)!)
          .filter(Boolean),
      ]);
      setNext(page.next ?? undefined);
    });
  }

  function share() {
    // the app address of this Zrzur, not the page the app happens to run on
    const origin = client().configuration?.app || location.origin;
    const url = eventLink(
      origin.replace(/\/$/, ""),
      props.server.id,
      props.event._id,
    );
    const done = (state: "yes" | "failed") => {
      setCopied(state);
      setTimeout(() => setCopied(undefined), state === "yes" ? 2000 : 6000);
    };
    if (!navigator.clipboard) return done("failed");
    navigator.clipboard.writeText(url).then(
      () => done("yes"),
      () => done("failed"),
    );
  }

  return (
    <Card
      data-testid="event-card"
      data-event={props.event._id}
      data-phase={phase()}
      data-highlighted={props.highlighted || undefined}
      aria-labelledby={`event-${props.event._id}-title`}
    >
      <Show when={cover()}>
        <Cover src={cover()} alt="" loading="lazy" />
      </Show>
      <Content>
        <Badges>
          <Switch>
            <Match when={phase() === "live"}>
              <Badge data-tone="live">
                <Dot aria-hidden="true" />
                <Trans>Happening now</Trans>
              </Badge>
            </Match>
            <Match when={phase() === "soon"}>
              <Badge data-tone="soon">
                {startsIn(
                  props.event.starts_at,
                  props.now,
                  i18n().locale ?? "en",
                )}
              </Badge>
            </Match>
            <Match when={props.event.status === "Cancelled"}>
              <Badge data-tone="over">
                <Trans context="scheduled events">Cancelled</Trans>
              </Badge>
            </Match>
            <Match when={props.event.status === "Completed"}>
              <Badge data-tone="over">
                <Trans>Over</Trans>
              </Badge>
            </Match>
          </Switch>
          <Show when={props.event.repeat}>
            <Badge>
              <Icon name="arrows-clockwise" size={14} />
              <Switch>
                <Match when={props.event.repeat === "Weekly"}>
                  <Trans>Every week</Trans>
                </Match>
                <Match when={props.event.repeat === "EveryTwoWeeks"}>
                  <Trans>Every 2 weeks</Trans>
                </Match>
                <Match when={props.event.repeat === "Monthly"}>
                  <Trans>Every month</Trans>
                </Match>
              </Switch>
            </Badge>
          </Show>
        </Badges>

        <CardTitle id={`event-${props.event._id}-title`}>
          {props.event.title}
        </CardTitle>

        <Facts>
          <Fact>
            <Icon name="clock" size={16} />
            <time datetime={props.event.starts_at}>{when()}</time>
          </Fact>
          <Fact>
            <Switch>
              <Match when={props.event.place.type === "Voice"}>
                <Icon name="speaker-high" size={16} />
                <span>{channel()?.name ?? t`A voice channel`}</span>
              </Match>
              <Match when={props.event.place.type === "Text"}>
                <Icon name="hash" size={16} />
                <span>{channel()?.name ?? t`A text channel`}</span>
              </Match>
              <Match when={props.event.place.type === "External"}>
                <Icon name={link() ? "link" : "globe"} size={16} />
                <span dir="auto">
                  {(props.event.place as { location: string }).location}
                </span>
              </Match>
            </Switch>
          </Fact>
          <Fact>
            <Icon name="users" size={16} />
            <span data-testid="event-interested-count">
              <Plural
                value={props.event.interested_count}
                _0="Nobody is interested yet"
                one="# interested"
                other="# interested"
              />
            </span>
          </Fact>
        </Facts>

        <Show when={props.event.description}>
          <Description tabIndex={0} role="region" aria-label={t`Description`}>
            <Markdown content={props.event.description!} />
          </Description>
        </Show>

        <Actions>
          <Show when={upcoming()}>
            <Button
              size="sm"
              variant={interested() ? "tonal" : "outlined"}
              aria-pressed={interested()}
              aria-disabled={marking() || undefined}
              onPress={() => void toggleInterest()}
              data-testid="event-interested"
            >
              <Icon name={interested() ? "bell-ringing" : "bell"} size={16} />
              {interested() ? (
                <Trans>Interested</Trans>
              ) : (
                <Trans>I'm interested</Trans>
              )}
            </Button>
          </Show>
          <Show when={phase() === "live"}>
            <JoinButton
              event={props.event}
              server={props.server}
              link={link()}
            />
          </Show>
          <Button
            size="sm"
            variant="text"
            onPress={share}
            data-testid="event-share"
          >
            <Icon name="share-network" size={16} />
            {copied() === "yes" ? (
              <Trans>Link copied</Trans>
            ) : (
              <Trans>Copy link</Trans>
            )}
          </Button>
          <Show when={copied() === "failed"}>
            <CopyFailed role="alert">
              <Trans>
                The link could not be copied. Copy it from the address bar.
              </Trans>
            </CopyFailed>
          </Show>
          <Show when={props.event.interested_count > 0}>
            <Button
              size="sm"
              variant="text"
              aria-expanded={showPeople()}
              onPress={() => {
                const open = !showPeople();
                setShowPeople(open);
                if (open && !people()) void loadPeople();
              }}
            >
              <Trans>Who's interested</Trans>
            </Button>
          </Show>
        </Actions>

        <Show when={showPeople()}>
          <People aria-label={t`Interested members`}>
            <For each={people()}>
              {(user) => (
                <Person>
                  <Avatar
                    size={24}
                    src={user.avatarURL}
                    fallback={user.displayName}
                  />
                  <span>{user.displayName}</span>
                </Person>
              )}
            </For>
            <Show when={next()}>
              <Button
                size="sm"
                variant="text"
                onPress={() => void loadPeople(true)}
              >
                <Trans>Show more</Trans>
              </Button>
            </Show>
          </People>
        </Show>

        <Show when={manager() && upcoming()}>
          <Manage>
            <Show
              when={confirm()}
              fallback={
                <>
                  <Button
                    size="sm"
                    variant="text"
                    onPress={() =>
                      openModal({
                        type: "server_event",
                        server: props.server,
                        event: props.event,
                      })
                    }
                    data-testid="event-edit"
                  >
                    <Icon name="pencil-simple" size={16} />
                    <Trans context="scheduled events">Edit</Trans>
                  </Button>
                  <Show
                    when={props.event.status === "Scheduled"}
                    fallback={
                      <Button
                        size="sm"
                        variant="text"
                        isDisabled={busy()}
                        onPress={() =>
                          void act(() =>
                            client().serverEvents.end(
                              props.server.id,
                              props.event._id,
                            ),
                          )
                        }
                        data-testid="event-end"
                      >
                        <Icon name="stop" size={16} />
                        <Trans context="scheduled events">End now</Trans>
                      </Button>
                    }
                  >
                    <Button
                      size="sm"
                      variant="text"
                      isDisabled={busy()}
                      onPress={() =>
                        void act(() =>
                          client().serverEvents.start(
                            props.server.id,
                            props.event._id,
                          ),
                        )
                      }
                      data-testid="event-start"
                    >
                      <Icon name="play" size={16} />
                      <Trans>Start now</Trans>
                    </Button>
                  </Show>
                  <Button
                    size="sm"
                    variant="text"
                    onPress={() => setConfirm("cancel")}
                    data-testid="event-cancel"
                  >
                    <Icon name="x" size={16} />
                    {repeating() ? (
                      <Trans>Cancel this time</Trans>
                    ) : (
                      <Trans>Cancel event</Trans>
                    )}
                  </Button>
                  <Show when={repeating()}>
                    <Button
                      size="sm"
                      variant="text"
                      onPress={() => setConfirm("series")}
                      data-testid="event-cancel-series"
                    >
                      <Icon name="arrows-clockwise" size={16} />
                      <Trans>Cancel the whole series</Trans>
                    </Button>
                  </Show>
                  <Show when={props.server.havePermission("ManageServer")}>
                    <Button
                      size="sm"
                      variant="text"
                      onPress={() => setConfirm("delete")}
                      data-testid="event-delete"
                    >
                      <Icon name="trash" size={16} />
                      <Trans context="scheduled events">Delete</Trans>
                    </Button>
                  </Show>
                </>
              }
            >
              <Confirm role="group">
                <span>
                  <Switch>
                    <Match when={confirm() === "cancel" && repeating()}>
                      <Trans>
                        Cancel this time only? The next one stays scheduled.
                      </Trans>
                    </Match>
                    <Match when={confirm() === "cancel"}>
                      <Trans>
                        Cancel this event? Interested members see that it is
                        off.
                      </Trans>
                    </Match>
                    <Match when={confirm() === "series"}>
                      <Trans>
                        Cancel this one and every one after it? Nothing more of
                        this series is scheduled.
                      </Trans>
                    </Match>
                    <Match when={repeating()}>
                      <Trans>
                        Delete this time and its interested list for good? The
                        next one stays scheduled.
                      </Trans>
                    </Match>
                    <Match when={true}>
                      <Trans>
                        Delete this event and its interested list for good?
                      </Trans>
                    </Match>
                  </Switch>
                </span>
                <Button
                  size="sm"
                  variant="_error"
                  isDisabled={busy()}
                  onPress={() =>
                    void act(async () => {
                      if (confirm() !== "delete")
                        await client().serverEvents.cancel(
                          props.server.id,
                          props.event._id,
                          confirm() === "series",
                        );
                      else
                        await client().serverEvents.delete(
                          props.server.id,
                          props.event._id,
                        );
                      setConfirm(undefined);
                    })
                  }
                  data-testid="event-confirm"
                >
                  {confirm() === "series" ? (
                    <Trans>Cancel the whole series</Trans>
                  ) : confirm() === "cancel" ? (
                    repeating() ? (
                      <Trans>Cancel this time</Trans>
                    ) : (
                      <Trans>Cancel event</Trans>
                    )
                  ) : (
                    <Trans context="scheduled events">Delete</Trans>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="text"
                  onPress={() => setConfirm(undefined)}
                >
                  <Trans context="scheduled events">Keep it</Trans>
                </Button>
              </Confirm>
            </Show>
          </Manage>
        </Show>

        <Show when={error()}>
          <Failure role="alert">
            <TranslatedError error={error()} />
          </Failure>
        </Show>
      </Content>
    </Card>
  );
}

/**
 * The way in while an event happens: join the voice channel, open the text
 * channel, or open the link (after the usual "leaving Zrzur" warning)
 */
export function JoinButton(props: {
  event: API.ServerEvent;
  server: Server;
  link?: string;
  size?: "sm" | "md";
}) {
  const client = useClient();
  const voice = useVoice();
  const state = useState();
  const navigate = useNavigate();
  const { openModal } = useModals();
  const channelId = () => serverEventChannel(props.event.place);

  function go() {
    const id = channelId();
    if (id) {
      // phones: the channel slides over the channel list, as when chosen there
      state.appDrawer()?.setShown(true);
      const channel = client().channels.get(id);
      if (props.event.place.type === "Voice" && channel) {
        if (voice.channel()?.id !== id) void voice.connect(channel);
      }
      navigate(`/server/${props.server.id}/channel/${id}`);
    } else if (props.link) {
      const url = new URL(props.link);
      openModal({ type: "link_warning", url, display: url.toString() });
    }
  }

  return (
    <Show when={channelId() || props.link}>
      <Button
        size={props.size ?? "sm"}
        variant="filled"
        onPress={go}
        data-testid="event-join"
      >
        <Switch>
          <Match when={props.event.place.type === "Voice"}>
            <Icon name="speaker-high" size={16} />
            <Trans context="scheduled events">Join</Trans>
          </Match>
          <Match when={props.event.place.type === "Text"}>
            <Icon name="hash" size={16} />
            <Trans context="scheduled events">Open</Trans>
          </Match>
          <Match when={props.event.place.type === "External"}>
            <Icon name="arrow-square-out" size={16} />
            <Trans>Open link</Trans>
          </Match>
        </Switch>
      </Button>
    </Show>
  );
}

const Card = styled("article", {
  base: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: "var(--z-radius-md, 14px)",
    background: "var(--z-card-bg, var(--z-bg-raised))",
    border: "1px solid var(--z-border-subtle)",
    "&[data-highlighted]": {
      borderColor: "var(--z-accent)",
    },
    "&[data-phase=live]": {
      borderColor: "color-mix(in srgb, var(--z-live) 60%, transparent)",
    },
  },
});

const Cover = styled("img", {
  base: {
    display: "block",
    width: "100%",
    aspectRatio: "16 / 9",
    maxHeight: "220px",
    objectFit: "cover",
    background: "var(--z-bg-input)",
  },
});

const Content = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    minWidth: 0,
    _phone: { padding: "12px" },
  },
});

const Badges = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    "&:empty": { display: "none" },
  },
});

const Badge = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    paddingInline: "8px",
    minHeight: "24px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 650,
    background: "var(--z-bg-input)",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "currentColor",
    "&[data-tone=live]": {
      background: "color-mix(in srgb, var(--z-live) 16%, transparent)",
      color: "var(--z-live)",
    },
    "&[data-tone=soon]": {
      background:
        "color-mix(in srgb, var(--z-status-warning) 16%, transparent)",
      color: "var(--z-status-warning)",
    },
    "&[data-tone=over]": { color: "var(--z-fg-muted)" },
  },
});

const Dot = styled("span", {
  base: {
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: "currentColor",
  },
});

const CardTitle = styled("h3", {
  base: {
    margin: 0,
    fontSize: "18px",
    lineHeight: "24px",
    fontWeight: 650,
    overflowWrap: "anywhere",
  },
});

const Facts = styled("ul", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
});

const Fact = styled("li", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "var(--z-fg-muted)",
    "& > span, & > time": { minWidth: 0, overflowWrap: "anywhere" },
  },
});

const Description = styled("div", {
  base: {
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-primary)",
    maxHeight: "120px",
    overflowY: "auto",
    borderRadius: "var(--z-radius-sm, 6px)",
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "4px",
    },
  },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
  },
});

const CopyFailed = styled("span", {
  base: {
    fontSize: "13px",
    color: "var(--z-danger)",
  },
});

const Manage = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    paddingBlockStart: "8px",
    borderBlockStart: "1px solid var(--z-border-subtle)",
  },
});

const Confirm = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    "& > span": { flexBasis: "100%" },
  },
});

const People = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-input)",
  },
});

const Person = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    minWidth: 0,
    "& > span": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

const Failure = styled("div", {
  base: {
    padding: "12px",
    borderRadius: "var(--z-radius, 10px)",
    background: "color-mix(in srgb, var(--z-danger) 12%, transparent)",
    fontSize: "13px",
    lineHeight: "18px",
  },
});
