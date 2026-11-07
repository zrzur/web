import { useQuery } from "@tanstack/solid-query";
import { JSX, onMount, Show } from "solid-js";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useDevice } from "@revolt/common";
import { useModals } from "@revolt/modal";

import {
  themeColours,
  userStyleOf,
} from "@revolt/ui/components/features/profiles/userStyle";

import { Profile } from "../features";
import { ProfileEffect } from "../features/profiles/effects/ProfileEffect";
import { createProfileTheme } from "../features/profiles/profileTheme";

/**
 * Profile popout shown next to a name or avatar
 *
 * [banner .......... + ⋯]
 *  (avatar) (status)
 *  Name  BOT
 *  username#0000 • pronouns
 *  [badges]
 *  their sections, in their order
 *  roles
 *  [ Message @name                            ➤ ]
 *  View full profile
 *
 * Everything sits flat on one sheet, and the sheet scrolls inside the card.
 * Your own card has Edit profile where the message box is for others.
 */
export function UserCard(
  props: JSX.Directives["floating"]["userCard"] &
    object & { onClose: () => void },
) {
  const { isMobile } = useDevice();
  const { openModal } = useModals();
  const query = useQuery(() => ({
    queryKey: ["profile", props.user.id],
    queryFn: () => props.user.fetchProfile(),
  }));

  // the second click of a double-click on a name lands on the card that the
  // first click just opened: it must not jump on to the full profile
  const openedAt = Date.now();

  function openFull(now?: unknown) {
    // `now` is true only for the phone path; click handlers pass an event
    if (now !== true && Date.now() - openedAt < 450) return;
    openModal({ type: "user_profile", user: props.user, member: props.member });
    props.onClose();
  }

  onMount(() => {
    if (isMobile) openFull(true);
  });

  // the person's chosen colours colour the whole card
  const theme = createProfileTheme(
    () =>
      query.data?.bannerURL ?? props.member?.avatarURL ?? props.user.avatarURL,
    () => props.user.id,
    () => themeColours(userStyleOf(props.user)),
  );

  return (
    <Show when={!isMobile}>
      <Card role="dialog" aria-label={props.user.displayName} style={theme()}>
        <ProfileEffect
          effect={userStyleOf(props.user)?.effect}
          file={userStyleOf(props.user)?.effect_file}
        />

        <div class={scroller()} use:invisibleScrollable>
          <Profile.Banner
            size="card"
            user={props.user}
            member={props.member}
            bannerUrl={query.data?.animatedBannerURL}
            onClick={openFull}
            onClickAvatar={openFull}
            corner={
              <Profile.CornerActions
                user={props.user}
                member={props.member}
                onClose={props.onClose}
              />
            }
          />

          <Body>
            <Profile.Identity
              user={props.user}
              member={props.member}
              size="card"
            />
            {/* a bot's main action: under the name */}
            <Show when={props.user.bot && !props.user.self}>
              <Profile.Actions
                user={props.user}
                member={props.member}
                onClose={props.onClose}
                compact
              />
            </Show>

            <Profile.Body
              user={props.user}
              member={props.member}
              profile={query.data}
              loading={query.isLoading}
              failed={query.isError}
              bot={props.bot}
              onClose={props.onClose}
            />
          </Body>

          {/* your own card has no footer: Edit profile is in the "..." menu */}
          <Show when={!props.user.self}>
            <Footer>
              <Profile.Message
                user={props.user}
                member={props.member}
                onClose={props.onClose}
              />
            </Footer>
          </Show>
        </div>
      </Card>
    </Show>
  );
}

const Card = styled("div", {
  base: {
    "--profile-surface": "var(--z-bg-popover, var(--z-bg-raised))",

    position: "relative",
    display: "flex",
    flexDirection: "column",
    width: "340px",
    maxWidth: "calc(100vw - 24px)",
    maxHeight: "min(640px, calc(100dvh - 32px))",
    overflow: "hidden",

    color: "var(--profile-ink, var(--z-fg-primary))",
    background: "var(--z-popover-bg)",
    border: "1px solid var(--z-popover-border)",
    borderRadius: "14px",
    boxShadow: "var(--z-popover-lift)",

    // a phone shows it as a sheet: edge to edge, on the sheet's own edge
    _phone: {
      minWidth: "100vw",
      marginInline: "-8px",
      marginBlockEnd: "calc(-12px - env(safe-area-inset-bottom))",
      maxHeight: "calc(78dvh - 23px)",
      paddingBlockEnd: "env(safe-area-inset-bottom)",
      border: "none",
      borderRadius: "14px 14px 0 0",
      boxShadow: "none",
    },
  },
});

const scroller = cva({
  base: {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    overscrollBehavior: "contain",
  },
});

const Body = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "4px 16px 12px",
  },
});

const Footer = styled("div", {
  base: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px 16px",
    borderBlockStart: "1px solid var(--profile-line, var(--z-border-subtle))",
  },
});
