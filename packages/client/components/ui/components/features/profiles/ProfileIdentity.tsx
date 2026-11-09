import { Show, createSignal, lazy } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { ServerMember, User } from "@zrzur/sdk/solid";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { Icon } from "@revolt/ui/icons/Icon";

import { BotLabel } from "./BotLabel";
import { ProfileBadges, profileBadgeIds } from "./ProfileBadges";
import { BadgeList } from "./badges/BadgeMark";
import { readableName, readableTheme } from "./profileTheme";
import { nameStyle, themeColours, userStyleOf } from "./userStyle";

/** Badges that fit on the name row */
const ROW_BADGES = 3;

// lazy: app code is loaded after the UI layer
const CreatorMark = lazy(
  () => import("@revolt/app/interface/settings/user/profile/CreatorMark"),
);

/**
 * Name block under the avatar: display name (+ Bot tag), then username#tag
 * with click-to-copy and pronouns on one line. Up to three badges sit on the
 * name row's far end; more move to a box of their own under the handle. A
 * themed profile keeps its chosen name colour where it reads on the theme.
 */
export function ProfileIdentity(props: {
  user: User;
  member?: ServerMember;
  size: "card" | "full";
}) {
  const { t } = useLingui();
  const [copied, setCopied] = createSignal(false);

  const name = () => props.member?.displayName ?? props.user.displayName;
  const pronouns = () => props.member?.pronouns ?? props.user.pronouns;
  const badges = () => profileBadgeIds(props.user);
  const manyBadges = () => badges().length > ROW_BADGES;

  const style = () => {
    const chosen = userStyleOf(props.user);
    const theme = themeColours(chosen);
    if (!theme) return nameStyle(chosen);
    const reads = readableName(chosen?.name_colour ?? [], readableTheme(theme));
    return reads
      ? nameStyle(chosen)
      : {
          ...nameStyle(chosen, { colour: false }),
          color: "var(--profile-ink, var(--z-fg-primary))",
        };
  };

  function copy() {
    navigator.clipboard.writeText(
      `${props.user.username}#${props.user.discriminator}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Identity data-size={props.size}>
      <NameRow>
        <DisplayNameGroup>
          <Name dir="auto" data-size={props.size} style={style()}>
            {name()}
          </Name>
          <Show when={props.user.official}>
            <span
              class={mark()}
              role="img"
              aria-label={t`Official`}
              use:floating={{
                tooltip: { placement: "top", content: t`Official` },
              }}
            >
              <Icon name="shield-check" size={18} />
            </span>
          </Show>
          <CreatorMark user={props.user} />
          <Show when={props.user.bot}>
            <BotLabel
              official={props.user.officialBot}
              verified={props.user.verifiedBot}
            />
          </Show>
          {/* set by Trust & Safety; the SDK passes the field through */}
          <Show when={(props.user.bot as { verified?: boolean })?.verified}>
            <BadgeList
              ids={["bot_verified"]}
              label={t`Bot badges`}
              mode="press"
            />
          </Show>
        </DisplayNameGroup>
        <Show when={!manyBadges()}>
          <RowBadges>
            <ProfileBadges ids={badges()} />
          </RowBadges>
        </Show>
      </NameRow>

      <Meta>
        <button
          class={username()}
          type="button"
          onClick={copy}
          use:floating={{
            tooltip: {
              placement: "top",
              content: copied() ? t`Copied!` : t`Copy username`,
            },
          }}
        >
          {props.user.username}
          <Tag>#{props.user.discriminator}</Tag>
        </button>
        <Show when={pronouns()}>
          <Dot aria-hidden="true">•</Dot>
          <Pronouns dir="auto">{pronouns()}</Pronouns>
        </Show>
      </Meta>

      <Show when={manyBadges()}>
        <BadgesBlock>
          <BadgeBox>
            <ProfileBadges ids={badges()} />
          </BadgeBox>
        </BadgesBlock>
      </Show>
    </Identity>
  );
}

const Identity = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
});

const NameRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
  },
});

const DisplayNameGroup = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minWidth: 0,
    flex: "1 1 0",
    _phone: {
      // first in a scrolling card: a target reaching above it would be cut off
      "& > [role=list]": { marginBlock: 0 },
      // the username's 44 px target reaches up here: keep the seal clear of it
      "&:has(> [role=list])": { paddingBlockEnd: "8px" },
    },
  },
});

const RowBadges = styled("div", {
  base: {
    flexShrink: 0,
    display: "flex",
    // an empty slot must not take space from the name
    _empty: { display: "none" },
    _phone: {
      // the username's 44 px target reaches up here: keep clear of it
      paddingBlockEnd: "8px",
      "& > [role=list]": { margin: 0 },
    },
  },
});

/** Its line under it is the same line the sections draw above themselves */
const BadgesBlock = styled("div", {
  base: {
    marginBlockStart: "4px",
    paddingBlockEnd: "12px",
    borderBlockEnd: "1px solid var(--profile-line, var(--z-border-subtle))",
    // the username's 44 px target reaches 12 px down: keep clear of it, so a
    // press on a badge never copies the name
    _phone: { marginBlockStart: "12px" },
  },
});

/** Same corners and tint as a link chip */
const BadgeBox = styled("div", {
  base: {
    display: "flex",
    width: "fit-content",
    maxWidth: "100%",
    minWidth: 0,
    paddingBlock: "4px",
    paddingInline: "8px",
    borderRadius: "var(--z-radius-sm, 6px)",
    border: "1px solid var(--profile-line, var(--z-border-subtle))",
    background: "var(--profile-chip, var(--z-bg-input))",
    _phone: { paddingBlock: 0, "& > [role=list]": { margin: 0 } },
  },
});

const Name = styled("h2", {
  base: {
    margin: 0,
    minWidth: 0,
    fontSize: "18px",
    lineHeight: "24px",
    "&[data-size='full']": { fontSize: "22px", lineHeight: "28px" },
    fontWeight: 700,
    letterSpacing: "-0.01em",
    color: "var(--profile-ink, var(--z-fg-primary))",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    userSelect: "text",
  },
});

const Meta = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    minWidth: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
  },
});

const Pronouns = styled("span", {
  base: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const mark = cva({
  base: { display: "inline-flex", flexShrink: 0 },
});

const username = cva({
  base: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flexShrink: 1,
    // phones: a 44 px tap target that keeps the line where it was
    _phone: { minHeight: "44px", marginBlock: "-12px" },
    // elsewhere 24 px (WCAG 2.5.8), still on the same line
    minHeight: "24px",
    marginBlock: "-2px",
    padding: 0,
    border: "none",
    background: "none",
    font: "inherit",
    color: "var(--profile-ink, var(--z-fg-primary))",
    cursor: "pointer",
    _hover: { textDecoration: "underline" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
      borderRadius: "4px",
    },
  },
});

const Tag = styled("span", {
  base: {
    color: "var(--profile-ink-2, var(--z-fg-muted))",
  },
});

const Dot = styled("span", {
  base: {
    flexShrink: 0,
    color: "var(--profile-ink-2, var(--z-fg-muted))",
    fontSize: "12px",
  },
});
