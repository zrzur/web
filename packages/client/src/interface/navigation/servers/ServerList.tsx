import { Accessor, For, JSX, Match, Show, Switch, createMemo } from "solid-js";
import { Portal } from "solid-js/web";

import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/solid/macro";
import { Channel, Server, User } from "@zrzur/sdk/solid";
import { css, cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { ServerFolderContextMenu } from "@revolt/app/menus";
import { useClient } from "@revolt/client";
import { CONFIGURATION, useDevice } from "@revolt/common";
import { brandMarkSrc } from "@revolt/common/lib/brandMark";
import { KeybindAction, createKeybind } from "@revolt/keybinds";
import { useLocation, useNavigate } from "@revolt/routing";
import { ResolvedEntry, useState } from "@revolt/state";
import { Avatar, Column, Symbol, Text, Time, Unreads } from "@revolt/ui";
import { ReleaseBadge } from "@revolt/ui/components/design/ReleaseBadge";
import { VoiceStatus } from "@revolt/ui/components/design/VoiceStatus";
import { Tooltip } from "@revolt/ui/components/floating";
import { Icon } from "@revolt/ui/icons/Icon";

import { RailEntry, createRailDrag } from "./railDrag";

interface Props {
  /**
   * Ordered server list
   */
  orderedServers: Server[];

  /**
   * Server list grouped into folders, for rendering
   */
  orderedEntries: ResolvedEntry[];

  /**
   * Set ordering of top-level entries
   * @param ids List of IDs
   */
  setServerOrder: (ids: string[]) => void;

  /**
   * Unread conversations list
   */
  unreadConversations: Channel[];

  /**
   * Current logged in user
   */
  user: User;

  /**
   * Selected server id
   */
  selectedServer: Accessor<string | undefined>;

  /**
   * Create or join server
   */
  onCreateOrJoinServer(): void;

  /**
   * Menu generator
   */
  menuGenerator: (target: Server | Channel) => JSX.Directives["floating"];
}

/**
 * Server list sidebar component
 */
export const ServerList = (props: Props) => {
  const state = useState();
  const client = useClient();
  const navigate = useNavigate();
  const { isMobile } = useDevice();
  const { t } = useLingui();
  const location = useLocation();
  const onDiscover = () => location.pathname.startsWith("/discover");

  const navigateServer = (byOffset: number) => {
    const serverId = props.selectedServer();
    if (serverId == null && props.orderedServers.length) {
      if (byOffset === 1) {
        navigate(`/server/${props.orderedServers[0].id}`);
      } else {
        navigate(
          `/server/${props.orderedServers[props.orderedServers.length - 1].id}`,
        );
      }
      return;
    }

    const currentServerIndex = props.orderedServers.findIndex(
      (server) => server.id === serverId,
    );

    const nextIndex = currentServerIndex + byOffset;

    if (nextIndex === -1) {
      return navigate("/app");
    }

    // this will wrap the index around
    const nextServer = props.orderedServers.at(
      nextIndex % props.orderedServers.length,
    );

    if (nextServer) {
      navigate(`/server/${nextServer.id}`);
    }
  };

  createKeybind(KeybindAction.NAVIGATION_SERVER_UP, () => navigateServer(-1));
  createKeybind(KeybindAction.NAVIGATION_SERVER_DOWN, () => navigateServer(1));

  const homeNotifications = createMemo(() => {
    return client().users.filter((user) => user.relationship === "Incoming")
      .length;
  });

  let rail!: HTMLDivElement;

  /**
   * Fold an entry into another
   */
  function fold(target: string, incoming: string) {
    const entries = props.orderedEntries;

    const entry = entries.find((item) => item.id === target);
    if (!entry) return;

    const ids = entries.map((item) => item.id).filter((id) => id !== incoming);

    if (entry.type === "folder") {
      state.ordering.addToFolder(entry.folder.id, incoming);
    } else {
      const folderId = state.ordering.createFolder(t`New folder`, [
        target,
        incoming,
      ]);

      const at = ids.indexOf(target);
      if (at !== -1) {
        ids[at] = folderId;
      }
    }

    props.setServerOrder(ids);
  }

  /**
   * Move an entry to a new position
   */
  function place(moved: string, before?: string, parent?: string) {
    const currentOrder = props.orderedEntries.map((entry) => entry.id);
    const ids = currentOrder.filter((id) => id !== moved);

    if (parent) {
      state.ordering.placeInFolder(parent, moved, before);
      props.setServerOrder(ids);
      return;
    }

    if (state.ordering.folderOf(moved)) {
      state.ordering.removeFromFolder(moved);
    }

    const at = before ? ids.indexOf(before) : -1;
    const index = at === -1 ? ids.length : at;

    const newOrder = [...ids.slice(0, index), moved, ...ids.slice(index)];

    if (
      newOrder.length === currentOrder.length &&
      newOrder.every((id, i) => id === currentOrder[i])
    ) {
      return;
    }

    props.setServerOrder(newOrder);
  }

  const drag = createRailDrag({
    entries: (): RailEntry[] =>
      props.orderedEntries.flatMap<RailEntry>((entry) =>
        entry.type === "folder"
          ? [
              { id: entry.id, kind: "folder" as const },
              // members are only draggable while you can see them
              ...(entry.folder.collapsed
                ? []
                : entry.servers.map((server) => ({
                    id: server.id,
                    kind: "server" as const,
                    parent: entry.id,
                  }))),
            ]
          : [{ id: entry.id, kind: "server" as const }],
      ),
    container: () => rail,
    label: (id) => {
      for (const entry of props.orderedEntries) {
        if (entry.id === id)
          return entry.type === "folder"
            ? entry.folder.name || t`Folder`
            : entry.server.name;

        if (entry.type !== "folder") continue;

        const member = entry.servers.find((server) => server.id === id);
        if (member) return member.name;
      }
    },
    //TODO - No server ordering on mobile due to usability issue
    //Consider adding a way to enable reordering in user settings
    disabled: () => isMobile,
    onFold: fold,
    onMove: (moved, before, parent) => place(moved, before, parent),
  });

  /**
   * Entry currently being dragged, if any
   */
  const heldEntry = () => {
    if (!drag.pointer()) return undefined;

    const id = drag.dragging();
    const top = props.orderedEntries.find((entry) => entry.id === id);
    if (top) return top;

    // a server being dragged out of an expanded folder
    for (const entry of props.orderedEntries) {
      if (entry.type !== "folder") continue;

      const server = entry.servers.find((member) => member.id === id);
      if (server) return { type: "server", id, server } as ResolvedEntry;
    }
  };

  /**
   * Whether the drop would land after every entry
   */
  const insertionAtEnd = () => {
    const intent = drag.intent();
    return intent?.type === "move" && intent.before === undefined;
  };

  return (
    <ServerListBase>
      <div use:invisibleScrollable={{ direction: "y", class: listBase() }}>
        <a
          class={entryContainer()}
          data-home
          href="/app"
          use:floating={{
            tooltip: {
              content:
                homeNotifications() > 0
                  ? t`${plural(homeNotifications(), {
                      one: "You have # pending friend request.",
                      other: "You have # pending friend requests.",
                    })}`
                  : CONFIGURATION.RELEASE_CHANNEL === "beta"
                    ? `${t`Home`} · ${t`Beta version: some things may still change.`}`
                    : t`Home`,
              placement: "right",
            },
          }}
        >
          {/* the logo stands on its own, never inside a tile or ring */}
          <HomeMark data-selected={!props.selectedServer() && !onDiscover()}>
            <img
              src={brandMarkSrc(state.theme.activeTheme.darkMode)}
              alt={t`Zrzur home`}
              width={44}
              height={44}
            />
            <Show when={homeNotifications()}>
              <HomeBadge>{homeNotifications()}</HomeBadge>
            </Show>
            {/* a beta deployment says so, quietly, under the logo */}
            <ReleaseBadge channel={CONFIGURATION.RELEASE_CHANNEL} overlay />
          </HomeMark>
        </a>
        <For each={props.unreadConversations.slice(0, 9)}>
          {(conversation) => (
            <Tooltip placement="right" content={conversation.displayName}>
              <a
                class={entryContainer()}
                use:floating={props.menuGenerator(conversation)}
                href={`/channel/${conversation.id}`}
                aria-label={conversation.displayName}
              >
                <Avatar
                  size={48}
                  shape="rounded-square"
                  // Rail DM tile: animated → static → recipient (was broken src TODO).
                  src={
                    conversation.animatedIconURL ??
                    conversation.iconURL ??
                    conversation.recipient?.animatedAvatarURL
                  }
                  holepunch={conversation.unread ? "top-right" : "none"}
                  overlay={
                    <>
                      <Show when={conversation.unread}>
                        <Unreads.Graphic
                          count={conversation.mentions?.size ?? 0}
                          unread
                        />
                      </Show>
                    </>
                  }
                  fallback={
                    conversation.name ?? conversation.recipient?.username
                  }
                  interactive
                />
              </a>
            </Tooltip>
          )}
        </For>
        <Show when={props.unreadConversations.length > 9}>
          <a class={entryContainer()} href={`/`}>
            <Avatar
              size={48}
              shape="rounded-square"
              fallback={<>+{props.unreadConversations.length - 9}</>}
            />
          </a>
        </Show>
        <LineDivider />
        <div ref={rail} class={railList}>
          <For each={props.orderedEntries}>
            {(entry) => (
              <Switch>
                <Match when={entry?.type === "server" && entry}>
                  {(item) => (
                    <ServerEntry
                      server={item().server}
                      selectedServer={props.selectedServer}
                      menuGenerator={props.menuGenerator}
                      drag={drag}
                    />
                  )}
                </Match>
                <Match when={entry?.type === "folder" && entry}>
                  {(item) => (
                    <FolderEntry
                      entry={item()}
                      selectedServer={props.selectedServer}
                      menuGenerator={props.menuGenerator}
                      drag={drag}
                    />
                  )}
                </Match>
              </Switch>
            )}
          </For>
          <Show when={insertionAtEnd()}>
            <div class={railInsertion} style={{ position: "relative" }} />
          </Show>
        </div>
        <div aria-live="polite" class={srOnly}>
          {drag.status()}
        </div>
        <Show when={heldEntry()}>
          {(held) => (
            <Portal mount={document.getElementById("floating")!}>
              <div
                class={railGhost}
                style={{
                  left: `${(drag.pointer()?.x ?? 0) - 21}px`,
                  top: `${(drag.pointer()?.y ?? 0) - 21}px`,
                }}
              >
                <Switch>
                  <Match when={held().type === "server" && held()}>
                    {(item) => (
                      <Avatar
                        size={48}
                        shape="rounded-square"
                        src={(item() as { server: Server }).server.iconURL}
                        fallback={(item() as { server: Server }).server.name}
                      />
                    )}
                  </Match>
                  <Match when={held().type === "folder" && held()}>
                    {(item) => (
                      <Avatar
                        size={48}
                        shape="rounded-square"
                        fallback={
                          <FolderPreview
                            servers={(item() as { servers: Server[] }).servers}
                            colour={
                              (item() as { folder: { colour?: string } }).folder
                                .colour
                            }
                          />
                        }
                      />
                    )}
                  </Match>
                </Switch>
              </div>
            </Portal>
          )}
        </Show>
        <Tooltip placement="right" content={t`Create or join a server`}>
          <a
            role="button"
            tabIndex={0}
            aria-label={t`Create or join a server`}
            class={entryContainer()}
            onClick={() => props.onCreateOrJoinServer()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                props.onCreateOrJoinServer();
              }
            }}
          >
            <Avatar
              shape="rounded-square"
              size={48}
              fallback={<Symbol>add</Symbol>}
            />
          </a>
        </Tooltip>
        {/* Zrzur's own Discover: servers and bots */}
        <Tooltip placement="right" content={t`Find new servers to join`}>
          <a
            href={state.layout.getLastActiveDiscoverPath()}
            aria-label={t`Find new servers to join`}
            aria-current={onDiscover() ? "page" : undefined}
            class={entryContainer({
              indicator: onDiscover() ? "selected" : undefined,
            })}
          >
            <span class={discoverTile} data-active={onDiscover()}>
              <Icon name="compass" size={24} />
            </span>
          </a>
        </Tooltip>
      </div>
      <Shadow>
        <div />
      </Shadow>
      {/* Settings live in the channel-sidebar AccountBar (premium compact bar). */}
    </ServerListBase>
  );
};

/**
 * A single server in the list
 */
function ServerEntry(props: {
  server: Server;
  selectedServer: Accessor<string | undefined>;
  menuGenerator: (target: Server | Channel) => JSX.Directives["floating"];
  drag: RailDrag;
}) {
  const state = useState();

  // Mention count for the server badge, excluding channel-muted channels
  const mentions = () =>
    props.server.channels.reduce(
      (count, channel) =>
        count +
        (state.notifications.isChannelMuted(channel)
          ? 0
          : (channel.mentions?.size ?? 0)),
      0,
    );

  return (
    <Tooltip
      placement="right"
      content={() => (
        <Column>
          <Text class="label" size="large">
            {props.server.name}
          </Text>{" "}
          <Show when={state.notifications.isMuted(props.server)}>
            <Text class="label" size="small">
              <Show
                when={state.notifications.getServerMute(props.server)!.until}
                fallback={<Trans>Muted</Trans>}
              >
                <Trans>
                  Muted until{" "}
                  <Time
                    format="datetime"
                    value={
                      state.notifications.getServerMute(props.server)!.until
                    }
                  />
                </Trans>
              </Show>
            </Text>
          </Show>
        </Column>
      )}
      aria={props.server.name}
    >
      <div
        ref={(el) => props.drag.register(props.server.id, el)}
        onPointerDown={(e) => props.drag.press(props.server.id, e)}
        onKeyDown={(e) => props.drag.keys(props.server.id, e)}
        class={entryContainer({
          indicator:
            props.selectedServer() === props.server.id
              ? "selected"
              : props.server.unread &&
                  !state.notifications.isMuted(props.server)
                ? "alert"
                : undefined,
        })}
        classList={{
          [railFolding]: isFoldTarget(props.drag, props.server.id),
          [railHeld]:
            props.drag.dragging() === props.server.id ||
            props.drag.carrying() === props.server.id,
        }}
        use:floating={props.menuGenerator(props.server)}
      >
        <Show when={isInsertionBefore(props.drag, props.server.id)}>
          <div class={railInsertion} />
        </Show>
        <a
          draggable="false"
          tabindex="0"
          href={state.layout.getLastActiveServerPath(props.server.id)}
          aria-label={props.server.name}
        >
          <Avatar
            size={48}
            shape="rounded-square"
            src={props.server.iconURL}
            holepunch={
              mentions()
                ? props.server.voiceStatus !== "none"
                  ? "right"
                  : "top-right"
                : props.server.voiceStatus !== "none"
                  ? "bottom-right"
                  : "none"
            }
            overlay={
              <>
                <Show when={mentions() /* as opposed to item.unread */}>
                  <Unreads.Graphic count={mentions()} unread />
                </Show>
                <Show when={props.server.voiceStatus !== "none"}>
                  <VoiceStatus.Graphic status={props.server.voiceStatus} />
                </Show>
              </>
            }
            fallback={props.server.name}
            interactive
          />
        </a>
      </div>
    </Tooltip>
  );
}

/**
 * A folder of servers, collapsible in place
 */
function FolderEntry(props: {
  entry: Extract<ResolvedEntry, { type: "folder" }>;
  selectedServer: Accessor<string | undefined>;
  menuGenerator: (target: Server | Channel) => JSX.Directives["floating"];
  drag: RailDrag;
}) {
  const state = useState();
  const { t } = useLingui();

  const collapsed = () => props.entry.folder.collapsed ?? false;

  const folderName = () => props.entry.folder.name || t`Folder`;

  // Mention count for the badge, excluding channel-muted channels
  const mentions = () =>
    props.entry.servers.reduce(
      (count, server) =>
        count +
        server.channels.reduce(
          (n, channel) =>
            n +
            (state.notifications.isChannelMuted(channel)
              ? 0
              : (channel.mentions?.size ?? 0)),
          0,
        ),
      0,
    );

  const unread = () =>
    props.entry.servers.some(
      (server) => server.unread && !state.notifications.isMuted(server),
    );

  const holdsSelected = () =>
    props.entry.servers.some((server) => server.id === props.selectedServer());

  return (
    <FolderGroup
      expanded={!collapsed()}
      style={{
        background:
          !collapsed() && props.entry.folder.colour
            ? folderTint(props.entry.folder.colour, 18)
            : undefined,
      }}
    >
      <Tooltip placement="right" content={folderName()} aria={folderName()}>
        <div
          ref={(el) => props.drag.register(props.entry.id, el)}
          onPointerDown={(e) => props.drag.press(props.entry.id, e)}
          onKeyDown={(e) => props.drag.keys(props.entry.id, e)}
          class={entryContainer({
            indicator:
              collapsed() && holdsSelected()
                ? "selected"
                : collapsed() && unread()
                  ? "alert"
                  : undefined,
          })}
          classList={{
            [railFolding]: isFoldTarget(props.drag, props.entry.id),
            [railHeld]:
              props.drag.dragging() === props.entry.id ||
              props.drag.carrying() === props.entry.id,
          }}
          use:floating={{
            contextMenu: () => (
              <ServerFolderContextMenu folder={props.entry.folder} />
            ),
          }}
          style={{ color: props.entry.folder.colour ?? undefined }}
        >
          <Show when={isInsertionBefore(props.drag, props.entry.id)}>
            <div class={railInsertion} />
          </Show>
          <a
            role="button"
            tabindex="0"
            aria-label={folderName()}
            aria-expanded={!collapsed()}
            onClick={() => state.ordering.toggleFolder(props.entry.folder.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                state.ordering.toggleFolder(props.entry.folder.id);
              }
            }}
          >
            <Avatar
              size={48}
              shape="rounded-square"
              holepunch={collapsed() && mentions() ? "top-right" : "none"}
              overlay={
                <Show when={collapsed() && mentions()}>
                  <Unreads.Graphic count={mentions()} unread />
                </Show>
              }
              fallbackBackground={collapsed() && !!props.entry.servers.length}
              fallback={
                <Show
                  when={collapsed() && props.entry.servers.length}
                  fallback={
                    <Symbol size={24} fill>
                      folder_open
                    </Symbol>
                  }
                >
                  <FolderPreview
                    servers={props.entry.servers}
                    colour={props.entry.folder.colour}
                  />
                </Show>
              }
            />
          </a>
        </div>
      </Tooltip>
      <Show when={!collapsed()}>
        <For each={props.entry.servers}>
          {(server) => (
            <ServerEntry
              server={server}
              selectedServer={props.selectedServer}
              menuGenerator={props.menuGenerator}
              drag={props.drag}
            />
          )}
        </For>
      </Show>
    </FolderGroup>
  );
}

type RailDrag = ReturnType<typeof createRailDrag>;

/**
 * Announcements are for screen readers, not for looking at
 */
const srOnly = css({
  position: "absolute",
  width: "1px",
  height: "1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
});

/**
 * Whether dropping now would fold into this entry
 * @param drag Rail drag
 * @param id Entry id
 */
function isFoldTarget(drag: RailDrag, id: string) {
  const intent = drag.intent();
  return intent?.type === "fold" && intent.target === id;
}

/**
 * Whether the drop would land immediately above this entry
 * @param drag Rail drag
 * @param id Entry id
 */
function isInsertionBefore(drag: RailDrag, id: string) {
  const intent = drag.intent();
  return intent?.type === "move" && intent.before === id;
}

/**
 * Ring drawn around the entry a drop would fold into
 */
const railFolding = css({
  "&:after": {
    content: "' '",
    position: "absolute",
    top: "1px",
    left: "3px",
    width: "48px",
    height: "48px",
    borderRadius: "16px",
    outline: "2px solid var(--md-sys-color-primary)",
  },
});

/**
 * The entry being dragged stays in place, faded, so the list never moves
 */
const railHeld = css({
  opacity: 0.35,
});

/**
 * The servers and folders, spaced so the selected ring never touches a neighbour
 */
const railList = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "8px",
});

/**
 * Line showing where a reorder would drop the entry
 */
const railInsertion = css({
  position: "absolute",
  top: "-2px",
  left: "6px",
  right: "6px",
  height: "4px",
  borderRadius: "2px",
  background: "var(--md-sys-color-primary)",
});

/**
 * The dragged entry, following the cursor
 */
const railGhost = css({
  position: "fixed",
  pointerEvents: "none",
  opacity: 0.85,
  zIndex: 1000,
});

/**
 * Collapsed folder preview icons
 */
function FolderPreview(props: { servers: Server[]; colour?: string }) {
  const size = () => (props.servers.length > 2 ? 14 : 17);

  return (
    <FolderPreviewBase
      style={{
        background: props.colour ? folderTint(props.colour, 30) : undefined,
      }}
    >
      <For each={props.servers.slice(0, 4)}>
        {(server) => (
          <Avatar
            shape="rounded-square"
            size={size()}
            src={server.iconURL}
            fallback={server.name}
          />
        )}
      </For>
    </FolderPreviewBase>
  );
}

function folderTint(colour: string, amount: number) {
  return `color-mix(in srgb, ${colour} ${amount}%, transparent)`;
}

const FolderPreviewBase = styled("div", {
  base: {
    width: "100%",
    height: "100%",

    display: "flex",
    flexWrap: "wrap",
    gap: "2px",
    alignContent: "center",
    justifyContent: "center",
  },
});

const ServerListBase = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    minHeight: 0,
    width: "var(--z-rail-width, 72px)",
    background: "var(--z-bg-frame)",
    fill: "var(--z-fg-primary, var(--md-sys-color-on-surface))",
    color: "var(--z-fg-primary, var(--md-sys-color-on-surface))",
  },
});

/**
 * Container around list of servers
 */
const listBase = cva({
  base: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    paddingBlock: "12px",
    minHeight: 0,
  },
});

/**
 * Server entries
 */
/**
 * Actions on the rail (add, Discover) are quiet: no tile at rest, so the
 * servers stand out; hover and the open page raise them.
 */
const discoverTile = css({
  width: "48px",
  height: "48px",
  display: "grid",
  placeItems: "center",
  borderRadius: "14px",
  background: "transparent",
  "--z-icon-color": "var(--z-icon-neutral)",
  transition: "background-color 120ms ease",
  _motionReduce: { transition: "none" },
  "a:hover > &": {
    background: "var(--z-bg-raised)",
    "--z-icon-color": "var(--z-fg-primary)",
  },
  "a:active > &": { background: "var(--z-nav-selected)" },
  "&[data-active=true]": {
    background: "var(--z-nav-selected)",
    "--z-icon-color": "var(--z-fg-primary)",
  },
});

const entryContainer = cva({
  base: {
    width: "54px",
    height: "48px",
    position: "relative",
    // rows out of view are not laid out or painted; the margin keeps the
    // state bar, which sits outside the row, from being clipped
    contentVisibility: "auto",
    containIntrinsicSize: "54px 48px",
    overflowClipMargin: "12px",
    display: "grid",
    flexShrink: 0,
    placeItems: "center",

    /*
     * State bar on the rail edge (the side the rail starts on, so it mirrors
     * in Arabic): a dot for unread, taller on hover, full for the open one.
     * The entry starts 9px in from the 72px rail.
     */
    "&:before": {
      content: "' '",
      position: "absolute",
      top: "50%",
      insetInlineStart: "-9px",
      width: "3px",
      height: "0px",
      borderStartEndRadius: "4px",
      borderEndEndRadius: "4px",
      // unread stays neutral and bright; the open one wears the action colour
      background: "var(--z-unread, var(--z-fg-primary))",
      transform: "translateY(-50%)",
      pointerEvents: "none",
      transition: "height 120ms ease, background-color 120ms ease",
      _motionReduce: { transition: "none" },
    },

    "&:hover:before": {
      height: "20px",
    },
    // Home: the bar follows the logo's own selected state
    "&[data-home]:has([data-selected='true']):before": {
      height: "32px",
      background: "var(--z-accent)",
    },
    "&[data-home]:hover img": { opacity: 1 },
    "&[data-home]:active img": { transform: "scale(0.94)" },
    "& > a": { display: "grid", placeItems: "center", borderRadius: "14px" },
    "&:focus-visible, & > a:focus-visible": {
      outline: "2px solid var(--z-accent)",
      outlineOffset: "2px",
    },
    "&[role='button']": {
      width: "48px",
      height: "48px",
      borderRadius: "14px",
      background: "transparent",
      cursor: "pointer",
      transition: "background-color 120ms ease",
      "& *": { background: "transparent !important" },
      "--z-icon-color": "var(--z-icon-neutral)",
      color: "var(--z-icon-neutral)",
      "&:before": { display: "none" },
      "&:hover": {
        background: "var(--z-bg-raised)",
        "--z-icon-color": "var(--z-fg-primary)",
        color: "var(--z-fg-primary)",
      },
      "&:active": { background: "var(--z-nav-selected)" },
    },
  },
  variants: {
    indicator: {
      selected: {
        "&:before, &:hover:before": {
          height: "32px",
          background: "var(--z-accent)",
        },
      },
      // unread: a short bar on the edge
      alert: {
        "&:before": {
          height: "8px",
        },
        "&:hover:before": {
          height: "20px",
        },
      },
    },
  },
});

/**
 * Group a folder together with its servers while expanded
 */
const FolderGroup = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flexShrink: 0,
  },
  variants: {
    expanded: {
      true: {
        paddingBlock: "6px",
        borderRadius: "var(--borderRadius-lg)",
        background:
          "color-mix(in srgb, var(--md-sys-color-on-surface) 10%, transparent)",
      },
      false: {},
    },
  },
  defaultVariants: { expanded: false },
});

/**
 * Divider line between two lists
 */
const LineDivider = styled("div", {
  base: {
    height: "1px",
    flexShrink: 0,
    margin: "4px auto",
    width: "24px",
    background: "var(--z-border-strong)",
  },
});

/**
 * Shadow at the bottom of the list
 */
const Shadow = styled("div", {
  base: {
    height: 0,
    zIndex: 1,
    position: "relative",

    "& div": {
      height: "12px",
      marginTop: "-12px",
      position: "absolute",
      background:
        "linear-gradient(to bottom, transparent, var(--md-sys-color-surface-container-highest))",
    },
  },
});

/**
 * Home: the bare Zrzur B mark. Resting it is a little quiet; hover and the
 * open Home page bring it to full strength
 */
const HomeMark = styled("span", {
  base: {
    position: "relative",
    display: "grid",
    placeItems: "center",
    width: "48px",
    height: "48px",
    // the same tile as the server icons below it (owner request 2026-11-01)
    borderRadius: "14px",
    background: "var(--z-bg-sidebar)",
    transition: "background-color 0.15s ease",
    "&:hover, &[data-selected='true']": { background: "var(--z-bg-raised)" },
    // the B mark is wide and low, so it fills the tile's width
    "& > img": {
      width: "44px",
      height: "44px",
      objectFit: "contain",
      opacity: 0.9,
      transition: "opacity 0.15s ease",
    },
    "&:hover > img, &[data-selected='true'] > img": { opacity: 1 },
    _motionReduce: { transition: "none", "& > img": { transition: "none" } },
  },
});

/** pending friend requests on the home mark */
const HomeBadge = styled("span", {
  base: {
    position: "absolute",
    top: "0",
    insetInlineEnd: "0",
    minWidth: "18px",
    height: "18px",
    padding: "0 5px",
    display: "grid",
    placeItems: "center",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 800,
    color: "#fff",
    background: "var(--z-danger-strong, #B85867)",
    border: "2px solid var(--z-bg-frame)",
    boxSizing: "content-box",
  },
});
