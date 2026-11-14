import { Show, createSignal } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { ServerMember, User } from "@zrzur/sdk/solid";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { copyText } from "@revolt/common/lib/copyText";
import { Icon } from "@revolt/ui/icons/Icon";

import { BotLabel } from "./BotLabel";
import { ProfileBadges, profileBadgeIds } from "./ProfileBadges";
import { nameRowBadges } from "./nameRowBadges";
import { readableName, readableTheme } from "./profileTheme";
import { nameStyle, themeColours, userStyleOf } from "./userStyle";

/**
 * Name block under the avatar: display name (+ Bot tag), then username#tag
 * with click-to-copy and pronouns on one line. Badges sit at the far end of
 * the name row: the first three on the small card, all of them on the full profile,
 * where they may run on to a second line. A themed profile keeps its chosen
 * name colour where it reads on the theme.
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
  const badges = () => nameRowBadges(profileBadgeIds(props.user), props.size);

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

  // "Copied!" only when the browser took it; a refusal is no page error
  async function copy() {
    const copiedIt = await copyText(
      `${props.user.username}#${props.user.discriminator}`,
    );
    if (!copiedIt) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Identity data-size={props.size}>
      <NameRow data-size={props.size}>
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
          <Show when={props.user.bot}>
            <BotLabel
              official={props.user.officialBot}
              verified={props.user.verifiedBot}
            />
          </Show>
        </DisplayNameGroup>
        <RowBadges>
          <ProfileBadges ids={badges()} />
        </RowBadges>
      </NameRow>

      <Meta>
        <button
          class={username()}
          type="button"
          onClick={() => void copy()}
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
    // the full profile shows every badge: they may take a second line
    "&[data-size='full']": { flexWrap: "wrap", rowGap: "4px" },
  },
});

const DisplayNameGroup = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minWidth: 0,
    // only as wide as the name; the badges keep to the far end
    flex: "0 1 auto",
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
    // at the far end of the row (right in LTR, left in RTL), not after the name
    marginInlineStart: "auto",
    // an empty slot must not take space from the name
    _empty: { display: "none" },
    _phone: {
      // the username's 44 px target reaches up here: keep clear of it
      paddingBlockEnd: "8px",
      "& > [role=list]": { margin: 0 },
    },
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
