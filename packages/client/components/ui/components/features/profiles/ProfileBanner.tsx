import { JSX, Show } from "solid-js";

import { ServerMember, User } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { Avatar, UserStatus } from "../../design";

import { AvatarDecoration } from "./AvatarDecoration";
import { userStyleOf } from "./userStyle";

/**
 * Profile header: a fixed-height banner with the avatar overlapping its
 * bottom edge, and the status beside the avatar.
 *
 * [banner ............. corner]
 *  (avatar) (status)    [edge]
 */
export function ProfileBanner(props: {
  user: User;
  member?: ServerMember;
  bannerUrl?: string;
  size: "card" | "full";
  onClick?: (e: MouseEvent) => void;
  onClickAvatar?: (e: MouseEvent) => void;
  /** Controls drawn over the top-end corner of the banner */
  corner?: JSX.Element;
  /** Controls on the banner's bottom edge, beside the avatar */
  edge?: JSX.Element;
}) {
  const avatar = () =>
    props.member?.animatedAvatarURL ?? props.user.animatedAvatarURL;
  // official accounts are the system, not people: no online dot
  const official = () => props.user.official;
  const status = () => props.user.status?.text;

  return (
    <Header data-size={props.size}>
      <Banner
        data-link={typeof props.onClick !== "undefined" || undefined}
        onClick={props.onClick}
        style={{
          "background-image": props.bannerUrl
            ? `url('${props.bannerUrl}')`
            : undefined,
        }}
      />
      <Show when={props.corner}>
        <Corner>{props.corner}</Corner>
      </Show>
      <AvatarRing>
        <AvatarDecoration
          decoration={userStyleOf(props.user)?.decoration}
          file={userStyleOf(props.user)?.decoration_file}
          size={props.size === "full" ? 96 : 72}
          live
        >
          <Avatar
            src={avatar()}
            fallback={props.user.displayName}
            size={props.size === "full" ? 96 : 72}
            holepunch={official() ? undefined : "bottom-right"}
            onClick={props.onClickAvatar}
            interactive={
              !!props.onClickAvatar &&
              (props.size === "card" || !!props.user.avatar)
            }
            overlay={
              official() ? undefined : (
                <UserStatus.Graphic status={props.user.presence} />
              )
            }
          />
        </AvatarDecoration>
      </AvatarRing>
      <Edge>
        <StatusSlot>
          <Show when={status()}>
            <Bubble dir="auto" title={status() ?? undefined}>
              {status()}
            </Bubble>
          </Show>
        </StatusSlot>
        <Show when={props.edge}>
          <EdgeActions>{props.edge}</EdgeActions>
        </Show>
      </Edge>
    </Header>
  );
}

const Header = styled("div", {
  base: {
    position: "relative",
    flexShrink: 0,
    userSelect: "none",
    // the card's banner is 3:1 of its 340 px, or of the phone's width
    "--banner-height": "113px",
    "--avatar-ring": "80px",
    _phone: { "--banner-height": "calc(100vw / 3)" },
    "--header-inset": "16px",

    "&[data-size='full']": {
      "--banner-height": "140px",
      "--avatar-ring": "104px",
      "--header-inset": "20px",
    },
  },
});

const Banner = styled("div", {
  base: {
    height: "var(--banner-height)",
    backgroundColor: "var(--profile-banner-bg, var(--z-bg-raised))",
    // no banner: a quiet wash of the accent (or, on a themed profile, the
    // profile's own colours show through)
    backgroundImage:
      "var(--profile-banner-fallback, linear-gradient(135deg, color-mix(in srgb, var(--z-accent) 55%, var(--z-bg-raised)), color-mix(in srgb, var(--z-accent) 18%, var(--z-bg-app))))",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",

    "&[data-link]": {
      cursor: "pointer",
    },
  },
});

const Corner = styled("div", {
  base: {
    position: "absolute",
    top: "12px",
    insetInlineEnd: "12px",
    display: "flex",
    gap: "8px",
    zIndex: 2,
  },
});

const AvatarRing = styled("div", {
  base: {
    position: "absolute",
    insetInlineStart: "var(--header-inset)",
    top: "calc(var(--banner-height) - var(--avatar-ring) / 2)",
    width: "var(--avatar-ring)",
    height: "var(--avatar-ring)",
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    // ring in the surface colour separates the avatar from the banner
    background: "var(--profile-ring, var(--z-bg-popover))",
    // disc behind the status dot when it sits above a decoration
    "--avatar-status-ring": "var(--profile-ring, var(--z-bg-popover))",
  },
});

/** Starts after the avatar; the avatar's lower half hangs into this row */
const Edge = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: "8px",
    paddingBlockStart: "8px",
    paddingInlineStart: "calc(var(--header-inset) + var(--avatar-ring) + 8px)",
    paddingInlineEnd: "var(--header-inset)",
    minHeight: "calc(var(--avatar-ring) / 2 + 8px)",
  },
});

const StatusSlot = styled("div", {
  base: {
    flex: "1 1 120px",
    minWidth: 0,
  },
});

/** Sits across the banner's edge, in a solid colour that reads over both */
const Bubble = styled("p", {
  base: {
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    position: "relative",
    width: "fit-content",
    maxWidth: "100%",
    margin: 0,
    marginBlockStart: "-24px",
    paddingBlock: "4px",
    paddingInline: "12px",
    overflow: "hidden",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px solid var(--profile-line, var(--z-border-subtle))",
    background: "var(--profile-bubble, var(--z-bg-raised))",
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--profile-ink, var(--z-fg-primary))",
    userSelect: "text",
  },
});

const EdgeActions = styled("div", {
  base: {
    marginInlineStart: "auto",
    maxWidth: "100%",
  },
});
