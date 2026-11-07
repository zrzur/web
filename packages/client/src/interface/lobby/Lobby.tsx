import {
  For,
  JSX,
  Match,
  Show,
  Switch,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";

import { Plural, useLingui } from "@lingui/solid/macro";
import type { Channel, LobbySection, Server, ServerMember } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";
import { decodeTime } from "ulid";

import { lobbyStyle } from "@revolt/app/interface/settings/server/lobbyAppearance";

import { DEFAULT_SECTIONS } from "@revolt/app/interface/settings/server/lobbySections";
import { useClient } from "@revolt/client";
import { Markdown } from "@revolt/markdown";
import { useModals } from "@revolt/modal";
import { Navigate, useNavigate, useParams } from "@revolt/routing";
import { Avatar, Header, UserStatus } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import { RulesIcon } from "@revolt/ui/icons/RulesIcon";

/** The busiest channels shown when the managers picked none */
const AUTO_CHANNELS = 6;
/** Faces shown per voice room before "+N" */
const FACES = 4;
const WEEK = 7 * 24 * 60 * 60 * 1000;
/** Sections about people and right now, beside the reading column */
const SIDE: LobbySection[] = ["Live", "Newcomers", "Team"];

type StepId = "rules" | "hello" | "voice" | "profile";

/** Steps this member finished, kept on this device only */
function useSteps(serverId: string) {
  const key = `zrzur:lobby-steps:${serverId}`;
  const read = (): StepId[] => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "[]");
    } catch {
      return [];
    }
  };
  const [done, setDone] = createSignal<StepId[]>(read());
  const mark = (step: StepId) => {
    if (done().includes(step)) return;
    const next = [...done(), step];
    setDone(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // private mode: the tick lasts for this visit
    }
  };
  return { done, mark };
}

/**
 * A server's lobby: its first page. Greets the member, shows what to do
 * first, the latest news, what is happening right now (voice rooms, busy
 * channels, unread mentions), who just arrived and who runs the place.
 * Managers choose the sections and their order in Settings, Lobby;
 * everything is plain text or message Markdown.
 */
export function LobbyPage() {
  const params = useParams();
  const client = useClient();
  const server = createMemo(() => client()!.servers.get(params.server));

  return (
    <Show when={server()} fallback={<Navigate href="/" />}>
      {(server) => <Lobby server={server()} />}
    </Show>
  );
}

function Lobby(props: { server: Server }) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const navigate = useNavigate();
  const { openModal } = useModals();
  const lobby = () => props.server.lobby ?? {};
  const appearance = () => lobby().appearance ?? {};
  const steps = useSteps(props.server.id);

  const open = (channel: string) =>
    navigate(`/server/${props.server.id}/channel/${channel}`);

  // "Active 5 min ago" stays current while the page is open
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 60_000);
  onCleanup(() => clearInterval(timer));

  const number = (value: number) =>
    new Intl.NumberFormat(i18n().locale, {
      notation: value >= 10_000 ? "compact" : "standard",
      maximumFractionDigits: 1,
    }).format(value);

  const relative = (time: number) => {
    const minutes = Math.round((now() - time) / 60_000);
    const format = new Intl.RelativeTimeFormat(i18n().locale, {
      numeric: "auto",
    });
    return minutes < 60
      ? format.format(-Math.max(minutes, 0), "minute")
      : minutes < 60 * 24
        ? format.format(-Math.round(minutes / 60), "hour")
        : format.format(-Math.round(minutes / 60 / 24), "day");
  };

  const live = (id?: string) => !!id && now() - decodeTime(id) < 300_000;
  const ago = (id?: string) => {
    if (!id) return t`No messages yet`;
    if (live(id)) return t`Active now`;
    const when = relative(decodeTime(id));
    return t`Active ${when}`;
  };

  const readable = (channel?: Channel): channel is Channel =>
    !!channel && channel.havePermission("ViewChannel");
  const channel = (id?: string) =>
    id ? props.server.channels.find((c) => c.id === id) : undefined;

  const sections = () =>
    lobby().hide_sections
      ? []
      : lobby().sections?.length
        ? lobby().sections!
        : DEFAULT_SECTIONS;
  const shows = (section: LobbySection) => sections().includes(section);

  const voiceRooms = createMemo(() =>
    props.server.channels.filter(
      (c) => c.isVoice && c.voiceParticipants.size > 0 && readable(c),
    ),
  );
  const inVoice = () =>
    voiceRooms().reduce((sum, room) => sum + room.voiceParticipants.size, 0);

  // chosen channels, or the text channels with the newest messages
  const mainChannels = createMemo(() => {
    const chosen = (lobby().channels ?? []).map(channel).filter(readable);
    if (chosen.length) return chosen.slice(0, appearance().channel_limit ?? 9);
    return props.server.channels
      .filter((c) => !c.isVoice && readable(c))
      .sort((a, b) =>
        (b.lastMessageId ?? "").localeCompare(a.lastMessageId ?? ""),
      )
      .slice(0, appearance().channel_limit ?? AUTO_CHANNELS);
  });

  // where this member left off: unread mentions first, then unread channels
  const jumpBack = createMemo(() =>
    props.server.channels
      .filter((c) => !c.isVoice && readable(c))
      .filter((c) => c.unread || c.mentions?.size)
      .sort(
        (a, b) =>
          (b.mentions?.size ?? 0) - (a.mentions?.size ?? 0) ||
          (b.lastMessageId ?? "").localeCompare(a.lastMessageId ?? ""),
      )
      .slice(0, 4),
  );

  const actions = createMemo(() =>
    (lobby().actions ?? []).filter((a) => readable(channel(a.channel))),
  );
  const rules = () => {
    const c = props.server.rulesChannel;
    return readable(c) ? c : undefined;
  };
  const intro = () => {
    const c =
      channel(lobby().intro_channel) ??
      channel(lobby().actions?.[0]?.channel) ??
      mainChannels()[0];
    return readable(c) && c.havePermission("SendMessage") ? c : undefined;
  };
  const firstVoice = () =>
    voiceRooms()[0] ??
    props.server.channels.find((c) => c.isVoice && readable(c));

  // what a new member does first; each step ticks itself off
  const startSteps = createMemo(() => {
    const list: {
      id: StepId;
      label: string;
      done: boolean;
      run: () => void;
    }[] = [];
    const r = rules();
    if (r)
      list.push({
        id: "rules",
        label: t`Read the rules`,
        done:
          steps.done().includes("rules") ||
          (client().channelUnreads.loaded && !r.unread),
        run: () => (steps.mark("rules"), open(r.id)),
      });
    const hello = intro();
    if (hello)
      list.push({
        id: "hello",
        label: t`Say hello in #${hello.name}`,
        done: steps.done().includes("hello"),
        run: () => (steps.mark("hello"), open(hello.id)),
      });
    const voice = firstVoice();
    if (voice)
      list.push({
        id: "voice",
        label: t`Drop into a voice room`,
        done: steps.done().includes("voice"),
        run: () => (steps.mark("voice"), open(voice.id)),
      });
    list.push({
      id: "profile",
      label: t`Add a profile picture`,
      done: !!client().user?.avatar,
      run: () => openModal({ type: "settings", config: "user" }),
    });
    return list;
  });
  const stepsDone = () => startSteps().filter((s) => s.done).length;

  // latest news: the chosen channel, or the first announcement channel
  const newsChannel = () => {
    const c =
      channel(lobby().news_channel) ??
      props.server.channels.find((c) => c.announcement && readable(c));
    return readable(c) ? c : undefined;
  };
  const [news] = createResource(
    () => (shows("News") ? newsChannel()?.lastMessageId : undefined),
    () =>
      newsChannel()!
        .fetchMessages({ limit: 1 })
        .then((list) => list[0])
        .catch(() => undefined),
  );

  // members: for the team and this week's arrivals
  const [members] = createResource(
    () =>
      (shows("Team") && lobby().staff_roles?.length) || shows("Newcomers")
        ? props.server.id
        : undefined,
    () =>
      props.server
        .fetchMembers()
        .then((r) => r.members)
        .catch(() => [] as ServerMember[]),
  );
  // the server's count is a snapshot from load; the fetched list is current
  const memberCount = () =>
    Math.max(props.server.approximateMemberCount, members()?.length ?? 0);
  const newcomers = createMemo(() =>
    (members() ?? [])
      .filter((m) => now() - m.joinedAt.getTime() < WEEK && !m.user?.bot)
      .sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime()),
  );

  // staff: the owner, then members of the chosen roles, highest role first
  const staff = createMemo(() => {
    const roles = (lobby().staff_roles ?? [])
      .map((id) => props.server.roles.get(id))
      .filter((role) => !!role)
      .sort((a, b) => a!.rank - b!.rank);
    const owner = props.server.owner;
    const groups: {
      key: string;
      label: string;
      colour?: string;
      owner: boolean;
      people: { id: string; member?: ServerMember; name: string }[];
    }[] = [];
    const listed = new Set<string>();
    if (owner) {
      listed.add(owner.id);
      groups.push({
        key: "owner",
        label: t`Owner`,
        owner: true,
        people: [{ id: owner.id, name: owner.displayName }],
      });
    }
    for (const role of roles) {
      const people = (members() ?? [])
        .filter((m) => m.roles.includes(role!.id) && !listed.has(m.id.user))
        .map((m) => {
          listed.add(m.id.user);
          return {
            id: m.id.user,
            member: m,
            name: m.displayName ?? m.user?.displayName ?? "",
          };
        });
      if (people.length)
        groups.push({
          key: role!.id,
          label: role!.name,
          colour: role!.colour,
          owner: false,
          people,
        });
    }
    return groups;
  });

  const [faqQuery, setFaqQuery] = createSignal("");
  const faq = createMemo(() => {
    const q = faqQuery().trim().toLocaleLowerCase();
    const list = lobby().faq ?? [];
    return q
      ? list.filter(
          (entry) =>
            entry.question.toLocaleLowerCase().includes(q) ||
            entry.answer.toLocaleLowerCase().includes(q),
        )
      : list;
  });

  const canManage = () => props.server.havePermission("ManageServer");
  const me = () => props.server.member;
  const inviteChannel = () =>
    props.server.havePermission("InviteOthers")
      ? (intro() ?? mainChannels()[0])
      : undefined;

  const openProfile = (id: string, member?: ServerMember) => {
    const user = client().users.get(id);
    if (user) openModal({ type: "user_profile", user, member });
  };

  // one renderer per section, drawn in the managers' order
  const SECTIONS: Record<LobbySection, () => JSX.Element> = {
    Start: () => (
      <Show when={startSteps().length > 1 && stepsDone() < startSteps().length}>
        <Card>
          <CardHead>
            <CardTitle>{t`Start here`}</CardTitle>
            <Progress
              role="img"
              aria-label={t`${stepsDone()} of ${startSteps().length} done`}
              style={{
                "--done": `${(stepsDone() / startSteps().length) * 100}%`,
              }}
            >
              <span>
                {stepsDone()}/{startSteps().length}
              </span>
            </Progress>
          </CardHead>
          <Steps>
            <For each={startSteps()}>
              {(step) => (
                <Step
                  type="button"
                  data-done={step.done ? "" : undefined}
                  onClick={step.run}
                >
                  <Check>
                    <Show when={step.done}>
                      <Icon name="check" size={14} />
                    </Show>
                  </Check>
                  <span>{step.label}</span>
                  <Show when={!step.done}>
                    <Icon name="caret-right" size={16} data-chevron />
                  </Show>
                </Step>
              )}
            </For>
          </Steps>
        </Card>
      </Show>
    ),
    News: () => (
      <Show when={news()}>
        {(message) => (
          <Card>
            <CardHead>
              <CardTitle>
                <Icon name="megaphone" size={16} />
                {t`Latest news`}
              </CardTitle>
              <Small>{relative(message().createdAt.getTime())}</Small>
            </CardHead>
            <NewsBody>
              <Avatar
                size={36}
                src={message().avatarURL}
                fallback={message().username}
              />
              <div>
                <strong>{message().username}</strong>
                <Clamp>
                  <Markdown content={message().content} />
                </Clamp>
              </div>
            </NewsBody>
            <TextLink type="button" onClick={() => open(newsChannel()!.id)}>
              {t`Read in #${newsChannel()!.name}`}
              <Icon name="caret-right" size={14} data-chevron />
            </TextLink>
          </Card>
        )}
      </Show>
    ),
    About: () => (
      <Show when={lobby().about}>
        {(about) => (
          <Card>
            <CardTitle>{t`About`}</CardTitle>
            <Prose>
              <Markdown content={about()} />
            </Prose>
          </Card>
        )}
      </Show>
    ),
    Live: () => (
      <Show when={voiceRooms().length}>
        <Card>
          <CardTitle>
            <Dot />
            {t`Live now`}
          </CardTitle>
          <Tiles>
            <For each={voiceRooms()}>
              {(room) => {
                const people = () => [...room.voiceParticipants.values()];
                return (
                  <Tile type="button" onClick={() => open(room.id)}>
                    <TileIcon>
                      <Icon name="speaker-high" size={18} />
                    </TileIcon>
                    <TileText>
                      <strong>{room.name}</strong>
                      <small data-live>{t`${people().length} in voice`}</small>
                    </TileText>
                    <Faces>
                      <For each={people().slice(0, FACES)}>
                        {(person) => {
                          const user = () => client().users.get(person.userId);
                          return (
                            <Avatar
                              size={26}
                              src={user()?.avatarURL}
                              fallback={user()?.displayName}
                            />
                          );
                        }}
                      </For>
                      <Show when={people().length > FACES}>
                        <More>+{people().length - FACES}</More>
                      </Show>
                    </Faces>
                  </Tile>
                );
              }}
            </For>
          </Tiles>
        </Card>
      </Show>
    ),
    Channels: () => (
      <Show when={mainChannels().length}>
        <Card>
          <CardTitle>{t`Main channels`}</CardTitle>
          <Tiles>
            <For each={mainChannels()}>
              {(c) => (
                <ChannelTile channel={c} onOpen={open} ago={ago} live={live} />
              )}
            </For>
          </Tiles>
        </Card>
      </Show>
    ),
    Questions: () => (
      <Show when={lobby().faq?.length}>
        <Card>
          <CardTitle>{t`Questions and answers`}</CardTitle>
          <Show when={(lobby().faq?.length ?? 0) > 6}>
            <Search
              type="search"
              aria-label={t`Search questions`}
              placeholder={t`Search questions`}
              value={faqQuery()}
              onInput={(e) => setFaqQuery(e.currentTarget.value)}
            />
          </Show>
          <Questions>
            <For
              each={faq()}
              fallback={<Small>{t`No question matches.`}</Small>}
            >
              {(entry) => (
                <details>
                  <summary>
                    <span>{entry.question}</span>
                    <Icon name="caret-down" size={16} />
                  </summary>
                  <Prose>
                    <Markdown content={entry.answer} />
                  </Prose>
                </details>
              )}
            </For>
          </Questions>
        </Card>
      </Show>
    ),
    Newcomers: () => (
      <Show when={newcomers().length}>
        <Card>
          <CardHead>
            <CardTitle>{t`New this week`}</CardTitle>
            <Small>
              <Plural
                value={newcomers().length}
                one="# new member"
                other="# new members"
              />
            </Small>
          </CardHead>
          <Arrivals>
            <For each={newcomers().slice(0, appearance().newcomer_limit ?? 12)}>
              {(member) => {
                const name = () =>
                  member.displayName ?? member.user?.displayName ?? "";
                return (
                  <Arrival
                    type="button"
                    title={`${name()} · ${relative(member.joinedAt.getTime())}`}
                    onClick={() => openProfile(member.id.user, member)}
                  >
                    <Avatar
                      size={44}
                      src={member.avatarURL ?? member.user?.avatarURL}
                      fallback={name()}
                    />
                    <span>{name()}</span>
                  </Arrival>
                );
              }}
            </For>
          </Arrivals>
          <Show when={intro()}>
            {(hello) => (
              <TextLink type="button" onClick={() => open(hello().id)}>
                {t`Welcome them in #${hello().name}`}
                <Icon name="caret-right" size={14} data-chevron />
              </TextLink>
            )}
          </Show>
        </Card>
      </Show>
    ),
    Team: () => (
      <Show when={staff().length}>
        <Card>
          <CardTitle>{t`Who runs it`}</CardTitle>
          <For each={staff()}>
            {(group) => (
              <For each={group.people}>
                {(person) => {
                  const user = () => client().users.get(person.id);
                  return (
                    <Person
                      type="button"
                      onClick={() => openProfile(person.id, person.member)}
                    >
                      <Avatar
                        size={36}
                        src={person.member?.avatarURL ?? user()?.avatarURL}
                        fallback={person.name}
                        holepunch="bottom-right"
                        overlay={
                          <UserStatus.Graphic status={user()?.presence} />
                        }
                      />
                      <span>{person.name}</span>
                      <RoleTag
                        style={{ color: group.colour }}
                        data-owner={group.owner ? "" : undefined}
                      >
                        <Icon
                          name={group.owner ? "crown" : "shield"}
                          size={14}
                        />
                        {group.label}
                      </RoleTag>
                    </Person>
                  );
                }}
              </For>
            )}
          </For>
        </Card>
      </Show>
    ),
  };

  return (
    <Page
      style={lobbyStyle(lobby())}
      data-layout={appearance().layout ?? "Split"}
      data-density={appearance().density ?? "Comfortable"}
      data-banner={appearance().banner_mode ?? "Server"}
      data-custom-surface={!!appearance().surface}
    >
      <Header placement="primary">
        <LobbyTitle>
          <Icon name="house" size={20} />
          {t`Lobby`}
        </LobbyTitle>
        <Small data-end>{props.server.name}</Small>
      </Header>
      <Hero>
        <Show
          when={
            appearance().banner_mode !== "Gradient"
              ? props.server.banner
              : undefined
          }
          fallback={<BannerArt aria-hidden="true" />}
        >
          {(banner) => (
            <BannerFrame>
              <img
                src={banner().originalUrl}
                alt=""
                decoding="async"
                fetchpriority="high"
              />
              <BannerVeil aria-hidden="true" />
            </BannerFrame>
          )}
        </Show>
        <Glass data-flat={props.server.banner ? undefined : ""}>
          <Identity>
            <IconFrame>
              <Avatar
                size={76}
                shape="square"
                src={props.server.animatedIconURL}
                fallback={props.server.name}
                fallbackBackground={false}
              />
            </IconFrame>
            <IdentityText>
              <h1>{props.server.name}</h1>
              <Show when={lobby().tagline ?? props.server.description}>
                {(line) => <Tagline>{line()}</Tagline>}
              </Show>
              <Facts>
                <Show when={appearance().show_member_count !== false}>
                  <span>
                    <Icon name="users" size={16} />
                    <Plural
                      value={memberCount()}
                      one="# member"
                      other="# members"
                    />
                  </span>
                </Show>
                <Show when={inVoice()}>
                  <span data-live>
                    <Dot />
                    {t`${number(inVoice())} in voice`}
                  </span>
                </Show>
                <Show when={props.server.supercharge?.level}>
                  {(level) => (
                    <span data-wings>
                      <Icon name="lightning" size={16} />
                      {t`Wings level ${level()}`}
                    </span>
                  )}
                </Show>
              </Facts>
            </IdentityText>
          </Identity>
          <Actions>
            <Show when={appearance().show_chat !== false && intro()}>
              {(c) => (
                <ActionButton
                  data-main
                  type="button"
                  onClick={() => open(c().id)}
                >
                  <Icon name="hash" size={18} />
                  {t`Open chat`}
                  <Icon name="caret-right" size={16} data-chevron />
                </ActionButton>
              )}
            </Show>
            <Show when={rules()}>
              {(c) => (
                <ActionButton type="button" onClick={() => open(c().id)}>
                  {/* Same glyph as the rules room in the channel list. */}
                  <RulesIcon size={18} />
                  {t`Read the rules`}
                </ActionButton>
              )}
            </Show>
            {/* rules screening: newcomers accept before they can write */}
            <Show when={props.server.mustAcceptRules}>
              <ActionButton
                type="button"
                data-main=""
                onClick={() => void props.server.acceptRules()}
              >
                <Icon name="check" size={18} />
                {t`Accept the rules`}
              </ActionButton>
            </Show>
            <For each={actions()}>
              {(action, index) => (
                <ActionButton
                  type="button"
                  data-main={
                    !intro() && !rules() && index() === 0 ? "" : undefined
                  }
                  onClick={() => open(action.channel)}
                >
                  <Show when={action.emoji}>
                    <span aria-hidden="true">{action.emoji}</span>
                  </Show>
                  {action.label}
                </ActionButton>
              )}
            </For>
            <Show when={appearance().show_invite !== false && inviteChannel()}>
              {(c) => (
                <ActionButton
                  type="button"
                  onClick={() =>
                    openModal({ type: "create_invite", channel: c() })
                  }
                >
                  <Icon name="user-plus" size={18} />
                  {t`Invite people`}
                </ActionButton>
              )}
            </Show>
            <Show when={canManage()}>
              <ActionButton
                type="button"
                data-quiet
                aria-label={t`Edit lobby`}
                title={t`Edit lobby`}
                onClick={() =>
                  openModal({
                    type: "settings",
                    config: "server",
                    initialPage: "lobby",
                    context: props.server,
                  })
                }
              >
                <Icon name="pencil-simple" size={18} />
              </ActionButton>
            </Show>
          </Actions>
        </Glass>
      </Hero>

      <Content>
        <Show when={appearance().show_greeting !== false && me()}>
          {(member) => (
            <Greeting>
              <Switch>
                <Match when={now() - member().joinedAt.getTime() < WEEK}>
                  {t`Welcome, ${client().user?.displayName}! Glad you are here.`}
                </Match>
                <Match when>
                  {t`Welcome back, ${client().user?.displayName}. Member since ${member().joinedAt.toLocaleDateString(i18n().locale, { year: "numeric", month: "long" })}.`}
                </Match>
              </Switch>
            </Greeting>
          )}
        </Show>

        <Show when={jumpBack().length}>
          <Card>
            <CardTitle>{t`Jump back in`}</CardTitle>
            <Tiles>
              <For each={jumpBack()}>
                {(c) => (
                  <ChannelTile
                    channel={c}
                    onOpen={open}
                    ago={ago}
                    live={live}
                  />
                )}
              </For>
            </Tiles>
          </Card>
        </Show>

        <Columns data-columns>
          <Column>
            <For each={sections().filter((section) => !SIDE.includes(section))}>
              {(section) => SECTIONS[section]?.()}
            </For>
          </Column>
          <Column data-side>
            <For each={sections().filter((section) => SIDE.includes(section))}>
              {(section) => SECTIONS[section]?.()}
            </For>
          </Column>
        </Columns>

        <Show
          when={
            canManage() &&
            !lobby().about &&
            !lobby().faq?.length &&
            !lobby().actions?.length
          }
        >
          <Hint>
            <Icon name="paint-brush" size={18} />
            {t`Make this page yours in Server settings, Lobby: a welcome text, buttons, questions and your team.`}
          </Hint>
        </Show>
      </Content>
    </Page>
  );
}

function ChannelTile(props: {
  channel: Channel;
  onOpen: (id: string) => void;
  ago: (id?: string) => string;
  live: (id?: string) => boolean;
}) {
  const mentions = () => props.channel.mentions?.size ?? 0;
  return (
    <Tile
      type="button"
      data-unread={props.channel.unread ? "" : undefined}
      onClick={() => props.onOpen(props.channel.id)}
    >
      <TileIcon>
        <Show
          when={props.channel.server?.rulesChannelId !== props.channel.id}
          fallback={<RulesIcon size={18} />}
        >
          <Icon
            name={props.channel.announcement ? "megaphone" : "hash"}
            size={18}
          />
        </Show>
      </TileIcon>
      <TileText>
        <strong>{props.channel.name}</strong>
        <small data-live={props.live(props.channel.lastMessageId) || undefined}>
          {props.ago(props.channel.lastMessageId)}
        </small>
      </TileText>
      <Show
        when={mentions()}
        fallback={<Icon name="caret-right" size={16} data-chevron />}
      >
        <Badge>{mentions()}</Badge>
      </Show>
    </Tile>
  );
}

const Page = styled("div", {
  base: {
    "--lobby-accent-fallback": "var(--z-accent-fill, #E0195F)",
    flex: 1,
    width: "100%",
    minWidth: 0,
    height: "100%",
    overflowY: "auto",
    position: "relative",
    isolation: "isolate",
    background: "var(--z-bg-chat)",
    color: "var(--z-fg-primary)",
    overflowX: "hidden",
    "&[data-banner=Hidden] header > div:first-child": { display: "none" },
    "&[data-banner=Hidden] header > div:last-child": { marginBlockStart: 0 },
    "&[data-layout=Single] [data-columns]": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
    "&[data-layout=Single] [data-side]": { position: "static" },
    "&[data-custom-surface=true] section": {
      color: "var(--lobby-card-ink)",
      "--z-bg-raised": "var(--lobby-surface)",
      "--z-fg-primary": "var(--lobby-card-ink)",
      "--z-fg-secondary":
        "color-mix(in srgb, var(--lobby-card-ink) 84%, transparent)",
      "--z-fg-muted":
        "color-mix(in srgb, var(--lobby-card-ink) 72%, transparent)",
      "--z-border-subtle":
        "color-mix(in srgb, var(--lobby-card-ink) 14%, transparent)",
      "--z-field-bg": "var(--lobby-surface)",
      "--z-nav-hover":
        "color-mix(in srgb, var(--lobby-card-ink) 7%, transparent)",
    },
    "& [data-chevron]": { _rtl: { transform: "scaleX(-1)" } },
    "& button:focus-visible, & summary:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "3px",
    },
    "@media (prefers-reduced-motion: reduce)": {
      "& *, & *::before, & *::after": { transition: "none !important" },
    },
  },
});

/** Title in the shared Header so its bottom edge lines up with the server bar */
const LobbyTitle = styled("span", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "15px",
    fontWeight: 700,
    minWidth: 0,
  },
});

const Hero = styled("header", {
  base: {
    position: "relative",
    width: "min(100% - 64px, 1120px)",
    marginInline: "auto",
    paddingBlockStart: "28px",
    _phone: { width: "calc(100% - 32px)", paddingBlockStart: "16px" },
  },
});

/** A shallow banner crop keeps the community content above the fold. */
const BannerFrame = styled("div", {
  base: {
    position: "relative",
    height: "var(--lobby-banner-height, 208px)",
    width: "100%",
    borderRadius: "var(--lobby-radius, 14px)",
    overflow: "hidden",
    background: "var(--z-bg-chat)",
    boxShadow: "var(--z-card-lift)",
    "& img": {
      display: "block",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      objectPosition: "center",
    },
    _phone: { height: "clamp(100px, var(--lobby-banner-height), 180px)" },
  },
});

/** Subtle shading keeps uploaded banners readable without hiding their colours. */
const BannerVeil = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background: "linear-gradient(180deg, transparent 45%, rgb(0 0 0 / 0.28))",
  },
});

/** No banner: ink field with violet + soft pink atmosphere */
const BannerArt = styled("div", {
  base: {
    height: "var(--lobby-banner-height, 208px)",
    borderRadius: "var(--lobby-radius, 14px)",
    position: "relative",
    overflow: "hidden",
    background:
      "var(--lobby-banner-paint, radial-gradient(ellipse at 85% 10%, color-mix(in srgb, var(--lobby-accent, var(--lobby-accent-fallback)) 65%, transparent), transparent 65%), linear-gradient(120deg, var(--z-bg-raised), color-mix(in srgb, var(--lobby-accent, var(--lobby-accent-fallback)) 28%, var(--z-bg-chat))))",
    "&::before": {
      content: '""',
      position: "absolute",
      width: "360px",
      height: "360px",
      border: "1px solid rgb(255 255 255 / 0.12)",
      borderRadius: "50%",
      insetInlineEnd: "-30px",
      top: "-220px",
    },
    "&::after": {
      content: '""',
      position: "absolute",
      width: "360px",
      height: "360px",
      border: "1px solid rgb(255 255 255 / 0.08)",
      borderRadius: "50%",
      insetInlineEnd: "40px",
      top: "-175px",
    },
    _phone: { height: "clamp(100px, var(--lobby-banner-height), 180px)" },
  },
});

/** Server identity overlaps the banner and rests directly on the page. */
const Glass = styled("div", {
  base: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "16px 24px",
    marginInline: "0",
    marginBlockStart: "-26px",
    padding: "0 8px 24px",
    borderBlockEnd: "1px solid var(--z-border-subtle)",
    _phone: {
      marginInline: "0",
      marginBlockStart: "-22px",
      padding: "0 4px 20px",
    },
  },
});

const Identity = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    minWidth: 0,
    flex: "1 1 320px",
  },
});

const IconFrame = styled("div", {
  base: {
    // the frame alone rounds the picture; a line box would leave a strip under it
    display: "flex",
    flexShrink: 0,
    // a server with no picture shows initials: without its own colour the
    // box melts into the page and only its top edge shows on the banner
    background: "var(--z-nav-selected)",
    overflow: "hidden",
    borderRadius: "20px",
    boxShadow: "0 0 0 6px var(--z-bg-chat)",
  },
});

const IdentityText = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: 0,

    paddingBlockStart: "40px",
    paddingBlockEnd: "2px",
    "& h1": {
      margin: 0,
      fontSize: "24px",
      lineHeight: "32px",
      fontWeight: 700,
      letterSpacing: "-0.02em",
      overflowWrap: "anywhere",
      _phone: { fontSize: "22px", lineHeight: "28px" },
    },
  },
});

const Tagline = styled("p", {
  base: {
    margin: 0,
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    maxWidth: "42ch",
  },
});

const Facts = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px 14px",
    marginBlockStart: "2px",
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--z-fg-muted)",
    "--z-icon-color": "currentColor",
    "& > span": { display: "inline-flex", alignItems: "center", gap: "6px" },
    "& [data-live]": { color: "var(--z-status-success)" },
    "& [data-wings]": { color: "var(--z-warning, #F3B96B)" },
  },
});

const Dot = styled("span", {
  base: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "var(--z-status-success)",
    boxShadow:
      "0 0 0 3px color-mix(in srgb, var(--z-status-success) 25%, transparent)",
  },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    // phone: the main action fills the first row (beside the managers' edit
    // icon, which comes last and moves up there), the rest share the next rows
    _phone: {
      "& > *": { flex: "1 1 auto" },
      "& > [data-main]": { flex: "1 1 calc(100% - 56px)", order: -2 },
      "& > [data-quiet]": { flex: "0 0 auto", order: -1 },
    },
  },
});

/** Reading column and a narrower column for people and voice */
const Columns = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(240px, 300px)",
    alignItems: "start",
    gap: "var(--lobby-gap, 18px)",
    "&:has(> [data-side]:empty)": { gridTemplateColumns: "minmax(0, 1fr)" },
    "@media (max-width: 1150px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const Column = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--lobby-gap, 18px)",
    minWidth: 0,
    "&[data-side]:empty": { display: "none" },
    // the side column stays in view while the reading column scrolls
    "&[data-side]": {
      position: "sticky",
      insetBlockStart: "16px",
      "@media (max-width: 1100px)": { position: "static" },
    },
  },
});

const ActionButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minHeight: "40px",
    minWidth: "40px",
    paddingInline: "16px",
    borderRadius: "var(--z-shape-control, 10px)",
    border: "1px solid var(--z-btn-surface-border)",
    background: "var(--z-btn-surface-bg)",
    boxShadow: "var(--z-btn-surface-lift)",
    color: "var(--z-fg-primary)",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    transition:
      "background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease",
    _hover: { background: "var(--z-btn-surface-hover)" },
    _active: {
      boxShadow: "var(--z-btn-pressed)",
      transform: "translateY(1px)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    // Primary CTA stays Midnight Pulse violet — lobby accent tints chips /
    // banner / selection, never the filled action (link-blue must not paint buttons).
    "&[data-main]": {
      border:
        "1px solid color-mix(in srgb, var(--z-accent-fill, var(--lobby-accent-fallback)) 55%, transparent)",
      background:
        "linear-gradient(180deg, var(--z-accent-fill, var(--lobby-accent-fallback)), color-mix(in srgb, var(--z-accent-fill, var(--lobby-accent-fallback)) 82%, black))",
      boxShadow:
        "var(--z-btn-lift), 0 10px 22px -12px color-mix(in srgb, var(--z-accent-fill, var(--lobby-accent-fallback)) 70%, transparent)",
      color: "var(--z-on-accent, #fff)",
      _hover: {
        filter: "brightness(1.06)",
        background:
          "linear-gradient(180deg, color-mix(in srgb, white 8%, var(--z-accent-fill, var(--lobby-accent-fallback))), color-mix(in srgb, var(--z-accent-fill, var(--lobby-accent-fallback)) 78%, black))",
      },
    },
    "&[data-quiet]": {
      background: "var(--z-btn-outline-bg)",
      borderColor: "var(--z-btn-outline-border)",
      boxShadow: "none",
      color: "var(--z-fg-secondary)",
      _hover: {
        background: "var(--z-nav-hover)",
        color: "var(--z-fg-primary)",
      },
    },
    "&[aria-label]": { paddingInline: 0 },
    _phone: { minHeight: "44px", minWidth: "44px" },
  },
});

const Content = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--lobby-gap, 18px)",
    width: "min(100% - 64px, 1120px)",
    marginInline: "auto",
    paddingBlock: "24px 48px",
    _phone: { width: "calc(100% - 32px)", paddingBlockStart: "20px" },
  },
});

const Greeting = styled("p", {
  base: {
    margin: 0,
    padding: "0 2px",
    fontSize: "15px",
    fontWeight: 600,
    lineHeight: "22px",
    color: "var(--z-fg-primary)",
  },
});

const Card = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    minWidth: 0,
    padding: "var(--lobby-card-pad, 22px)",
    borderRadius: "var(--lobby-radius, 14px)",
    background: "var(--z-card-bg)",
    border: "1px solid var(--z-border-subtle)",
    boxShadow: "var(--z-card-lift)",
    _phone: { padding: "16px" },
  },
});

const CardHead = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
});

const CardTitle = styled("h2", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    margin: 0,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    color: "var(--z-fg-primary)",
    // Prefer brand accent text; lobby accent only tints, never a hard blue fill
    "--z-icon-color":
      "var(--z-accent-text, var(--lobby-heading-colour, #FF7AA8))",
  },
});

const Small = styled("span", {
  base: {
    fontSize: "13px",
    color: "var(--z-fg-muted)",
    "&[data-end]": {
      marginInlineStart: "auto",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

const Prose = styled("div", {
  base: {
    fontSize: "15px",
    lineHeight: "22px",
    color: "var(--z-fg-secondary)",
    overflowWrap: "anywhere",
  },
});

/** A ring that fills as steps are done */
const Progress = styled("div", {
  base: {
    display: "grid",
    placeItems: "center",
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background:
      "conic-gradient(var(--lobby-accent, var(--lobby-accent-fallback)) var(--done), color-mix(in srgb, var(--z-fg-primary) 12%, transparent) 0)",
    boxShadow:
      "inset 0 0 0 1px color-mix(in srgb, var(--z-fg-primary) 6%, transparent)",
    "& > span": {
      display: "grid",
      placeItems: "center",
      width: "30px",
      height: "30px",
      borderRadius: "50%",
      background: "var(--z-bg-raised)",
      fontSize: "11px",
      fontWeight: 800,
      color: "var(--z-fg-secondary)",
    },
  },
});

const Steps = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "2px" },
});

const Step = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "48px",
    paddingInline: "12px",
    marginInline: "-8px",
    borderRadius: "var(--z-shape-control, 10px)",
    border: "none",
    background: "none",
    color: "var(--z-fg-primary)",
    fontSize: "15px",
    fontWeight: 600,
    textAlign: "start",
    cursor: "pointer",
    transition: "background 0.12s ease",
    _hover: { background: "var(--z-nav-hover)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "& > span:nth-child(2)": { flex: 1 },
    "&[data-done] > span:nth-child(2)": {
      color: "var(--z-fg-muted)",
      textDecoration: "line-through",
      fontWeight: 500,
    },
    "& [data-chevron]": { color: "var(--z-fg-muted)", flexShrink: 0 },
  },
});

const Check = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    border:
      "2px solid color-mix(in srgb, var(--z-fg-primary) 22%, transparent)",
    flexShrink: 0,
    "[data-done] > &": {
      border: "none",
      background: "var(--z-status-success)",
      "--z-icon-color": "#0D0E16",
      boxShadow:
        "0 0 0 3px color-mix(in srgb, var(--z-status-success) 22%, transparent)",
    },
  },
});

const NewsBody = styled("div", {
  base: {
    display: "flex",
    gap: "12px",
    "& > div": { minWidth: 0, flex: 1 },
    "& strong": { fontSize: "15px" },
  },
});

/** The first lines of the announcement */
const Clamp = styled("div", {
  base: {
    marginBlockStart: "2px",
    fontSize: "15px",
    lineHeight: "22px",
    color: "var(--z-fg-secondary)",
    maxHeight: "132px",
    overflow: "hidden",
    maskImage: "linear-gradient(to bottom, black 70%, transparent)",
    overflowWrap: "anywhere",
  },
});

const TextLink = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: "4px",
    minHeight: "32px",
    padding: 0,
    border: "none",
    background: "none",
    color: "var(--lobby-heading-colour, var(--z-accent-text))",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _hover: { textDecoration: "underline" },
  },
});

const Tiles = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))",
    gap: "8px",
  },
});

const Tile = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "72px",
    padding: "14px",
    borderRadius: "var(--z-shape-control, 10px)",
    border: "1px solid var(--z-tile-border, var(--z-field-border))",
    background: "var(--z-tile-bg, var(--z-card-bg))",
    boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.04)",
    color: "inherit",
    textAlign: "start",
    cursor: "pointer",
    minWidth: 0,
    transition:
      "background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease",
    _hover: {
      background: "var(--z-nav-hover)",
      borderColor: "color-mix(in srgb, var(--z-fg-primary) 14%, transparent)",
      boxShadow: "var(--z-card-hover-lift)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "& [data-chevron]": { color: "var(--z-fg-muted)", flexShrink: 0 },
    "&[data-unread]": {
      borderColor:
        "color-mix(in srgb, var(--lobby-accent, var(--lobby-accent-fallback)) 35%, transparent)",
    },
    "&[data-unread] strong": { color: "var(--z-fg-primary)" },
  },
});

/** Icon alone — no tile/box behind it (brand: icons stand alone) */
const TileIcon = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    width: "24px",
    height: "24px",
    background: "none",
    border: "none",
    borderRadius: 0,
    "--z-icon-color": "var(--lobby-heading-colour, var(--z-accent-text))",
  },
});

const TileText = styled("span", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    flex: 1,
    minWidth: 0,
    "& strong": {
      fontSize: "14px",
      fontWeight: 700,
      color: "var(--z-fg-primary)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& small": { fontSize: "12px", color: "var(--z-fg-muted)" },
    "& small[data-live]": {
      color: "var(--z-status-success)",
      fontWeight: 600,
    },
  },
});

const Faces = styled("span", {
  base: {
    display: "flex",
    flexShrink: 0,
    "& > *": {
      marginInlineStart: "-8px",
      borderRadius: "50%",
      boxShadow: "0 0 0 2px var(--z-bg-raised)",
    },
  },
});

const More = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    width: "26px",
    height: "26px",
    fontSize: "11px",
    fontWeight: 700,
    background: "var(--z-bg-input)",
    color: "var(--z-fg-secondary)",
  },
});

const Badge = styled("span", {
  base: {
    minWidth: "20px",
    height: "20px",
    paddingInline: "6px",
    borderRadius: "999px",
    background: "var(--z-mention-badge, #C2337A)",
    color: "var(--z-on-mention-badge, #FFFFFF)",
    fontSize: "12px",
    fontWeight: 800,
    display: "grid",
    placeItems: "center",
  },
});

const Arrivals = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))",
    gap: "8px",
  },
});

const Arrival = styled("button", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    padding: "10px 6px",
    borderRadius: "var(--z-shape-control, 10px)",
    border: "1px solid transparent",
    background: "none",
    color: "var(--z-fg-secondary)",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    minWidth: 0,
    transition: "background 0.12s ease, border-color 0.12s ease",
    _hover: {
      background: "var(--z-nav-hover)",
      borderColor: "var(--z-border-subtle)",
      color: "var(--z-fg-primary)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "& > span": {
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

const Search = styled("input", {
  base: {
    minHeight: "40px",
    paddingInline: "12px",
    borderRadius: "var(--z-shape-control, 10px)",
    border: "1px solid var(--z-field-border)",
    background: "var(--z-field-bg)",
    boxShadow: "var(--z-field-shadow)",
    color: "var(--z-fg-primary)",
    fontSize: "14px",
    _focusVisible: {
      outline: "none",
      boxShadow: "var(--z-field-focus-shadow)",
      borderColor: "color-mix(in srgb, var(--z-accent) 45%, transparent)",
    },
    _phone: { fontSize: "16px", minHeight: "44px" },
  },
});

/** Native disclosure rows: keyboard and screen readers work as is */
const Questions = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    "& details": {
      borderRadius: "var(--z-shape-control, 10px)",
      border: "1px solid var(--z-field-border)",
      background: "var(--z-field-bg)",
      boxShadow: "var(--z-field-shadow)",
      overflow: "hidden",
    },
    "& summary": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      minHeight: "48px",
      padding: "10px 14px",
      fontSize: "14px",
      fontWeight: 700,
      cursor: "pointer",
      listStyle: "none",
      "&::-webkit-details-marker": { display: "none" },
      "& svg": {
        flexShrink: 0,
        color: "var(--z-fg-muted)",
        transition: "transform 0.15s ease",
      },
    },
    "& details[open] summary svg": { transform: "rotate(180deg)" },
    "& details > div": {
      padding: "0 14px 14px",
      color: "var(--z-fg-secondary)",
      fontSize: "14px",
      lineHeight: "20px",
    },
  },
});

const Person = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "48px",
    padding: "8px 10px",
    marginInline: "-8px",
    borderRadius: "var(--z-shape-control, 10px)",
    border: "none",
    background: "none",
    color: "inherit",
    textAlign: "start",
    cursor: "pointer",
    transition: "background 0.12s ease",
    _hover: { background: "var(--z-nav-hover)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "& > span:nth-child(2)": {
      flex: 1,
      minWidth: 0,
      fontSize: "14px",
      fontWeight: 700,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

const RoleTag = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    flexShrink: 0,
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--z-fg-muted)",
    "--z-icon-color": "currentColor",
    "&[data-owner]": { color: "var(--z-warning, #F3B96B)" },
  },
});

const Hint = styled("p", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    margin: 0,
    padding: "14px 16px",
    borderRadius: "var(--lobby-radius, 14px)",
    border:
      "1px dashed color-mix(in srgb, var(--lobby-accent, var(--lobby-accent-fallback)) 35%, var(--z-border-subtle))",
    background:
      "color-mix(in srgb, var(--lobby-accent, var(--lobby-accent-fallback)) 6%, transparent)",
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "var(--lobby-heading-colour, var(--z-accent-text))",
  },
});
