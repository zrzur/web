import { VoiceOccupancy } from "@revolt/ui/components/features/voice/VoiceOccupancy";
import {
  Accessor,
  JSX,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { API, Channel, Server } from "@zrzur/sdk/solid";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { ServerContextMenu } from "@revolt/app/menus";
import { useClient } from "@revolt/client";
import { useDevice } from "@revolt/common";
import { KeybindAction, createKeybind } from "@revolt/keybinds";
import { TextWithEmoji } from "@revolt/markdown";
import { useModals } from "@revolt/modal";
import {
  interestsKey,
  shouldAskInterests,
} from "@revolt/modal/modals/interestsAsk";
import { useNavigate } from "@revolt/routing";
import { useVoice } from "@revolt/rtc";
import {
  canDropVoiceParticipant,
  voiceOccupancy,
} from "@revolt/rtc/moderation";
import {
  draggedVoiceParticipant,
  setDraggedVoiceParticipant,
} from "@revolt/rtc/voiceDrag";
import { useState } from "@revolt/state";
import {
  Column,
  Draggable,
  Header,
  MenuButton,
  OverflowingText,
  iconSize,
  typography,
} from "@revolt/ui";
import { UnreadCallout } from "@revolt/ui/components/features/navigation/UnreadCallout";
import { ServerStatusBadges } from "@revolt/ui/components/features/profiles/ServerStatusBadges";
import { VoiceChannelPreview } from "@revolt/ui/components/features/voice/VoiceChannelPreview";
import { createDragHandle } from "@revolt/ui/components/utils/Draggable";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { chevron_right as MdChevronRight } from "@revolt/ui/icons/legacy";
import { SidebarIcon } from "./SidebarIcon";

import { RulesIcon } from "@revolt/ui/icons/RulesIcon";
import { useListToggle } from "@revolt/ui/motion";
import { EventsLink } from "../../events/EventsLink";
import { LobbyLink, RulesLink } from "../../lobby/LobbyLink";
import { sidebarBase } from "./common";
import {
  OrderedCategory,
  applyChannelOrdering,
  categoriesToSave,
  orderedCategories,
} from "./ordering";
import { ServerStats } from "./ServerStats";

interface Props {
  /**
   * Server to display sidebar for
   */
  server: Server;

  /**
   * Currently selected channel ID
   */
  channelId: string | undefined;

  /**
   * Open server information modal
   */
  openServerInfo: () => void;

  /**
   * Open server settings modal
   */
  openServerSettings: () => void;

  /**
   * Menu generator
   */
  menuGenerator: (
    target: Server | Channel | CategoryData,
  ) => JSX.Directives["floating"];
}

/**
 * Ordered category data returned from server
 */
export type CategoryData = OrderedCategory & { channels: Channel[] };

type OrderingEvent =
  | {
      type: "categories";
      ids: string[];
    }
  | {
      type: "category";
      id: string;
      reorderedIds: string[];
      visibleIds: string[];
      moved: boolean;
    };

/**
 * Display server information and channels
 */
/** Servers whose interests window was already offered this session */
const askedInterests = new Set<string>();

export const ServerSidebar = (props: Props) => {
  const navigate = useNavigate();
  const state = useState();
  const { isMobile } = useDevice();
  const client = useClient();
  const { openModal, showError } = useModals();

  // first visit: ask the role questions once, before anything else
  createEffect(
    on(
      () => [props.server.id, props.server.member?.roles] as const,
      ([serverId, roles]) => {
        const user = client().user;
        if (!roles || !user || askedInterests.has(serverId)) return;
        let dismissed = false;
        try {
          dismissed = !!localStorage.getItem(interestsKey(serverId, user.id));
        } catch {
          /* storage blocked: ask, the window can be skipped */
        }
        if (
          shouldAskInterests(props.server.lobby?.onboarding, roles, dismissed)
        ) {
          askedInterests.add(serverId);
          openModal({ type: "interests", server: props.server });
        }
      },
    ),
  );

  // Users can manage certain parts of the server individually, regardless of their ManageServer Permission
  const canManageServer = () =>
    props.server.orPermission(
      "ManageServer",
      "ManageCustomisation",
      "ManageRole",
      "ManagePermissions",
    );

  const categories = createMemo<CategoryData[]>(() => {
    const channels = new Map(
      props.server.channels.map((channel) => [channel.id, channel]),
    );

    return orderedCategories(
      props.server.categories,
      props.server.channels.map((channel) => channel.id),
    ).map((category) => ({
      ...category,
      channels: category.channelIds
        .map((id) => channels.get(id)!)
        .filter((channel) => channel),
    }));
  });

  /** Gets a list of channels that are currently not hidden inside a closed category */
  const visibleChannels = () =>
    categories().flatMap((category) => {
      const channels =
        category.id === "default"
          ? [
              ...category.channels.filter((channel) => !channel.isVoice),
              ...category.channels.filter((channel) => channel.isVoice),
            ]
          : category.channels;
      return channels.filter((channel) => {
        const sectionId =
          category.id === "default"
            ? `${props.server.id}:default:${channel.isVoice ? "Voice" : "Text"}`
            : category.id;
        return (
          state.layout.getSectionState(sectionId, true) ||
          channel.unread ||
          channel.id === props.channelId
        );
      });
    });

  // TODO: when navigating channels, we want to add aria-keyshortcuts={localized-shortcut} to the next/previous channels
  // https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-keyshortcuts
  // TODO: issue warning if nothing is found somehow? warnings can be nicer than flat out not working
  // TODO: we want it to feel smooth when navigating through channels, so we'll want to select channels immediately but not actually navigate until we're done moving through them
  /** Navigates to the channel offset from the current one, wrapping around if needed */
  const navigateChannel = (byOffset: number) => {
    if (props.channelId == null) return;

    const channels = visibleChannels();

    const currentChannelIndex = channels.findIndex(
      (channel) => channel.id === props.channelId,
    );

    // this will wrap the index around
    const nextChannel = channels.at(
      (currentChannelIndex + byOffset) % channels.length,
    );

    if (nextChannel) {
      navigate(`/server/${props.server.id}/channel/${nextChannel.id}`);
    }
  };

  createKeybind(KeybindAction.NAVIGATION_CHANNEL_UP, () => navigateChannel(-1));

  createKeybind(KeybindAction.NAVIGATION_CHANNEL_DOWN, () =>
    navigateChannel(1),
  );

  createKeybind(KeybindAction.CHAT_MARK_SERVER_AS_READ, () => {
    if (props.server.unread) {
      // a failed request is only a mark that comes back with the next sync
      props.server.ack().catch(() => undefined);
    }
  });

  const noOrdering = () => !props.server.havePermission("ManageChannel");

  const [list, setList] = createSignal<HTMLDivElement>();
  /** A channel is being dragged: the empty Text and Voice groups show */
  const [dragging, setDragging] = createSignal(false);

  const storedCategoryIds = () =>
    (props.server.categories ?? []).map((category) => category.id);

  /** Save a new order; on failure say so (the list snaps back on reload) */
  async function saveCategories(next: API.Category[]) {
    try {
      await props.server.edit({ categories: next });
    } catch (error) {
      showError(error);
    }
  }

  let heldEvent: OrderingEvent & { type: "category" } = null!;
  function handleOrdering(event: OrderingEvent) {
    if (event.type === "category" && event.moved && !heldEvent) {
      heldEvent = event;
      return;
    }

    if (event.type === "categories") {
      const ids = event.ids.filter((id) => id !== "default");

      void saveCategories(
        categoriesToSave(
          ["default", ...ids]
            .map((id) => categories().find((category) => category.id === id)!)
            .filter((category) => category),
          storedCategoryIds(),
        ),
      );
    } else {
      const touched = event.id;
      void saveCategories(
        categoriesToSave(
          categories().map(({ id, title, channelIds }) => {
            // Text and voice are two views of the same default category. Apply
            // both drop events so moving between these views cannot lose IDs.
            if (heldEvent?.id === id && event.id === id) {
              return {
                id,
                title,
                channelIds: applyChannelOrdering(
                  applyChannelOrdering(
                    channelIds,
                    heldEvent.visibleIds,
                    heldEvent.reorderedIds,
                  ),
                  event.visibleIds,
                  event.reorderedIds,
                ),
              };
            }
            const reordered =
              heldEvent?.id === id
                ? heldEvent
                : event.id === id
                  ? event
                  : undefined;

            return {
              id,
              title,
              channelIds: reordered
                ? applyChannelOrdering(
                    channelIds,
                    reordered.visibleIds,
                    reordered.reorderedIds,
                  )
                : channelIds,
            };
          }),
          storedCategoryIds(),
          touched,
        ),
      );

      heldEvent = null!;
    }
  }

  return (
    // native <div>: use:floating is ignored on components
    <div
      class={`channel_bar server ${sidebarBase()}`}
      use:floating={props.menuGenerator(props.server)}
    >
      <Switch
        fallback={
          <Header placement="secondary">
            <ServerInfo
              server={props.server}
              canManageServer={canManageServer()}
              openServerInfo={props.openServerInfo}
              openServerSettings={props.openServerSettings}
            />
          </Header>
        }
      >
        <Match when={props.server.banner}>
          <Header
            image
            placement="secondary"
            style={{
              "background-image": `url('${props.server.bannerURL}')`,
            }}
          >
            <ServerInfo
              server={props.server}
              canManageServer={canManageServer()}
              openServerInfo={props.openServerInfo}
              openServerSettings={props.openServerSettings}
            />
          </Header>
        </Match>
      </Switch>
      <ChannelList>
        <UnreadCallout list={list} />
        <div
          ref={setList}
          use:invisibleScrollable
          style={{ height: "100%" }}
          use:floating={props.menuGenerator(props.server)}
        >
          <EventsLink server={props.server} />
          <LobbyLink server={props.server} />
          <RulesLink server={props.server} />
          <ServerStats server={props.server} />
          <Show
            when={categories().find((category) => category.id === "default")}
          >
            {(category) => (
              <>
                {/* always mounted: the drag library only knows the zones
                    that exist when a drag starts */}
                <Category
                  channelType="Text"
                  server={props.server}
                  category={category()}
                  channelId={props.channelId}
                  menuGenerator={props.menuGenerator}
                  dragDisabled={() => true}
                  setDragDisabled={() => void 0}
                  noOrdering={noOrdering}
                  handleOrdering={handleOrdering}
                  dragging={dragging}
                  setDragging={setDragging}
                />
                <Category
                  channelType="Voice"
                  server={props.server}
                  category={category()}
                  channelId={props.channelId}
                  menuGenerator={props.menuGenerator}
                  dragDisabled={() => true}
                  setDragDisabled={() => void 0}
                  noOrdering={noOrdering}
                  handleOrdering={handleOrdering}
                  dragging={dragging}
                  setDragging={setDragging}
                />
              </>
            )}
          </Show>
          <Draggable
            dragHandles
            dropIndicator
            type="category"
            //TODO - No channel ordering on mobile due to usability issue
            //Consider adding a way to enable reordering with dragHandles in server settings
            disabled={isMobile || noOrdering()}
            items={categories().filter((category) => category.id !== "default")}
            onChange={(ids) => handleOrdering({ type: "categories", ids })}
          >
            {(entry) => (
              <Category
                server={props.server}
                category={entry.item}
                channelId={props.channelId}
                menuGenerator={props.menuGenerator}
                dragDisabled={entry.dragDisabled}
                setDragDisabled={entry.setDragDisabled}
                noOrdering={noOrdering}
                handleOrdering={handleOrdering}
                dragging={dragging}
                setDragging={setDragging}
              />
            )}
          </Draggable>
        </div>
      </ChannelList>
    </div>
  );
};

const ChannelList = styled("div", {
  base: {
    position: "relative",
    flexGrow: 1,
    minHeight: 0,
    marginBottom: "var(--gap-md)",
  },
});

/**
 * Server Information
 */
function ServerInfo(
  props: Pick<Props, "server" | "openServerInfo" | "openServerSettings"> & {
    canManageServer: boolean;
  },
) {
  const { t } = useLingui();
  const [open, setOpen] = createSignal(false);

  return (
    <div
      class={serverHeaderButton}
      // the menu hands focus back here when it closes: pass it to the button
      tabIndex={-1}
      onFocus={(e) =>
        e.currentTarget.querySelector("button")?.focus({ preventScroll: true })
      }
      use:floating={{
        contextMenu: () => {
          // reflect the menu's real lifetime in aria-expanded / pressed styling
          setOpen(true);
          onCleanup(() => setOpen(false));
          return (
            <ServerContextMenu
              server={props.server}
              openServerInfo={props.openServerInfo}
            />
          );
        },
        contextMenuHandler: "click",
        contextMenuPlacement: "bottom",
      }}
    >
      <div
        style={{
          display: "flex",
          flex: "1",
          "min-width": "0",
          gap: "6px",
          "align-items": "center",
        }}
      >
        <ServerStatusBadges flags={props.server.flags} size="xs" mode="hover" />
        <ServerName>
          <TextWithEmoji content={props.server.name} />
        </ServerName>
      </div>
      {/* the name stays outside the button: a control's visible words must be
          part of its accessible name. Its click reaches the row */}
      <button
        type="button"
        class={serverMenuButton}
        aria-haspopup="menu"
        aria-expanded={open()}
        aria-label={t`Server menu`}
      >
        <Symbol size={18}>expand_more</Symbol>
      </button>
    </div>
  );
}

/**
 * Whole server header row acts as the server dropdown trigger
 * (plain element + class: `use:floating` only binds to DOM elements)
 */
const serverHeaderButton = css({
  // phones: a 44 px tap target (phone rules)
  _phone: { minHeight: "44px" },
  flexGrow: 1,
  minWidth: 0,
  minHeight: "36px",
  paddingBlock: "3px",
  marginInline: "-8px",
  paddingInline: "8px",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  borderRadius: "6px",
  cursor: "pointer",
  "--z-icon-color": "var(--z-icon-neutral)",

  // no fill behind the name (it sits on the banner): only the arrow lights up
  "&:hover, &:has([aria-expanded='true'])": {
    "--z-icon-color": "var(--z-icon-hover)",
  },
  "&:has(button:focus-visible)": {
    outline: "2px solid var(--z-focus)",
    outlineOffset: "-2px",
  },
  outline: "none",
});

/**
 * The arrow at the end of the row: the keyboard way into the server menu
 */
const serverMenuButton = css({
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "24px",
  minHeight: "24px",
  padding: 0,
  border: 0,
  outline: "none",
  background: "none",
  color: "inherit",
  cursor: "pointer",
  // phones: a 44 px tap target (phone rules)
  _phone: { minWidth: "44px", minHeight: "44px", marginInlineEnd: "-8px" },
});

/**
 * Server name
 */
const ServerName = styled("span", {
  base: {
    flexGrow: 1,
    minWidth: 0,
    fontSize: "15px",
    fontWeight: 600,

    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
});

/**
 * Single category entry
 */
function Category(
  props: {
    channelType?: "Text" | "Voice";
    server: Server;
    category: CategoryData;
    channelId: string | undefined;
    noOrdering: Accessor<boolean>;
    handleOrdering: (event: OrderingEvent) => void;
    dragging: Accessor<boolean>;
    setDragging: (active: boolean) => void;
  } & Pick<Props, "menuGenerator"> & {
      dragDisabled: Accessor<boolean>;
      setDragDisabled: (value: boolean) => void;
    },
) {
  const state = useState();
  const { t } = useLingui();
  const { openModal } = useModals();
  const sectionId = () =>
    props.channelType
      ? `${props.server.id}:default:${props.channelType}`
      : props.category.id;
  const isOpen = () => state.layout.getSectionState(sectionId(), true);
  const { isMobile } = useDevice();

  // expand and collapse animate the channel rows
  let section: HTMLDivElement | undefined;
  const toggleList = useListToggle("channelList");
  const rowChannelId = (item: Element) =>
    /\/channel\/([^/?#]+)/.exec(
      item.querySelector("a[href]")?.getAttribute("href") ?? "",
    )?.[1];
  const toggleCategory = () =>
    toggleList({
      open: isOpen(),
      items: () => [
        ...new Set(
          Array.from(section?.querySelectorAll("[data-active]") ?? []).map(
            (row) => row.parentElement ?? row,
          ),
        ),
      ],
      keep: (item) => {
        const id = rowChannelId(item);
        const channel = props.category.channels.find((c) => c.id === id);
        return !!channel && (channel.unread || channel.id === props.channelId);
      },
      toggle: () => state.layout.toggleSectionState(sectionId(), true),
    });

  // The server's own Text or Voice group with nothing in it stays out of sight
  // until a drag needs it. Create channel is still on every category, in the
  // menu of this list and in Server settings.
  const hidden = () =>
    !!props.channelType &&
    !props.dragging() &&
    !props.category.channels.some((channel) =>
      props.channelType === "Voice" ? channel.isVoice : !channel.isVoice,
    );

  const channels = createMemo(() =>
    props.category.channels.filter(
      (channel) =>
        (!props.channelType ||
          (props.channelType === "Voice"
            ? channel.isVoice
            : !channel.isVoice)) &&
        (isOpen() || channel.unread || channel.id === props.channelId),
    ),
  );

  return (
    <CategorySection
      ref={section}
      style={hidden() ? { "padding-top": 0 } : undefined}
    >
      <Show
        when={
          (props.category.id !== "default" || props.channelType) && !hidden()
        }
      >
        <SectionHeader>
          <div use:floating={props.menuGenerator(props.category)}>
            <CategoryBase
              type="button"
              aria-expanded={isOpen()}
              open={isOpen()}
              onClick={toggleCategory}
              {...createDragHandle(props.dragDisabled, props.setDragDisabled)}
            >
              <MdChevronRight {...iconSize(12)} />
              <span>
                {props.channelType === "Text" ? (
                  <Trans>Text channels</Trans>
                ) : props.channelType === "Voice" ? (
                  <Trans>Voice channels</Trans>
                ) : (
                  props.category.title
                )}
              </span>
            </CategoryBase>
          </div>
          <Show when={!props.noOrdering()}>
            <ToolButton
              type="button"
              aria-label={t`Create channel`}
              title={t`Create channel`}
              onClick={() =>
                openModal({
                  type: "create_channel",
                  server: props.server,
                  categoryId: props.category.id,
                  initialType: props.channelType,
                })
              }
            >
              <SidebarIcon name="plus" size={16} />
            </ToolButton>
          </Show>
        </SectionHeader>
      </Show>
      <Draggable
        dropIndicator
        type="channels"
        items={channels()}
        onChange={(reorderedIds) => {
          const current = channels();
          props.handleOrdering({
            type: "category",
            id: props.category.id,
            reorderedIds,
            visibleIds: current.map((channel) => channel.id),
            moved: reorderedIds.length !== current.length,
          });
        }}
        //TODO - No channel ordering on mobile due to usability issue
        //Consider adding a way to enable reordering with dragHandles in server settings
        disabled={isMobile || props.noOrdering() || !isOpen()}
        minimumDropAreaHeight="42px"
        onDragChange={props.setDragging}
      >
        {(entry) => (
          <Entry
            channel={entry.item}
            active={entry.item.id === props.channelId}
            menuGenerator={props.menuGenerator}
          />
        )}
      </Draggable>
    </CategorySection>
  );
}

const CategorySection = styled("div", {
  base: {
    display: "flex",
    gap: "2px",
    flexDirection: "column",
    paddingTop: "16px",

    "&:first-child": {
      paddingTop: "8px",
    },
  },
});

/**
 * Category title styling
 */
const CategoryBase = styled("button", {
  base: {
    // phones: a 44 px tap target (phone rules)
    _phone: { minHeight: "44px" },
    border: 0,
    background: "transparent",
    minWidth: 0,
    textAlign: "start",
    width: "100%",
    "& span": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    _focusVisible: { outline: "2px solid var(--z-focus)", borderRadius: "4px" },
    display: "flex",
    alignItems: "center",
    gap: "2px",

    padding: "0 8px 4px 10px",
    height: "24px",

    cursor: "pointer",
    userSelect: "none",
    transition: "var(--transitions-fast) all",

    "--color": "var(--z-fg-muted, var(--md-sys-color-outline))",
    color: "var(--color)",
    fill: "var(--color)",

    ...typography.raw({ class: "label", size: "small" }),
    fontSize: "12px",
    fontWeight: 600,

    "&:hover": {
      "--color": "var(--z-fg-primary, var(--md-sys-color-on-surface))",
    },

    "& svg": {
      transition: "var(--transitions-fast) transform",
    },
  },
  variants: {
    open: {
      true: {
        "& svg": {
          transform: "rotateZ(90deg)",
        },
      },
    },
  },
});

/**
 * Server channel entry
 */
function Entry(
  props: { channel: Channel; active: boolean } & Pick<Props, "menuGenerator">,
) {
  const state = useState();
  const voice = useVoice();
  const client = useClient();
  const { openModal } = useModals();
  const { t } = useLingui();

  const canEditChannel = createMemo(() =>
    (["ManageChannel", "ManagePermissions", "ManageWebhooks"] as const).some(
      (perm) => props.channel.havePermission(perm),
    ),
  );

  const canInvite = () => props.channel.havePermission("InviteOthers");

  const muted = () => state.notifications.isChannelMuted(props.channel);

  /*
   * One badge at most, by rank: a mention count, else an unread dot.
   * Muted channels only surface mentions.
   */
  const alertState = createMemo(() => {
    if (props.active || !props.channel.unread) return false;
    const mentions = props.channel.mentions?.size ?? 0;
    if (mentions) return mentions;
    return !muted();
  });

  // visible but closed to you: read-only text, or a voice room you can't join
  const locked = createMemo(() =>
    props.channel.isVoice
      ? !props.channel.havePermission("Connect")
      : !props.channel.havePermission("SendMessage"),
  );

  const inCall = () => props.channel.id === voice.channel()?.id;

  // a voice room you can't join: the row shows it, a tap does nothing
  const closedVoice = () => props.channel.isVoice && locked();
  const lockedLabel = () =>
    props.channel.isVoice
      ? t`You can't join this voice channel`
      : t`You can read this channel but not send messages`;

  // Drop target for voice participants dragged by a moderator
  const [dropHover, setDropHover] = createSignal(false);
  const draggedMember = () => {
    const dragged = draggedVoiceParticipant();
    const serverId = props.channel.serverId;
    if (!dragged || !serverId) return;
    return {
      source: client().channels.get(dragged.channelId),
      member: client().serverMembers.getByKey({
        server: serverId,
        user: dragged.userId,
      }),
    };
  };
  const canDrop = () => {
    const dragged = draggedMember();
    return (
      !!dragged?.source &&
      props.channel.isVoice &&
      canDropVoiceParticipant(dragged.source, props.channel, dragged.member)
    );
  };
  const dropHandlers = {
    onDragOver(event: DragEvent) {
      if (!canDrop()) return;
      // the page-wide file drop collector must not see this drag
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      setDropHover(true);
    },
    onDragLeave(event: DragEvent) {
      const current = event.currentTarget as HTMLElement;
      if (!current.contains(event.relatedTarget as Node | null))
        setDropHover(false);
    },
    onDrop(event: DragEvent) {
      setDropHover(false);
      const member = draggedMember()?.member;
      const allowed = canDrop();
      setDraggedVoiceParticipant();
      if (!allowed || !member) return;
      event.preventDefault();
      event.stopPropagation();
      // the server re-checks permissions and limits; the moved client
      // switches rooms on its UserMoveVoiceChannel event
      void member
        .edit({ voice_channel: props.channel.id })
        .catch((error) => openModal({ type: "error2", error }));
    },
  };

  const attentionState = createMemo(() =>
    props.active
      ? "selected"
      : inCall()
        ? "active"
        : muted()
          ? "muted"
          : props.channel.unread
            ? "active"
            : locked()
              ? "muted"
              : "normal",
  );

  return (
    <Column
      gap="sm"
      class={voiceDropTarget}
      data-voice-drop={dropHover() ? "" : undefined}
      {...(props.channel.isVoice ? dropHandlers : {})}
    >
      <ChannelRow
        data-active={props.active}
        data-tools={canEditChannel() || canInvite()}
      >
        <MenuButton
          href={
            closedVoice()
              ? undefined
              : `/server/${props.channel.serverId}/channel/${props.channel.id}`
          }
          noDrawer={closedVoice()}
          aria-disabled={closedVoice() || undefined}
          title={closedVoice() ? lockedLabel() : undefined}
          onClick={(event: MouseEvent) => {
            // Restoring a server's last page must not join its voice channel.
            // Only an explicit, unmodified channel activation changes the call.
            if (
              !event.defaultPrevented &&
              event.button === 0 &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.shiftKey &&
              !event.altKey &&
              props.channel.isVoice &&
              !inCall() &&
              props.channel.havePermission("Connect") &&
              !voiceOccupancy(props.channel).full
            ) {
              void voice.connect(props.channel);
            }
          }}
          use:floating={props.menuGenerator(props.channel)}
          size="normal"
          data-unread={props.channel.unread ? "" : undefined}
          data-mentions={props.channel.mentions?.size || undefined}
          alert={alertState()}
          attention={attentionState()}
          icon={
            // closed to you: a small lock sits on the corner of the icon
            <span class={iconWithLock}>
              {/* a custom channel icon replaces the type glyph rather than sitting beside it */}
              <Switch fallback={<SidebarIcon name="hash" size={20} />}>
                <Match when={props.channel.icon}>
                  <ChannelIcon src={props.channel.iconURL} />
                </Match>
                <Match
                  when={
                    props.channel.server?.rulesChannelId === props.channel.id
                  }
                >
                  <RulesIcon
                    size={20}
                    style={{ "--z-icon-color": "currentColor" }}
                  />
                </Match>
                <Match when={props.channel.announcement}>
                  <SidebarIcon name="announcement" size={20} />
                </Match>
                <Match when={props.channel.isForum}>
                  <SidebarIcon name="forum" size={20} />
                </Match>
                <Match when={props.channel.isVoice}>
                  <SidebarIcon
                    name={props.channel.isStage ? "stage" : "voice"}
                    size={20}
                    style={{
                      color: inCall() ? "var(--z-presence-online)" : undefined,
                    }}
                  />
                </Match>
              </Switch>
              <Show when={locked()}>
                <span class={lockBadge} role="img" aria-label={lockedLabel()}>
                  <SidebarIcon name="lock" size={10} />
                </span>
              </Show>
            </span>
          }
        >
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "8px",
              "min-width": "0",
              // the voice count pill sits at the right edge
              width: "100%",
            }}
          >
            <OverflowingText>
              <TextWithEmoji content={props.channel.name!} />
            </OverflowingText>
            <Show when={props.channel.isVoice}>
              <VoiceOccupancy channel={props.channel} />
            </Show>
          </div>
        </MenuButton>
        {/* on hover (and on the open channel) these take the place of the
            participant pill; deleting lives in the right-click menu */}
        <ChannelTools data-channel-tools>
          <Show when={canInvite()}>
            <ToolButton
              type="button"
              aria-label={t`Create invite`}
              title={t`Create invite`}
              onClick={() =>
                openModal({ type: "create_invite", channel: props.channel })
              }
            >
              <SidebarIcon name="invite" size={16} />
            </ToolButton>
          </Show>
          <Show when={canEditChannel()}>
            <ToolButton
              type="button"
              aria-label={t`Open channel settings`}
              title={t`Open channel settings`}
              onClick={() =>
                openModal({
                  type: "settings",
                  config: "channel",
                  context: props.channel,
                })
              }
            >
              <SidebarIcon name="settings" size={16} />
            </ToolButton>
          </Show>
        </ChannelTools>
      </ChannelRow>
      <VoiceChannelPreview channel={props.channel} />
    </Column>
  );
}

/** The channel icon, with room for a lock on its corner */
const iconWithLock = css({
  position: "relative",
  display: "inline-flex",
  flexShrink: 0,
});

/** Lock on the bottom corner of the icon of a channel you can see but not use */
const lockBadge = css({
  position: "absolute",
  bottom: "-3px",
  insetInlineEnd: "-4px",
  width: "13px",
  height: "13px",
  display: "grid",
  placeItems: "center",
  borderRadius: "50%",
  // cut out of the list background so it reads as part of the icon
  background: "var(--z-bg-sidebar, var(--z-bg-nav))",
  color: "var(--z-fg-muted)",
  "--z-icon-color": "var(--z-fg-muted)",
  pointerEvents: "none",
});

const voiceDropTarget = css({
  borderRadius: "6px",
  "&[data-voice-drop]": {
    outline: "2px solid var(--z-focus, var(--md-sys-color-primary))",
    outlineOffset: "-2px",
    background: "var(--z-nav-hover)",
  },
});

/**
 * Channel icon styling
 */
const ChannelIcon = styled("img", {
  base: {
    width: "20px",
    height: "20px",
    borderRadius: "4px",
    objectFit: "cover",
  },
});

const SectionHeader = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    paddingInlineEnd: "8px",
    "& > div": { flex: 1, minWidth: 0 },
  },
});
const ToolButton = styled("button", {
  base: {
    // phones: a 44 px tap target that does not push the row (phone rules)
    _phone: { minWidth: "44px", minHeight: "44px", marginBlock: "-9px" },
    display: "inline-grid",
    placeItems: "center",
    flexShrink: 0,
    width: "26px",
    height: "26px",
    padding: 0,
    border: 0,
    borderRadius: "6px",
    background: "transparent",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "currentColor",
    cursor: "pointer",
    _hover: { background: "var(--z-nav-hover)", color: "var(--z-fg-primary)" },
    "&[data-danger]:hover": { color: "var(--z-danger)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },
    "@media (pointer: coarse)": { width: "32px", height: "32px" },
  },
});
const ChannelRow = styled("div", {
  base: {
    position: "relative",
    minWidth: 0,
    marginInline: "6px",
    "& > :is(a, [aria-disabled])": {
      margin: 0,
      borderRadius: "var(--z-shape-chip, var(--z-radius-sm, 6px))",
      minHeight: "var(--z-row-height, 34px)",
      paddingInline: "8px",
    },
    "& [data-channel-tools]": { opacity: 0, pointerEvents: "none" },
    "&:hover [data-channel-tools], &:focus-within [data-channel-tools], &[data-active='true'] [data-channel-tools]":
      { opacity: 1, pointerEvents: "auto" },
    // while the tools show, the name makes room and the pill steps aside
    "&[data-tools='true']:is(:hover, :focus-within, [data-active='true']) > :is(a, [aria-disabled])":
      { paddingInlineEnd: "64px" },
    "&[data-tools='true']:is(:hover, :focus-within, [data-active='true']) .z-voice-occupancy":
      { visibility: "hidden" },
    "@media (hover: none)": {
      // touch: the buttons show on the open channel only (the rest is in
      // the long-press menu), so the participant pill stays readable
      "& > :is(a, [aria-disabled])": { minHeight: "40px" },
    },
    // phones: edit and delete live in the long-press sheet, rows stay clean
    _phone: {
      "& [data-channel-tools]": { display: "none !important" },
      "&[data-tools='true'] > :is(a, [aria-disabled])": {
        paddingInlineEnd: "8px !important",
      },
      "& > :is(a, [aria-disabled])": { minHeight: "44px !important" },
    },
  },
});
const ChannelTools = styled("div", {
  base: {
    position: "absolute",
    insetInlineEnd: "4px",
    top: 0,
    height: "100%",
    display: "flex",
    alignItems: "center",
    gap: "2px",
  },
});
