import { For, Show, createEffect, createSignal, on } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useQuery } from "@tanstack/solid-query";
import type { User } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { openInbox } from "@revolt/app/interface/saved/inboxView";
import { savedRemindersEnabled } from "@revolt/app/interface/saved/savedModel";
import { useClient, useUser } from "@revolt/client";
import { billingAvailable } from "@revolt/client/billing";
import { useDevice } from "@revolt/common";
import { presencePatch } from "@revolt/common/lib/statusWrite";
import { useModals } from "@revolt/modal";
import { installWay } from "@revolt/pwa/installPrompt";
import { useLocation, useNavigate } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Dialog, Header, UserStatus } from "@revolt/ui";
import { Profile } from "@revolt/ui/components/features";
import { fetchFullProfile } from "@revolt/ui/components/features/profiles/linkedGames";
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
 * Friends · Designs · Saved notes · Feather
 * Settings: My account · Appearance · Notifications · Voice · Language ·
 *           Sessions · Connections · All settings
 *
 * Each settings row opens the settings on that page, so the whole account is
 * one screen away from here (owner, 2026-11-17: the page is the place for the
 * profile and the settings, complete).
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

/**
 * Phones: "You" rises from the bottom as a sheet over what is behind it, the
 * way the invite sheet does (owner, 2026-11-17: not a whole page). It closes
 * by a pull down, a tap outside it, Escape or Back, and when one of its rows
 * leads somewhere (a page, the settings). Opened by navigation/YouSheet.tsx,
 * which loads this file the first time. The page at /you stays for wider
 * screens and for links to it.
 */
export function YouSheet(props: { show: boolean; onClose: () => void }) {
  const user = useUser();
  const location = useLocation();

  createEffect(
    on(
      () => location.pathname,
      () => props.onClose(),
      { defer: true },
    ),
  );

  return (
    <Dialog
      show={props.show}
      onClose={() => props.onClose()}
      appearance="creation"
    >
      <SheetBody
        data-sheet-edge
        data-you-sheet
        onClick={(event) => {
          // a row that leads away takes the sheet with it; the status rows
          // work inside it
          if (
            (event.target as Element).closest(
              "[data-links] button, [data-settings] button, [data-edit-profile]",
            )
          )
            props.onClose();
        }}
      >
        <Show when={user()}>
          <Body user={user()!} />
        </Show>
      </SheetBody>
    </Dialog>
  );
}

function Body(props: { user: User }) {
  const { t } = useLingui();
  const client = useClient();
  const navigate = useNavigate();
  const { openModal } = useModals();
  const device = useDevice();
  const state = useState();
  const phone = () => device.layout() === "phone";
  /** phones: the four statuses open under the Status row */
  const [choosing, setChoosing] = createSignal(false);
  const friends = () =>
    client().users.filter((user) => user.relationship === "Friend").length;

  const query = useQuery(() => ({
    queryKey: ["profile", props.user.id],
    queryFn: () => fetchFullProfile(client(), props.user),
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

  /**
   * Go to a page. On phones the lists and the page share the screen: the
   * address alone left the lists showing, and Saved notes "opened" only
   * after a swipe (owner, 2026-11-18).
   */
  const goTo = (path: string) => {
    navigate(path);
    state.appDrawer()?.setShown(true);
  };

  const openSavedNotes = () => {
    const id = [...client()!.channels.values()].find(
      (channel) => channel.type === "SavedMessages",
    )?.id;
    if (id) goTo(`/channel/${id}`);
    else
      client()!
        .user!.openDM()
        .then((channel) => goTo(`/channel/${channel.id}`));
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
      onPress: () => goTo("/friends"),
    },
    {
      icon: "palette",
      label: () => t`Designs`,
      hint: () => t`Decorations, nameplates and colours`,
      onPress: () => goTo("/designs"),
    },
    {
      icon: "notebook",
      label: () => t`Saved notes`,
      hint: () => t`Messages and links you keep for later`,
      onPress: openSavedNotes,
    },
    // only when the server has saving and reminders on
    ...(savedRemindersEnabled(client())
      ? [
          {
            icon: "bookmark-simple" as const,
            label: () => t`Saved messages`,
            hint: () => t`Messages you kept from any conversation`,
            onPress: () => openInbox("saved"),
          },
          {
            icon: "clock" as const,
            label: () => t`Reminders`,
            hint: () => t`Messages that come back to you at a time you pick`,
            onPress: () => openInbox("reminders"),
          },
        ]
      : []),
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
  ];

  // Phones (design pack approved by the owner, 2026-11-17): the look of the
  // settings list. The profile on top without a frame, then groups of rows
  // with bare icons, the value at the end of the row.
  if (phone())
    return (
      <Content data-you-phone>
        <Card style={theme()} data-flat>
          <Profile.Banner
            size="card"
            user={props.user}
            bannerUrl={query.data?.animatedBannerURL}
            onClickAvatar={() => settings("profile")}
          />
          <CardBody>
            <Profile.Identity user={props.user} size="card" />
            <Action
              type="button"
              data-edit-profile
              onClick={() => settings("profile")}
            >
              <Icon name="pencil-simple" size={18} />
              <Trans>Edit profile</Trans>
            </Action>
          </CardBody>
        </Card>

        <PGroup data-status>
          <PRow
            type="button"
            aria-expanded={choosing()}
            onClick={() => setChoosing(!choosing())}
          >
            <StatusSlot data-status-slot>
              <UserStatus status={presence()} size="12px" />
            </StatusSlot>
            <PName>
              <Trans>Status</Trans>
            </PName>
            <PValue>
              {presences.find((item) => item.value === presence())?.label()}
              <Icon name={choosing() ? "caret-up" : "caret-down"} size={16} />
            </PValue>
          </PRow>
          <Show when={choosing()}>
            <div role="radiogroup" aria-label={t`Status`}>
              <For each={presences}>
                {(item) => (
                  <PRow
                    type="button"
                    role="radio"
                    data-inner
                    aria-checked={presence() === item.value}
                    onClick={() => {
                      setPresence(item.value);
                      setChoosing(false);
                    }}
                  >
                    <StatusSlot data-status-slot>
                      <UserStatus status={item.value} size="12px" />
                    </StatusSlot>
                    <PName>{item.label()}</PName>
                    <Show when={presence() === item.value}>
                      <PValue>
                        <Icon name="check" size={18} />
                      </PValue>
                    </Show>
                  </PRow>
                )}
              </For>
            </div>
          </Show>
          <PRow
            type="button"
            onClick={() =>
              openModal({ type: "custom_status", client: client() })
            }
          >
            <Icon name="chat-circle" size={22} />
            <PName>
              <Trans>Edit status</Trans>
            </PName>
            <PValue>
              <Icon name="caret-right" size={16} />
            </PValue>
          </PRow>
        </PGroup>

        <PGroup data-links>
          <For each={links}>
            {(link) => (
              <PRow type="button" onClick={link.onPress}>
                <Icon name={link.icon} size={22} />
                <PName>{link.label()}</PName>
                <PValue>
                  <Show when={link.icon === "users" && friends()}>
                    {friends()}
                  </Show>
                  <Icon name="caret-right" size={16} />
                </PValue>
              </PRow>
            )}
          </For>
        </PGroup>

        <PGroup data-settings>
          <PRow
            type="button"
            data-settings-page="all"
            onClick={() => settings()}
          >
            <Icon name="gear-six" size={22} />
            <PName>
              <Trans>Settings</Trans>
            </PName>
            <PValue>
              <Icon name="caret-right" size={16} />
            </PValue>
          </PRow>
          <Show when={installWay()}>
            <PRow
              type="button"
              data-install-row
              onClick={() => openModal({ type: "install_app" })}
            >
              <Icon name="download-simple" size={22} />
              <PName>
                <Trans>Install the app</Trans>
              </PName>
              <PValue>
                <Icon name="caret-right" size={16} />
              </PValue>
            </PRow>
          </Show>
        </PGroup>
      </Content>
    );

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
              <ActionLabel>
                <Trans>Edit status</Trans>
              </ActionLabel>
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

      {/* phones and tablets that can install the app and have not yet */}
      <Show when={installWay()}>
        <InstallRow
          type="button"
          data-install-row
          onClick={() => openModal({ type: "install_app" })}
        >
          <InstallIcon>
            <Icon name="download-simple" size={20} />
          </InstallIcon>
          <InstallText>
            <strong>
              <Trans>Install the app</Trans>
            </strong>
            <small>
              <Trans>Zrzur on your home screen, in full screen</Trans>
            </small>
          </InstallText>
          <InstallChevron>
            <Icon name="caret-right" size={16} />
          </InstallChevron>
        </InstallRow>
      </Show>

      <Panel data-about>
        <Show when={query.data?.content}>
          <Profile.Bio content={query.data?.content} />
        </Show>
        <Profile.Joined user={props.user} />
      </Panel>

      <Panel data-links>
        <For
          each={[
            ...links,
            {
              icon: "gear-six" as const,
              label: () => t`Settings`,
              hint: () => t`Account, privacy, appearance and more`,
              onPress: () => settings(),
            },
          ]}
        >
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
    // phones: the surface of the settings list, so the page and the
    // settings it leads to are one place
    _phone: {
      background: "var(--z-bg-frame)",
      "& > :first-child": { background: "var(--z-bg-frame)" },
    },
  },
});

/** Phones: a group of rows, filled, no frame */
const PGroup = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    borderRadius: "14px",
    overflow: "hidden",
    background:
      "var(--z-sheet-group, color-mix(in srgb, var(--z-fg-primary) 5%, transparent))",
  },
});

/** Phones: one row. [icon] name ........ value > */
const PRow = styled("button", {
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
    WebkitTapHighlightColor: "transparent",
    "& + &, div + &, & + div": {
      borderTop: "1px solid var(--z-float-divider, var(--z-border-subtle))",
    },
    "&[data-inner]": { paddingInlineStart: "28px" },
    "&[data-inner] + &[data-inner]": { borderTop: "none" },
    _active: {
      background: "color-mix(in srgb, var(--z-fg-primary) 10%, transparent)",
    },
    _focusVisible: {
      outline: "none",
      boxShadow: "inset 0 0 0 2px var(--z-focus)",
    },
  },
});

/** The status dot in the icons' column, so every row's name starts on one line */
const StatusSlot = styled("span", {
  base: {
    flex: "none",
    width: "22px",
    height: "22px",
    display: "grid",
    placeItems: "center",
  },
});

const PName = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const PValue = styled("span", {
  base: {
    flex: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "14px",
    fontWeight: 400,
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-icon-muted)",
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

/** The sheet's own scroller; the profile's banner takes the sheet's corners */
const SheetBody = styled("div", {
  base: {
    // not a scroller: the sheet scrolls (a box here with "contain" and
    // nothing to scroll kept every drag to itself, and the last rows could
    // not be reached; owner, 2026-11-18)
    borderRadius: "20px 20px 0 0",
    // room for the home bar under the last row
    paddingBottom: "var(--z-safe-bottom, 0px)",
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
    // phones: the profile is the top of the page, edge to edge, no frame
    "&[data-flat]": {
      marginInline: "-16px",
      marginBlockStart: "-16px",
      border: "none",
      borderRadius: 0,
      boxShadow: "none",
      background: "transparent",
    },
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
    // phones: the main action takes the row, status is a square beside it
    _phone: {
      gridTemplateColumns: "1fr 48px",
      "& > [data-secondary]": { order: 2, paddingInline: 0 },
    },
  },
});

/** Read out, not shown, where the button is a square icon (phones) */
const ActionLabel = styled("span", {
  base: {
    _phone: {
      position: "absolute",
      width: "1px",
      height: "1px",
      overflow: "hidden",
      clipPath: "inset(50%)",
      whiteSpace: "nowrap",
    },
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
    // phones: two by two, all four in view in every language (one row cut
    // "Online" off at the screen edge in German and had to be swiped)
    _phone: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: "8px",
    },
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
    _phone: {
      minHeight: "44px",
      minWidth: 0,
      justifyContent: "flex-start",
      borderRadius: "12px",
      paddingInline: "14px",
    },
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
    borderRadius: "var(--z-box-radius)",
    border: "var(--z-box-border)",
    background: "var(--z-box-bg)",
    boxShadow: "var(--z-box-shadow)",
    "&:has(> button)": { gap: "2px" },
  },
});

/** One row of its own: [icon] Install the app / one line why  > */
const InstallRow = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "64px",
    padding: "10px 16px",
    borderRadius: "var(--z-shape-card, calc(var(--z-radius, 10px) + 4px))",
    border: "1px solid var(--z-btn-surface-border, var(--z-border-subtle))",
    background: "var(--z-card-bg, var(--z-bg-raised))",
    boxShadow: "var(--z-card-lift)",
    color: "var(--z-fg-primary)",
    font: "inherit",
    textAlign: "start",
    cursor: "pointer",
    transition: "background-color 120ms ease",
    _motionReduce: { transition: "none" },
    _hover: { background: "var(--z-nav-hover)" },
    _active: { background: "var(--z-nav-selected)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const InstallIcon = styled("span", {
  base: {
    flexShrink: 0,
    width: "40px",
    height: "40px",
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: "color-mix(in srgb, var(--z-accent) 16%, transparent)",
    "--z-icon-color": "var(--z-accent-text, var(--z-accent))",
  },
});

const InstallText = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    "& strong": { fontSize: "15px", fontWeight: 600 },
    "& small": {
      fontSize: "13px",
      lineHeight: "18px",
      color: "var(--z-fg-muted)",
    },
  },
});

const InstallChevron = styled("span", {
  base: {
    flexShrink: 0,
    // RTL: the chevron icon mirrors itself (see styles.css)
    "--z-icon-color": "var(--z-icon-muted)",
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
