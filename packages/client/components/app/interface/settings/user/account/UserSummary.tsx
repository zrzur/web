import { Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { User } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useTime } from "@revolt/i18n";
import { useState } from "@revolt/state";
import { Avatar, Button, UserStatus } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Account / profile identity header: banner strip, overlapping avatar,
 * names, real metadata and one clear edit action
 */
export function UserSummary(props: {
  user: User;
  showBadges?: boolean;
  bannerUrl?: string;
  onEdit?: () => void;
}) {
  const dayjs = useTime();
  const state = useState();

  return (
    <Card>
      <Banner
        data-has-image={!!props.bannerUrl}
        style={
          props.bannerUrl
            ? { "background-image": `url("${props.bannerUrl}")` }
            : undefined
        }
      />
      <Body>
        <AvatarRing>
          <Avatar
            src={props.user.animatedAvatarURL}
            fallback={props.user.displayName}
            size={76}
            holepunch="bottom-right"
            overlay={<UserStatus.Graphic status={props.user.presence} />}
          />
        </AvatarRing>
        <Names>
          <DisplayName title={props.user.displayName}>
            {props.user.displayName}
          </DisplayName>
          <Handle>
            {props.user.username}
            {/* the own tag stays off screen in streamer mode */}
            <span data-testid="own-tag">
              #{state.settings.streamerMode ? "••••" : props.user.discriminator}
            </span>
          </Handle>
          <Show when={props.showBadges}>
            <Meta>
              <Icon name="cake" size={14} />
              <Trans>
                Member since {dayjs(props.user.createdAt).format("LL")}
              </Trans>
            </Meta>
          </Show>
        </Names>
        <Show when={props.onEdit}>
          <Button size="sm" variant="tonal" onPress={props.onEdit}>
            <Icon name="pencil-simple" size={16} />
            <Trans>Edit profile</Trans>
          </Button>
        </Show>
      </Body>
    </Card>
  );
}

const Card = styled("section", {
  base: {
    overflow: "hidden",
    borderRadius: "12px",
    border: "1px solid var(--z-border-subtle)",
    background: "color-mix(in srgb, var(--z-bg-sidebar) 70%, var(--z-bg-chat))",
  },
});

/**
 * Banner strip: the user's banner, or a quiet accent-tinted surface
 */
const Banner = styled("div", {
  base: {
    height: "96px",
    backgroundColor: "var(--z-bg-raised)",
    // longhands only, so an inline banner image keeps cover/center
    backgroundImage:
      "linear-gradient(120deg, color-mix(in srgb, var(--z-accent) 32%, var(--z-bg-raised)), color-mix(in srgb, var(--z-accent) 10%, var(--z-bg-sidebar)))",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  },
});

/**
 * Only the avatar overlaps the banner; the names start below the banner
 * edge so they never sit on top of the image
 */
const Body = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
    padding: "12px 20px 16px",
    flexWrap: "wrap",

    "& > button": {
      alignSelf: "center",
    },
  },
});

const AvatarRing = styled("div", {
  base: {
    flexShrink: 0,
    marginTop: "-50px",
    padding: "4px",
    borderRadius: "50%",
    background: "color-mix(in srgb, var(--z-bg-sidebar) 70%, var(--z-bg-chat))",
  },
});

const Names = styled("div", {
  base: {
    flexGrow: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
});

const DisplayName = styled("div", {
  base: {
    fontSize: "20px",
    fontWeight: 600,
    lineHeight: "26px",
    color: "var(--z-fg-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Handle = styled("div", {
  base: {
    fontSize: "14px",
    color: "var(--z-fg-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    "& span": { color: "var(--z-fg-muted)" },
  },
});

const Meta = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "4px",
    fontSize: "12px",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-icon-muted)",
  },
});
