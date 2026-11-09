import { createMemo, createSignal, Match, Show, Switch } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { VirtualContainer } from "@minht11/solid-virtual-container";
import { useInstance } from "@revolt/instance";
import { AvatarDecoration } from "@revolt/ui/components/features/profiles/AvatarDecoration";
import {
  NameplateMotion,
  useDesignMotion,
} from "@revolt/ui/components/features/profiles/NameplateMotion";
import { nameplateBackground } from "@revolt/ui/components/features/profiles/userStyle";
import { Channel, ServerMember, User } from "@zrzur/sdk/solid";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { floatingUserMenus } from "@revolt/app/menus/UserContextMenu";
import { useClient } from "@revolt/client";
import { createIsTimedOut } from "@revolt/common/lib/createIsTimedOut";
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
import { BotLabel } from "@revolt/ui/components/features/profiles/BotLabel";
import { BadgeMark } from "@revolt/ui/components/features/profiles/badges/BadgeMark";

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
    | { t: 0; name: string; count: number; icon?: string | null }
    | { t: 1; member: ServerMember; icon?: never; isOnline: boolean };

  const elements = createMemo(() => {
    const hoistedRoles = props.channel.server!.orderedRoles.filter(
      (role) => role.hoist,
    );

    const restricted = props.channel.potentiallyRestrictedChannel;
    const byRole: Map<string, { member: ServerMember; displayName: string }[]> =
      new Map();
    byRole.set("default", []);
    byRole.set("offline", []);
    hoistedRoles.forEach((role) => byRole.set(role.id, []));

    for (const member of client().serverMembers.values()) {
      if (member.id.server !== props.channel.serverId) {
        continue;
      }
      // If the channel is restricted, check for permission
      if (restricted && !member.hasPermission(props.channel, "ViewChannel")) {
        continue;
      }

      // Only hit the store once to reduce watchers.
      // If you need to access anything on the member in a loop define a const here.
      const memberRoles = member.roles;
      const memberName = member.nickname ?? member.user?.displayName ?? "";

      if (!member.user?.online) {
        byRole.get("offline")!.push({
          member,
          displayName: memberName,
        });
        continue;
      }

      if (memberRoles.length) {
        let assigned;
        for (const hoistedRole of hoistedRoles) {
          if (memberRoles.includes(hoistedRole.id)) {
            byRole.get(hoistedRole.id)!.push({
              member,
              displayName: memberName,
            });
            assigned = true;
            break;
          }
        }

        if (assigned) continue;
      }

      byRole.get("default")!.push({
        member,
        displayName: memberName,
      });
    }

    const roles: { id: string; name: string; icon?: string }[] = [];

    const elements: MemberRoleElement[] = [];

    for (const role of hoistedRoles) {
      roles.push({
        id: role.id,
        name: role.name,
        icon: role.icon?.previewUrl,
      });
    }
    roles.push({ id: "default", name: t`Online` });
    roles.push({ id: "offline", name: t`Offline` });

    for (const role of roles) {
      const roleMembers = byRole
        .get(role.id)!
        .sort((a, b) => a.displayName?.localeCompare(b.displayName) || 0);

      if (!roleMembers?.length) {
        continue;
      }

      elements.push({
        t: 0,
        name: role.name,
        icon: role.icon,
        count: roleMembers.length,
      });

      for (const member of roleMembers) {
        elements.push({
          t: 1,
          member: member.member,
          isOnline: role.id !== "offline",
        });
      }
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
                  <CategoryTitle>
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
            a.displayName.localeCompare(b.displayName),
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
    padding: "0 8px 6px 16px",
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
    marginLeft: "14px",
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

/**
 * Two-line member rows (name + status) are taller than channel rows
 */
const memberRow = css({
  position: "relative",
  "& > *": {
    height: "var(--z-member-row-height, 44px)",
  },
  // keep the row's content above its nameplate
  "& > :not([data-nameplate])": {
    position: "relative",
    zIndex: 1,
  },
  "&[data-plated] > :not([data-nameplate]) *": {
    color: "#fff !important",
    WebkitTextFillColor: "#fff !important",
    textShadow: "0 0 2px rgb(0 0 0 / 60%), 0 1px 4px rgb(0 0 0 / 70%)",
  },
});

/**
 * Nameplate behind a member row: the same shape as everywhere, and the row's
 * words sit on it in white. It takes the row's height less 3 px above and
 * below, so two plated rows never touch (a 6 px gap), keeps the art's shape
 * from that height and sits at the emblem end; its faint start runs under the
 * avatar.
 */
const nameplateLayer = css({
  position: "absolute",
  insetInlineEnd: "8px",
  top: "3px",
  height: "calc(var(--z-member-row-height, 44px) - 6px) !important",
  aspectRatio: "448 / 84",
  maxWidth: "calc(100% - 16px)",
  borderRadius: "var(--z-radius, 10px)",
  pointerEvents: "none",
});

/**
 * Styles required to correctly display name and status
 */
const NameStatusStack = styled("div", {
  base: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
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

  const status = () =>
    (props.user ?? props.member?.user)?.statusMessage((s) =>
      s === "Online"
        ? t`Online`
        : s === "Busy"
          ? t`Busy`
          : s === "Focus"
            ? t`Focus`
            : s === "Idle"
              ? t`Idle`
              : t`Offline`,
    );

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
          >
            <NameplateMotion
              plate={(props.user ?? props.member?.user)?.style?.nameplate}
            />
          </div>
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
          <OverflowingText>
            <Row align gap="xs">
              <span
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
        </NameStatusStack>
      </MenuButton>
    </div>
  );
}
