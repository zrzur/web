import { For, Show } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useQuery } from "@tanstack/solid-query";
import type { User } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient, useUser } from "@revolt/client";
import { billingAvailable } from "@revolt/client/billing";
import { presencePatch } from "@revolt/common/lib/statusWrite";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { Header, UserStatus } from "@revolt/ui";
import { Profile } from "@revolt/ui/components/features";
import { createProfileTheme } from "@revolt/ui/components/features/profiles/profileTheme";
import {
  themeColours,
  userStyleOf,
} from "@revolt/ui/components/features/profiles/userStyle";
import { type IconName, Icon } from "@revolt/ui/icons/Icon";

import { HeaderIcon } from "./common/CommonHeader";
import {
  pendingPresence,
  setPendingPresence,
} from "./navigation/servers/presenceUpdate";

type Presence = "Online" | "Idle" | "Busy" | "Invisible";

/**
 * "You": your own profile and the places you go to often, in one page.
 * The phone tab bar opens it; it works the same on wider screens.
 *
 * [banner + avatar ............ settings]
 * Name / @username / status
 * [Edit status] [Edit profile]
 * presence: Online · Idle · Do not disturb · Invisible
 * About me / Member since
 * Friends · Designs · Saved notes · Feather · Settings
 */
export function You() {
  const user = useUser();

  return (
    <Base>
      <Header placement="primary">
        <HeaderIcon>
          <Icon name="user-circle" size={22} />
        </HeaderIcon>
        <Title>
          <Trans>You</Trans>
        </Title>
      </Header>
      <Scroll>
        <Show when={user()}>
          <Body user={user()!} />
        </Show>
      </Scroll>
    </Base>
  );
}

function Body(props: { user: User }) {
  const { t } = useLingui();
  const client = useClient();
  const navigate = useNavigate();
  const { openModal } = useModals();

  const query = useQuery(() => ({
    queryKey: ["profile", props.user.id],
    queryFn: () => props.user.fetchProfile(),
  }));

  const theme = createProfileTheme(
    () => query.data?.bannerURL ?? props.user.avatarURL,
    () => props.user.id,
    () => themeColours(userStyleOf(props.user)),
  );

  const settings = (page?: string) =>
    openModal({
      type: "settings",
      config: "user",
      ...(page ? { context: { page } } : {}),
    });

  const presence = () => pendingPresence() ?? props.user.presence;
  const presences: { value: Presence; label: () => string }[] = [
    { value: "Online", label: () => t`Online` },
    { value: "Idle", label: () => t`Idle` },
    { value: "Busy", label: () => t`Do not disturb` },
    { value: "Invisible", label: () => t`Invisible` },
  ];
  const setPresence = (value: Presence) => {
    if (value === presence()) return;
    setPendingPresence(value);
    props.user
      .edit(presencePatch(value))
      .finally(() => setPendingPresence(undefined));
  };

  const openSavedNotes = () => {
    const id = [...client()!.channels.values()].find(
      (channel) => channel.type === "SavedMessages",
    )?.id;
    if (id) navigate(`/channel/${id}`);
    else
      client()!
        .user!.openDM()
        .then((channel) => navigate(`/channel/${channel.id}`));
  };

  const links: {
    icon: IconName;
    label: () => string;
    hint: () => string;
    onPress: () => void;
  }[] = [
    {
      icon: "users",
      label: () => t`Friends`,
      hint: () => t`Add people and see who is online`,
      onPress: () => navigate("/friends"),
    },
    {
      icon: "palette",
      label: () => t`Designs`,
      hint: () => t`Decorations, nameplates and colours`,
      onPress: () => navigate("/designs"),
    },
    {
      icon: "notebook",
      label: () => t`Saved notes`,
      hint: () => t`Messages and links you keep for later`,
      onPress: openSavedNotes,
    },
    // only when the server offers Feather, as in the settings menu
    ...(billingAvailable()
      ? [
          {
            icon: "sparkle" as const,
            label: () => t`Zrzur Feather`,
            hint: () =>
              t`Bigger uploads, better streams, and you keep Zrzur flying`,
            onPress: () => settings("plus"),
          },
        ]
      : []),
    {
      icon: "gear-six",
      label: () => t`Settings`,
      hint: () => t`Account, privacy, appearance and more`,
      onPress: () => settings(),
    },
  ];

  return (
    <Content>
      <Card style={theme()}>
        <Profile.Banner
          size="card"
          user={props.user}
          bannerUrl={query.data?.animatedBannerURL}
          onClickAvatar={() => settings("profile")}
          corner={
            <CornerButton
              type="button"
              aria-label={t`Settings`}
              onClick={() => settings()}
            >
              <Icon name="gear-six" size={20} />
            </CornerButton>
          }
        />
        <CardBody>
          <Profile.Identity user={props.user} size="card" />
          <Actions>
            <Action
              type="button"
              data-secondary
              onClick={() =>
                openModal({ type: "custom_status", client: client() })
              }
            >
              <Icon name="chat-circle" size={18} />
              <Trans>Edit status</Trans>
            </Action>
            <Action type="button" onClick={() => settings("profile")}>
              <Icon name="pencil-simple" size={18} />
              <Trans>Edit profile</Trans>
            </Action>
          </Actions>
        </CardBody>
      </Card>

      <Section aria-label={t`Status`}>
        <Presences role="radiogroup" aria-label={t`Status`}>
          <For each={presences}>
            {(item) => (
              <PresenceChip
                type="button"
                role="radio"
                aria-checked={presence() === item.value}
                onClick={() => setPresence(item.value)}
              >
                <UserStatus status={item.value} size="10px" />
                {item.label()}
              </PresenceChip>
            )}
          </For>
        </Presences>
      </Section>

      <Show when={query.data?.content}>
        <Panel>
          <Profile.Bio content={query.data?.content} />
          <Profile.Joined user={props.user} />
        </Panel>
      </Show>

      <Panel>
        <For each={links}>
          {(link) => (
            <Row type="button" onClick={link.onPress}>
              <RowIcon>
                <Icon name={link.icon} size={20} />
              </RowIcon>
              <RowText>
                <strong>{link.label()}</strong>
                <small>{link.hint()}</small>
              </RowText>
              <Chevron>
                <Icon name="caret-right" size={16} />
              </Chevron>
            </Row>
          )}
        </For>
      </Panel>
    </Content>
  );
}

const Base = styled("div", {
  base: {
    width: "100%",
    minWidth: 0,
    minHeight: 0,
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
  },
});

const Title = styled("span", {
  base: { fontSize: "16px", fontWeight: 600 },
});

const Scroll = styled("div", {
  base: {
    flexGrow: 1,
    minHeight: 0,
    overflowY: "auto",
  },
});

const Content = styled("div", {
  base: {
    width: "min(100%, 640px)",
    marginInline: "auto",
    boxSizing: "border-box",
    padding: "16px 16px 32px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
});

const Card = styled("div", {
  base: {
    overflow: "hidden",
    borderRadius: "var(--z-shape-card, calc(var(--z-radius, 10px) + 4px))",
    border: "1px solid var(--z-btn-surface-border, var(--z-border-subtle))",
    background: "var(--profile-surface, var(--z-card-bg, var(--z-bg-raised)))",
    boxShadow: "var(--z-card-lift)",
  },
});

const CardBody = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    padding: "4px 16px 16px",
  },
});

const CornerButton = styled("button", {
  base: {
    width: "44px",
    height: "44px",
    display: "grid",
    placeItems: "center",
    border: "none",
    borderRadius: "50%",
    color: "#fff",
    background: "rgb(0 0 0 / 0.55)",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});

const Actions = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
});

const Action = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minHeight: "44px",
    border: "none",
    borderRadius: "var(--z-shape-button, var(--z-radius-sm, 6px))",
    color: "var(--z-on-accent, #fff)",
    background: "var(--z-btn-primary-bg, var(--z-accent-fill, #E0195F))",
    boxShadow: "var(--z-btn-lift)",
    font: "inherit",
    paddingInline: "10px",
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: "18px",
    whiteSpace: "nowrap",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    transition: "filter 120ms ease, box-shadow 120ms ease",
    _motionReduce: { transition: "none" },
    _active: {
      filter: "brightness(0.92)",
      boxShadow: "var(--z-btn-pressed)",
    },
    // one filled action per screen: status is the quieter one
    // it sits on the profile's own surface (a user style may make the text
    // white on a light page), so its fill is a veil of its own text colour
    "&[data-secondary]": {
      color: "var(--z-fg-primary)",
      background: "color-mix(in srgb, currentColor 14%, transparent)",
      border: "1px solid color-mix(in srgb, currentColor 28%, transparent)",
      boxShadow: "none",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const Section = styled("section", {
  base: { display: "flex", flexDirection: "column" },
});

const Presences = styled("div", {
  base: {
    display: "flex",
    gap: "8px",
    // every choice stays in view: a narrow screen gets a second row, not a
    // row that is cut off at the edge
    flexWrap: "wrap",
  },
});

const PresenceChip = styled("button", {
  base: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "40px",
    paddingInline: "14px",
    borderRadius: "999px",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-secondary)",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    cursor: "pointer",
    transition: "background-color 120ms ease, border-color 120ms ease",
    _motionReduce: { transition: "none" },
    _phone: { minHeight: "44px" },
    "&:hover": {
      color: "var(--z-fg-primary)",
      background: "var(--z-nav-hover)",
    },
    "&:active": { background: "var(--z-nav-selected)" },
    "&[aria-checked='true']": {
      color: "var(--z-fg-primary)",
      // the current choice is raised, never tinted (brand.md §6)
      borderColor: "var(--z-border-strong)",
      background: "var(--z-nav-selected)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const Panel = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "8px",
    borderRadius: "var(--z-shape-card, calc(var(--z-radius, 10px) + 4px))",
    border: "1px solid var(--z-btn-surface-border, var(--z-border-subtle))",
    background: "var(--z-card-bg, var(--z-bg-raised))",
    boxShadow: "var(--z-card-lift)",
    "&:has(> button)": { gap: "2px" },
  },
});

const Row = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    minHeight: "60px",
    padding: "8px 10px",
    border: "none",
    borderRadius: "var(--z-shape-chip, var(--z-radius-sm, 6px))",
    background: "none",
    color: "var(--z-fg-primary)",
    font: "inherit",
    textAlign: "start",
    cursor: "pointer",
    transition: "background-color 120ms ease",
    _motionReduce: { transition: "none" },
    _hover: { background: "var(--z-nav-hover)" },
    _active: { background: "var(--z-nav-selected)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});

const RowIcon = styled("span", {
  base: {
    flexShrink: 0,
    width: "40px",
    height: "40px",
    display: "grid",
    placeItems: "center",
    "--z-icon-color": "var(--z-icon-neutral)",
  },
});

const RowText = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    "& strong": { fontSize: "15px", fontWeight: 600 },
    "& small": { fontSize: "13px", color: "var(--z-fg-muted)" },
  },
});

const Chevron = styled("span", {
  base: {
    flexShrink: 0,
    "--z-icon-color": "var(--z-icon-muted)",
    // RTL: the chevron icon mirrors itself (see styles.css)
  },
});
