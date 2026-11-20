import {
  For,
  Match,
  Show,
  Suspense,
  Switch,
  createMemo,
  createSignal,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useQuery } from "@tanstack/solid-query";
import type { Channel, File, Message } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { ContextMenu } from "@revolt/app/menus/ContextMenu";
import { NotificationContextMenu } from "@revolt/app/menus/shared/NotificationContextMenu";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { type IconName, Icon } from "@revolt/ui/icons/Icon";

import { MemberSidebar } from "./MemberSidebar";
import type { SidebarState } from "./TextChannel";
import { TextSearchSidebar } from "./TextSearchSidebar";
import { ThreadsPanel } from "./ThreadsPanel";

export type DetailsTab =
  | "members"
  | "media"
  | "pins"
  | "threads"
  | "links"
  | "files";

/**
 * Phones: everything about a channel on one screen (owner, 2026-11-17). The
 * header's members, search and "more" used to open three different things;
 * now one screen holds them:
 *
 * [back]                 [search] [notifications] [settings]
 * # name
 * Text channel · Server
 * the channel's description
 * Members · Media · Pins · Threads · Links · Files
 *
 * Members: an invite row, then the member list by role.
 * Media: pictures and videos, three in a row. Links and Files: cards, two in
 * a row. Pins and Threads: their lists. Each empty tab says so in two lines.
 *
 * Media, Links and Files are the channel's own search with a "has" filter,
 * so they show what the search can find and need no route of their own.
 */
export function ChannelDetailsPhone(props: {
  channel: Channel;
  tab: DetailsTab;
  setSidebarState: (state: SidebarState) => void;
  scrollTargetElement: HTMLDivElement;
  isLargeServer: boolean;
}) {
  const { t } = useLingui();
  const { openModal } = useModals();

  const hasMembers = () =>
    !["SavedMessages", "DirectMessage"].includes(props.channel.type);
  const hasThreads = () =>
    props.channel.type === "TextChannel" &&
    !props.channel.isVoice &&
    !props.channel.isThread &&
    !props.channel.isForum;
  const canOpenSettings = () =>
    (props.channel.type === "Group" || !!props.channel.serverId) &&
    props.channel.orPermission("ManageChannel", "ManagePermissions");
  const canInvite = () =>
    !!props.channel.server && props.channel.havePermission("InviteOthers");

  // only to know whether Pins is empty: an empty tab shows the screen's
  // one empty state, not the list's own smaller line
  const pins = useQuery(() => ({
    enabled: props.tab === "pins",
    queryKey: ["channel-details", props.channel.id, "pins"],
    queryFn: async () =>
      (
        await props.channel.searchWithUsers({
          pinned: true,
          sort: "Latest",
        } as never)
      ).messages,
    staleTime: 30_000,
    retry: false,
  }));

  const tabs = createMemo(() => {
    const list: { id: DetailsTab; label: string }[] = [];
    if (hasMembers()) list.push({ id: "members", label: t`Members` });
    list.push({ id: "media", label: t`Media` });
    list.push({ id: "pins", label: t`Pins` });
    if (hasThreads()) list.push({ id: "threads", label: t`Threads` });
    list.push({ id: "links", label: t`Links` });
    list.push({ id: "files", label: t`Files` });
    return list;
  });
  const tab = () =>
    tabs().some((item) => item.id === props.tab) ? props.tab : tabs()[0].id;
  const open = (id: DetailsTab) =>
    props.setSidebarState({ state: "details", tab: id });

  const kind = () => {
    const what = props.channel.isVoice
      ? t`Voice channel`
      : props.channel.type === "Group"
        ? t`Group`
        : props.channel.type === "DirectMessage"
          ? t`Direct message`
          : props.channel.type === "SavedMessages"
            ? t`Saved notes`
            : t`Text channel`;
    return props.channel.server ? [what, props.channel.server.name] : [what];
  };
  const name = () =>
    props.channel.type === "DirectMessage"
      ? (props.channel.recipient?.displayName ?? "")
      : props.channel.type === "SavedMessages"
        ? t`Saved notes`
        : (props.channel.name ?? "");

  return (
    <Page data-channel-details>
      <Top>
        <TopButton
          type="button"
          aria-label={t`Back`}
          onClick={() => props.setSidebarState({ state: "default" })}
        >
          <Icon name="arrow-left" size={22} />
        </TopButton>
        <Spacer />
        <TopButton
          type="button"
          aria-label={t`Search messages`}
          onClick={() => props.setSidebarState({ state: "search", query: "" })}
        >
          <Icon name="magnifying-glass" size={22} />
        </TopButton>
        {/* a native element holds the menu (use:floating is ignored on a
            component); a tap opens the same choices a long press does */}
        <span
          style={{ display: "contents" }}
          use:floating={{
            contextMenu: () => (
              <ContextMenu>
                <NotificationContextMenu channel={props.channel} />
              </ContextMenu>
            ),
          }}
        >
          <TopButton
            type="button"
            aria-label={t`Notifications`}
            aria-haspopup="menu"
            onClick={(event) =>
              event.currentTarget.dispatchEvent(
                new MouseEvent("contextmenu", {
                  bubbles: true,
                  clientX: event.clientX,
                  clientY: event.clientY,
                }),
              )
            }
          >
            <Icon name="bell" size={22} />
          </TopButton>
        </span>
        <Show when={canOpenSettings()}>
          <TopButton
            type="button"
            aria-label={t`Channel settings`}
            onClick={() =>
              openModal({
                type: "settings",
                config: "channel",
                context: props.channel,
              })
            }
          >
            <Icon name="gear-six" size={22} />
          </TopButton>
        </Show>
      </Top>

      <Head>
        <h1>
          <Icon
            name={props.channel.isVoice ? "speaker-high" : "hash"}
            size={22}
          />
          <bdi>{name()}</bdi>
        </h1>
        <Kind>
          <For each={kind()}>
            {(part, index) => (
              <>
                <Show when={index() > 0}>
                  <span aria-hidden="true">·</span>
                </Show>
                <bdi>{part}</bdi>
              </>
            )}
          </For>
        </Kind>
        <Show when={props.channel.description}>
          <p dir="auto">{props.channel.description}</p>
        </Show>
      </Head>

      <Tabs
        role="tablist"
        aria-label={t`Channel details`}
        // a sideways drag on the tabs scrolls the tabs; it is not the swipe
        // that slides the page away (the last tabs could not be reached)
        onTouchStart={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        <For each={tabs()}>
          {(item) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab() === item.id}
              onClick={(event) => {
                open(item.id);
                event.currentTarget.scrollIntoView({
                  inline: "center",
                  block: "nearest",
                });
              }}
            >
              {item.label}
            </button>
          )}
        </For>
      </Tabs>

      <Body role="tabpanel">
        {/* A tab that is still asking for its content waits here, under the
            header and the tabs. Without this the nearest place to wait was
            the whole screen: every change of tab blanked it (owner,
            2026-11-18) */}
        <Suspense
          fallback={
            <Quiet role="status">
              <Trans>Loading…</Trans>
            </Quiet>
          }
        >
          <Switch>
            <Match when={tab() === "members"}>
              <Show when={canInvite()}>
                <Group>
                  <Row
                    type="button"
                    data-invite
                    onClick={() =>
                      openModal({
                        type: "create_invite",
                        channel: props.channel,
                      })
                    }
                  >
                    <Icon name="user-plus" size={22} />
                    <span>
                      <Trans>Invite members</Trans>
                    </span>
                    <Icon name="caret-right" size={16} />
                  </Row>
                </Group>
              </Show>
              <Members>
                <MemberSidebar
                  channel={props.channel}
                  scrollTargetElement={props.scrollTargetElement}
                  isLargeServer={props.isLargeServer}
                />
              </Members>
            </Match>
            <Match when={tab() === "media"}>
              <Finds channel={props.channel} what="media" />
            </Match>
            <Match when={tab() === "links"}>
              <Finds channel={props.channel} what="links" />
            </Match>
            <Match when={tab() === "files"}>
              <Finds channel={props.channel} what="files" />
            </Match>
            <Match when={tab() === "pins"}>
              <Show
                when={pins.data?.length !== 0}
                fallback={
                  <Empty data-empty="pins">
                    <Icon name="push-pin" size={44} />
                    <b>
                      <Trans>No pinned messages yet</Trans>
                    </b>
                    <span>
                      <Trans>
                        Pin an important message from its menu to keep it here.
                      </Trans>
                    </span>
                  </Empty>
                }
              >
                <Listed>
                  <TextSearchSidebar
                    channel={props.channel}
                    query={{ pinned: true, sort: "Latest" }}
                  />
                </Listed>
              </Show>
            </Match>
            <Match when={tab() === "threads"}>
              <Listed>
                <ThreadsPanel channel={props.channel} />
              </Listed>
            </Match>
          </Switch>
        </Suspense>
      </Body>
    </Page>
  );
}

type What = "media" | "links" | "files";

const isPicture = (file: File) =>
  file.metadata?.type === "Image" || file.metadata?.type === "Video";

/**
 * Media, links or files of a channel: its search with a "has" filter, newest
 * first, drawn as a grid (media) or as cards (links, files)
 */
function Finds(props: { channel: Channel; what: What }) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [failedOnce, setFailedOnce] = createSignal(false);

  const has = () =>
    props.what === "media"
      ? ["image", "video"]
      : props.what === "links"
        ? ["link"]
        : ["file"];

  const query = useQuery(() => ({
    queryKey: ["channel-details", props.channel.id, props.what],
    queryFn: async () => {
      // one request per kind: the search takes one "has" at a time on some
      // servers, and two answers put together are still newest first
      const lists = await Promise.all(
        has().map((kind) =>
          props.channel
            .searchWithUsers({ has: [kind], sort: "Latest" } as never)
            .then((result) => result.messages),
        ),
      );
      const seen = new Set<string>();
      return lists
        .flat()
        .filter((message) => !seen.has(message.id) && seen.add(message.id))
        .sort((a, b) => (a.id < b.id ? 1 : -1));
    },
    staleTime: 60_000,
    retry: false,
  }));

  const jump = (message: Message) => navigate(message.path);
  const who = (message: Message) =>
    message.masquerade?.name ??
    message.member?.displayName ??
    message.author?.displayName ??
    "";

  const media = createMemo(() =>
    (query.data ?? []).flatMap((message) =>
      (message.attachments ?? [])
        .filter(isPicture)
        .map((file) => ({ message, file })),
    ),
  );
  const files = createMemo(() =>
    (query.data ?? []).flatMap((message) =>
      (message.attachments ?? [])
        .filter((file) => !isPicture(file))
        .map((file) => ({ message, file })),
    ),
  );
  type Link = {
    url?: string;
    title?: string;
    siteName?: string;
    image?: { proxiedURL?: string };
  };
  const links = createMemo(() =>
    (query.data ?? []).flatMap((message) => {
      const previews = (message.embeds ?? [])
        .filter(
          (embed) =>
            embed.type === "Website" && !!(embed as { url?: string }).url,
        )
        .map((embed) => ({ message, embed: embed as Link }));
      if (previews.length) return previews;
      // a link whose site gave no preview is still a link: its address
      const seen = new Set<string>();
      return (message.content?.match(/https?:\/\/[^\s<>()]+/g) ?? [])
        .filter((url) => !seen.has(url) && seen.add(url))
        .map((url) => ({ message, embed: { url } as Link }));
    }),
  );
  const count = () =>
    props.what === "media"
      ? media().length
      : props.what === "links"
        ? links().length
        : files().length;

  const empty: Record<What, { icon: IconName; title: string; text: string }> = {
    media: {
      icon: "image",
      title: t`No pictures or videos yet`,
      text: t`Pictures and videos sent in this channel show here.`,
    },
    links: {
      icon: "link",
      title: t`No links yet`,
      text: t`Links sent in this channel show here.`,
    },
    files: {
      icon: "file-text",
      title: t`No files yet`,
      text: t`Files sent in this channel show here.`,
    },
  };

  const host = (url?: string) => {
    try {
      return new URL(url ?? "").host.replace(/^www\./, "");
    } catch {
      return url ?? "";
    }
  };

  return (
    <Switch>
      <Match when={query.isLoading}>
        <Quiet role="status">
          <Trans>Loading…</Trans>
        </Quiet>
      </Match>
      <Match when={query.isError}>
        <Empty>
          <Icon name="warning-circle" size={44} />
          <b>
            <Trans>This list couldn't be loaded</Trans>
          </b>
          <span>
            <Trans>Check your connection and try again.</Trans>
          </span>
          <Retry
            type="button"
            onClick={() => {
              setFailedOnce(true);
              void query.refetch();
            }}
          >
            <Trans>Try again</Trans>
          </Retry>
          <Show when={failedOnce()}>
            <span role="alert">
              <Trans>Still not loading.</Trans>
            </span>
          </Show>
        </Empty>
      </Match>
      <Match when={count() === 0}>
        <Empty data-empty={props.what}>
          <Icon name={empty[props.what].icon} size={44} />
          <b>{empty[props.what].title}</b>
          <span>{empty[props.what].text}</span>
        </Empty>
      </Match>
      <Match when={props.what === "media"}>
        <Grid3 data-media>
          <For each={media()}>
            {(item) => (
              <button
                type="button"
                aria-label={t`Jump to message`}
                onClick={() => jump(item.message)}
              >
                <Show
                  when={item.file.metadata?.type === "Image"}
                  fallback={
                    <>
                      <video
                        src={item.file.originalUrl}
                        preload="metadata"
                        muted
                        playsinline
                      />
                      <Play>
                        <Icon name="play" size={22} />
                      </Play>
                    </>
                  }
                >
                  <img src={item.file.previewUrl} alt="" loading="lazy" />
                </Show>
              </button>
            )}
          </For>
        </Grid3>
      </Match>
      <Match when={props.what === "links"}>
        <Grid2 data-links>
          <For each={links()}>
            {(item) => (
              <Card type="button" onClick={() => jump(item.message)}>
                <Show
                  when={item.embed.image?.proxiedURL}
                  fallback={
                    <Blank>
                      <Icon name="link" size={26} />
                    </Blank>
                  }
                >
                  <img
                    src={item.embed.image!.proxiedURL}
                    alt=""
                    loading="lazy"
                  />
                </Show>
                <CardText>
                  <b dir="auto">
                    {item.embed.title ??
                      item.embed.siteName ??
                      host(item.embed.url)}
                  </b>
                  <Address dir="ltr">{host(item.embed.url)}</Address>
                  <small>
                    <bdi>{who(item.message)}</bdi>
                  </small>
                </CardText>
              </Card>
            )}
          </For>
        </Grid2>
      </Match>
      <Match when={props.what === "files"}>
        <Grid2 data-files>
          <For each={files()}>
            {(item) => (
              <Card type="button" data-file onClick={() => jump(item.message)}>
                <CardText>
                  <Icon name="file-text" size={26} />
                  <b dir="ltr">{item.file.filename ?? t`File`}</b>
                  <small dir="ltr">{item.file.humanReadableSize}</small>
                  <small>
                    <bdi>{who(item.message)}</bdi>
                  </small>
                </CardText>
              </Card>
            )}
          </For>
        </Grid2>
      </Match>
    </Switch>
  );
}

/** one fill for every box, as everywhere on phones */
const FILL =
  "var(--z-sheet-group, color-mix(in srgb, var(--z-fg-primary) 5%, transparent))";

const Page = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    minWidth: 0,
    minHeight: "100%",
    color: "var(--z-fg-primary)",
    background: "var(--z-bg-frame)",
  },
});

const Top = styled("div", {
  base: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    gap: "4px",
    minHeight: "56px",
    paddingInline: "6px",
    paddingBlockStart: "var(--z-phone-top-gap, 0px)",
    background: "var(--z-bg-frame)",
  },
});

const TopButton = styled("button", {
  base: {
    flex: "none",
    display: "grid",
    placeItems: "center",
    width: "44px",
    height: "44px",
    border: "none",
    borderRadius: "12px",
    background: "none",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "currentColor",
    cursor: "pointer",
    _active: {
      background: "color-mix(in srgb, var(--z-fg-primary) 10%, transparent)",
    },
    _focusVisible: {
      outline: "none",
      boxShadow: "inset 0 0 0 2px var(--z-focus)",
    },
  },
});

const Spacer = styled("span", { base: { flex: 1 } });

const Head = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "4px 18px 14px",
    "& h1": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      margin: 0,
      fontSize: "22px",
      lineHeight: "30px",
      fontWeight: 700,
      minWidth: 0,
      "--z-icon-color": "var(--z-fg-muted)",
    },
    "& h1 bdi": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& p": {
      margin: "4px 0 0",
      fontSize: "14px",
      lineHeight: "22px",
      color: "var(--z-fg-secondary)",
      overflowWrap: "anywhere",
    },
  },
});

const Kind = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0 6px",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
  },
});

const Tabs = styled("div", {
  base: {
    flex: "none",
    display: "flex",
    gap: "4px",
    maxWidth: "100%",
    paddingInline: "10px",
    overflowX: "auto",
    overscrollBehaviorX: "contain",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
    borderBottom: "1px solid var(--z-border-subtle)",
    "& button": {
      position: "relative",
      flex: "none",
      minHeight: "44px",
      paddingInline: "10px",
      border: "none",
      background: "none",
      color: "var(--z-fg-muted)",
      font: "inherit",
      fontSize: "15px",
      fontWeight: 500,
      whiteSpace: "nowrap",
      cursor: "pointer",
    },
    "& button[aria-selected='true']": {
      color: "var(--z-fg-primary)",
      fontWeight: 600,
    },
    "& button[aria-selected='true']::before": {
      content: '""',
      position: "absolute",
      insetInline: "10px",
      bottom: "-1px",
      height: "2px",
      borderRadius: "2px",
      background: "var(--z-accent)",
    },
    "& button:focus-visible": {
      outline: "none",
      boxShadow: "inset 0 0 0 2px var(--z-focus)",
      borderRadius: "8px",
    },
  },
});

const Body = styled("div", {
  base: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px 12px 24px",
  },
});

const Group = styled("div", {
  base: {
    borderRadius: "14px",
    overflow: "hidden",
    background: FILL,
  },
});

const Row = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    width: "100%",
    minHeight: "52px",
    padding: "8px 14px",
    border: "none",
    background: "none",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "16px",
    fontWeight: 500,
    textAlign: "start",
    cursor: "pointer",
    "--z-icon-color": "var(--z-icon-neutral)",
    // the words take the room between the two icons (an icon is a span too)
    "& > span:not(.z-icon)": { flex: 1, minWidth: 0, textAlign: "start" },
    "& > :last-child": { "--z-icon-color": "var(--z-icon-muted)" },
    _active: {
      background: "color-mix(in srgb, var(--z-fg-primary) 10%, transparent)",
    },
  },
});

/**
 * The member list brings its own rows (one list for every screen size, drawn
 * a screen at a time, each row 44 px). Here it sits in a filled box and takes
 * the finish of the settings groups: the titles and the people start on the
 * same line as the invite row's icon, a person's name in the size of a
 * settings row, the title quiet above its people.
 */
const Members = styled("div", {
  base: {
    borderRadius: "var(--z-box-radius)",
    overflow: "hidden",
    background: "var(--z-box-bg)",
    // room under the last person; the first title brings its own room above
    paddingBlock: "0 8px",
    "& > *": {
      width: "100% !important",
      minHeight: "0 !important",
      background: "transparent !important",
      border: "none !important",
    },
    // a group's title: "Online – 3"
    "& div:has(> span + span):not(:has(.z-control-feedback))": {
      paddingInline: "14px !important",
      fontSize: "13px !important",
      fontWeight: 600,
      letterSpacing: "0 !important",
      textTransform: "none !important",
      color: "var(--z-fg-muted) !important",
    },
    // a person: picture, then the name, on the invite row's line
    "& :has(> .z-control-feedback)": {
      marginInline: "6px !important",
      paddingInline: "8px !important",
      gap: "12px !important",
      fontSize: "16px !important",
      fontWeight: 500,
      borderRadius: "12px !important",
    },
    border: "var(--z-box-border)",
  },
});

/** pins and threads: their own lists, edge to edge inside the page's room */
const Listed = styled("div", {
  base: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    marginInline: "-4px",
    minHeight: 0,
  },
});

const Grid3 = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "4px",
    borderRadius: "14px",
    overflow: "hidden",
    "& button": {
      position: "relative",
      aspectRatio: "1",
      padding: 0,
      border: "none",
      background: FILL,
      cursor: "pointer",
      overflow: "hidden",
    },
    "& img, & video": {
      display: "block",
      width: "100%",
      height: "100%",
      objectFit: "cover",
    },
  },
});

const Play = styled("span", {
  base: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    color: "#FFFFFF",
    "--z-icon-color": "currentColor",
    background: "rgb(0 0 0 / 0.25)",
  },
});

const Grid2 = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
  },
});

const Card = styled("button", {
  base: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    padding: 0,
    border: "none",
    borderRadius: "14px",
    overflow: "hidden",
    background: FILL,
    color: "var(--z-fg-primary)",
    font: "inherit",
    textAlign: "start",
    cursor: "pointer",
    "& > img": {
      display: "block",
      width: "100%",
      height: "84px",
      objectFit: "cover",
    },
    "&[data-file]": { "--z-icon-color": "var(--z-fg-secondary)" },
    _active: {
      background: "color-mix(in srgb, var(--z-fg-primary) 10%, transparent)",
    },
  },
});

const Blank = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    height: "84px",
    "--z-icon-color": "var(--z-icon-muted)",
    background: "color-mix(in srgb, var(--z-fg-primary) 4%, transparent)",
  },
});

const CardText = styled("span", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
    padding: "12px",
    "& b": {
      fontSize: "14px",
      lineHeight: "20px",
      fontWeight: 600,
      lineClamp: 2,
      overflowWrap: "anywhere",
      textAlign: "start",
    },
    "& small": {
      fontSize: "12px",
      lineHeight: "18px",
      color: "var(--z-fg-muted)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      textAlign: "start",
    },
  },
});

const Address = styled("span", {
  base: {
    fontSize: "12px",
    lineHeight: "18px",
    color: "var(--z-link, var(--z-accent-text))",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "start",
  },
});

const Empty = styled("div", {
  base: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "48px 32px",
    textAlign: "center",
    "--z-icon-color": "var(--z-icon-muted)",
    "& b": { marginBlockStart: "8px", fontSize: "18px", fontWeight: 600 },
    "& span": {
      fontSize: "14px",
      lineHeight: "22px",
      color: "var(--z-fg-muted)",
    },
  },
});

const Retry = styled("button", {
  base: {
    marginBlockStart: "10px",
    minHeight: "40px",
    paddingInline: "18px",
    border: "none",
    borderRadius: "12px",
    background: FILL,
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
  },
});

const Quiet = styled("p", {
  base: {
    margin: 0,
    padding: "32px 16px",
    textAlign: "center",
    fontSize: "14px",
    color: "var(--z-fg-muted)",
  },
});
