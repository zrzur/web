import {
  createMemo,
  createSignal,
  mapArray,
  Match,
  Show,
  Switch,
} from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { VirtualContainer } from "@minht11/solid-virtual-container";
import { useInstance } from "@revolt/instance";
import { AvatarDecoration } from "@revolt/ui/components/features/profiles/AvatarDecoration";
import { useDesignMotion } from "@revolt/ui/components/features/profiles/NameplateMotion";
import { nameplateBackground } from "@revolt/ui/components/features/profiles/userStyle";
import { Channel, ServerMember, User } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { floatingUserMenus } from "@revolt/app/menus/UserContextMenu";
import { useClient } from "@revolt/client";
import { compareNames } from "@revolt/common/lib/arabicFold";
import { createIsTimedOut } from "@revolt/common/lib/createIsTimedOut";
import { statusLine } from "@revolt/common/lib/statusWrite";
import { TextWithEmoji } from "@revolt/markdown";
import { userInformation } from "@revolt/markdown/users";
import {
  Avatar,
  Deferred,
  MenuButton,
  OverflowingText,
  Row,
  Symbol,
  Tooltip,
  typography,
  Username,
  UserStatus,
} from "@revolt/ui";
import { ActivityLine } from "@revolt/ui/components/features/activity/ActivityLine";
import { BotLabel } from "@revolt/ui/components/features/profiles/BotLabel";
import { BadgeMark } from "@revolt/ui/components/features/profiles/badges/BadgeMark";
import { nameRoom } from "@revolt/ui/components/features/profiles/nameRoom";

import { memberRow, nameplateLayer, NameStatusStack } from "./memberRowLook";

interface Props {
  /**
   * Channel
   */
  channel: Channel;

  /**
   * Scroll target element
   */
  scrollTargetElement: HTMLDivElement;

  /**
   * Whether the server is very large and should not display all member information
   */
  isLargeServer?: boolean;
}

/**
 * Member Sidebar
 */
export function MemberSidebar(props: Props) {
  return (
    <Switch>
      <Match when={props.channel.type === "Group"}>
        <GroupMemberSidebar
          channel={props.channel}
          scrollTargetElement={props.scrollTargetElement}
        />
      </Match>
      <Match when={props.channel.type === "TextChannel"}>
        <ServerMemberSidebar
          channel={props.channel}
          scrollTargetElement={props.scrollTargetElement}
          isLargeServer={props.isLargeServer}
        />
      </Match>
    </Switch>
  );
}

/**
 * Server Member Sidebar
 */
export function ServerMemberSidebar(props: Props) {
  const client = useClient();
  const { t } = useLingui();

  type MemberRoleElement =
    | {
        t: 0;
        name: string;
        count: number;
        icon?: string | null;
        /** A real role (not Online or Offline): Shift+click mentions it */
        roleId?: string;
      }
    | { t: 1; member: ServerMember; icon?: never; isOnline: boolean };

  // The list is built in three steps, so a change costs only what it
  // touches (a server's members change all the time: presence, names):
  // 1. this server's members: a new list only when someone comes or goes
  // 2. each member's name and group: worked out again for that member alone
  // 3. the groups, sorted: only when a name or a group changed

  const hoistedRoles = createMemo(() =>
    props.channel.server!.orderedRoles.filter((role) => role.hoist),
  );

  const serverMembers = createMemo(
    () => {
      const serverId = props.channel.serverId;
      const list: ServerMember[] = [];
      for (const member of client().serverMembers.values())
        if (member.id.server === serverId) list.push(member);
      return list;
    },
    [],
    {
      equals: (a, b) =>
        a.length === b.length && a.every((member, i) => member === b[i]),
    },
  );

  /** where one member goes: a hoisted role, Online or Offline (or hidden) */
  type Placed = { member: ServerMember; name: string; group?: string };
  const placed = mapArray(serverMembers, (member) =>
    createMemo<Placed>(
      () => {
        const name = member.nickname ?? member.user?.displayName ?? "";
        // a restricted channel lists only who may see it
        if (
          props.channel.potentiallyRestrictedChannel &&
          !member.hasPermission(props.channel, "ViewChannel")
        )
          return { member, name };
        if (!member.user?.online) return { member, name, group: "offline" };
        const roles = member.roles;
        const hoisted = roles.length
          ? hoistedRoles().find((role) => roles.includes(role.id))
          : undefined;
        return { member, name, group: hoisted?.id ?? "default" };
      },
      undefined as unknown as Placed,
      // a status text or an avatar changing moves nobody
      { equals: (a, b) => a?.name === b.name && a?.group === b.group },
    ),
  );

  const elements = createMemo(() => {
    const byRole = new Map<string, Placed[]>();
    for (const entry of placed()) {
      const place = entry();
      if (!place.group) continue;
      const list = byRole.get(place.group);
      if (list) list.push(place);
      else byRole.set(place.group, [place]);
    }

    const roles: { id: string; name: string; icon?: string }[] = [];
    for (const role of hoistedRoles())
      roles.push({ id: role.id, name: role.name, icon: role.icon?.previewUrl });
    roles.push({ id: "default", name: t`Online` });
    roles.push({ id: "offline", name: t`Offline` });

    const elements: MemberRoleElement[] = [];
    for (const role of roles) {
      const roleMembers = byRole.get(role.id);
      if (!roleMembers?.length) continue;
      roleMembers.sort((a, b) => compareNames(a.name, b.name));

      elements.push({
        t: 0,
        name: role.name,
        icon: role.icon,
        roleId:
          role.id === "default" || role.id === "offline" ? undefined : role.id,
        count: roleMembers.length,
      });
      for (const entry of roleMembers)
        elements.push({
          t: 1,
          member: entry.member,
          isOnline: role.id !== "offline",
        });
    }
    return elements;
  });

  return (
    <Container>
      <Deferred>
        <VirtualContainer
          items={elements()}
          scrollTarget={props.scrollTargetElement}
          itemSize={{ height: 44 }}
        >
          {(item) => (
            <div
              role="listitem"
              style={{
                ...item.style,
                width: "100%",
              }}
            >
              <Switch
                fallback={
                  <CategoryTitle
                    data-mention-role={
                      (item.item as { roleId?: string }).roleId
                    }
                  >
                    <Show when={item.item.icon}>
                      <RoleIcon src={item.item.icon!} alt="" />
                    </Show>
                    <span>{(item.item as { name: string }).name}</span>
                    <span>
                      {" – "}
                      {(item.item as { count: number }).count}
                    </span>
                  </CategoryTitle>
                }
              >
                <Match when={item.item.t === 1}>
                  <Member
                    member={(item.item as { member: ServerMember }).member}
                  />
                </Match>
              </Switch>
            </div>
          )}
        </VirtualContainer>
      </Deferred>
    </Container>
  );
}

/**
 * Group Member Sidebar
 */
export function GroupMemberSidebar(props: Props) {
  return (
    <Container>
      <MemberTitle>
        <Row align>{props.channel.recipientIds.size} members</Row>
      </MemberTitle>

      <Deferred>
        <VirtualContainer
          items={props.channel.recipients.toSorted((a, b) =>
            compareNames(a.displayName, b.displayName),
          )}
          scrollTarget={props.scrollTargetElement}
          itemSize={{ height: 44 }}
        >
          {(item) => (
            <div
              role="listitem"
              style={{
                ...item.style,
                width: "100%",
              }}
            >
              <Member user={item.item} group={props.channel} />
            </div>
          )}
        </VirtualContainer>
      </Deferred>
    </Container>
  );
}

/**
 * Container styles
 */
const Container = styled("div", {
  base: {
    minHeight: "100%",
    width: "var(--z-member-width, var(--layout-width-member-sidebar, 240px))",
    flexShrink: 0,
    // same chat surface as header — surface ladder, no separate wash
    background: "var(--z-bg-members, var(--z-bg-shell, var(--z-bg-chat)))",
    borderInlineStart: "1px solid var(--z-border-subtle)",
    borderRadius: 0,
    // phones: the panel is the whole screen, a line down its side is a
    // stray stroke (owner, 2026-11-17)
    _phone: { borderInlineStart: "none" },
  },
});

/**
 * Category Title
 */
const CategoryTitle = styled("div", {
  base: {
    ...typography.raw({ class: "label", size: "small" }),

    // same caps language as channel list / home categories
    height: "100%",
    // start and end, not left and right: in Arabic the title lines up with
    // the avatars under it
    paddingBlock: "0 6px",
    paddingInline: "16px 8px",
    color: "var(--z-fg-muted, var(--md-sys-color-on-surface))",
    display: "flex",
    alignItems: "flex-end",
    gap: "4px",
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
});

const RoleIcon = styled("img", {
  base: {
    width: "16px",
    height: "16px",
    borderRadius: "var(--borderRadius-sm)",
    objectFit: "cover",
  },
});

/**
 * Member title
 */
const MemberTitle = styled("div", {
  base: {
    marginTop: "12px",
    marginInlineStart: "16px",
    color: "var(--z-fg-muted, var(--md-sys-color-on-surface))",
    ...typography.raw({ class: "label", size: "small" }),

    // same section header as the channel list
    fontSize: "13px",
    fontWeight: 600,
  },
  variants: {
    bottomMargin: {
      no: {},
      yes: {
        marginBottom: "-12px",
      },
    },
  },
});

function Member(props: {
  user?: User;
  member?: ServerMember;
  group?: Channel;
}) {
  const { t } = useLingui();

  /**
   * Create user information
   */
  const user = () =>
    userInformation((props.user ?? props.member?.user)!, props.member);

  const instance = useInstance();
  const timedOut = createIsTimedOut(() => props.member?.timeout);

  const moderationPerms = createMemo(() =>
    props.member?.server?.member?.hasPermission(
      props.member!.server! ?? props.group!,
      "TimeoutMembers",
    ),
  );

  // the emoji first, then the text; one memo per visible row
  const status = createMemo(() => {
    const user = props.user ?? props.member?.user;
    return statusLine(
      user?.statusEmoji,
      user?.statusMessage((s) =>
        s === "Online"
          ? t`Online`
          : s === "Busy"
            ? t`Busy`
            : s === "Focus"
              ? t`Focus`
              : s === "Idle"
                ? t`Idle`
                : t`Offline`,
      ),
    );
  });

  // the user's nameplate: its own rounded layer inside the row, fading in
  // from the left so the name stays readable
  const motion = useDesignMotion();
  const [hovered, setHovered] = createSignal(false);
  const nameplate = () =>
    nameplateBackground(
      (props.user ?? props.member?.user)?.style,
      instance.mediaUrl,
      { moving: hovered() && motion() },
    );

  return (
    <div
      class={memberRow}
      data-plated={nameplate() ? "" : undefined}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      use:floating={floatingUserMenus(
        (props.user ?? props.member?.user)!,
        props.member,
        (props.user ?? props.member?.user)?.bot,
        undefined,
        props.group,
      )}
    >
      <Show when={nameplate()}>
        {(background) => (
          <div
            data-nameplate
            aria-hidden="true"
            class={`${nameplateLayer} z-plate`}
            style={{ "--plate": background() }}
          />
        )}
      </Show>
      <MenuButton
        size="normal"
        attention={
          (props.user ?? props.member?.user)?.online ? "active" : "muted"
        }
        icon={
          <div
            style={{
              opacity: timedOut() && moderationPerms() ? 0.5 : 1,
            }}
          >
            <AvatarDecoration
              decoration={(props.user ?? props.member?.user)?.style?.decoration}
              file={(props.user ?? props.member?.user)?.style?.decoration_file}
              size={32}
            >
              <Avatar
                src={user().avatar}
                size={32}
                holepunch="bottom-right"
                overlay={
                  <UserStatus.Graphic
                    status={(props.user ?? props.member?.user)?.presence}
                  />
                }
              />
            </AvatarDecoration>
          </div>
        }
      >
        <NameStatusStack>
          {/* each box that cuts the name short leaves room for its glow */}
          <OverflowingText class={nameRoom} data-name-room="">
            <Row align gap="xs" class={nameRoom} data-name-room="">
              <span
                class={nameRoom}
                data-name-room=""
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "5px",
                  "min-width": "0",
                }}
              >
                <Username
                  username={user().username}
                  colour={user().colour!}
                  userStyle={(props.user ?? props.member?.user)?.style}
                />
                <Show when={(props.user ?? props.member?.user)?.bot}>
                  <BotLabel
                    official={(props.user ?? props.member?.user)?.officialBot}
                    verified={(props.user ?? props.member?.user)?.verifiedBot}
                  />
                </Show>
                <Show
                  when={
                    props.member?.server?.ownerId &&
                    props.member.server.ownerId ===
                      (props.user ?? props.member.user)?.id
                  }
                >
                  <BadgeMark id="server_owner" size="xs" mode="hover" />
                </Show>
                {/* a quiet mark: small, muted, centred on the name's line */}
                <Show when={timedOut() && moderationPerms}>
                  <Tooltip
                    content={t`Timed out until ${props.member!.timeout!.toLocaleString()}`}
                    placement="top"
                  >
                    <span
                      role="img"
                      aria-label={t`Timed out`}
                      style={{
                        display: "inline-flex",
                        "align-items": "center",
                        "justify-content": "center",
                        width: "14px",
                        height: "14px",
                        "flex-shrink": 0,
                        color: "var(--z-fg-muted)",
                        "--z-icon-color": "var(--z-fg-muted)",
                      }}
                    >
                      <Symbol size={13}>timer_off</Symbol>
                    </span>
                  </Tooltip>
                </Show>
              </span>
            </Row>
          </OverflowingText>
          <Show when={status()}>
            <Tooltip
              content={() => <TextWithEmoji content={status()!} />}
              placement="top-start"
              aria={status()!}
            >
              <OverflowingText class={typography({ class: "_status" })}>
                <TextWithEmoji content={status()!} />
              </OverflowingText>
            </Tooltip>
          </Show>
          {/* rich presence: what they are doing, when no status says it */}
          <Show when={!status()}>
            <ActivityLine user={props.user ?? props.member?.user} />
          </Show>
        </NameStatusStack>
      </MenuButton>
    </div>
  );
}
