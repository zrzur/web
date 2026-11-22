import { Show } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { useQuery } from "@tanstack/solid-query";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Dialog, DialogProps, Profile } from "@revolt/ui";
import { ProfileId } from "@revolt/ui/components/features/profiles/ProfileId";
import { ProfileEffect } from "@revolt/ui/components/features/profiles/effects/ProfileEffect";
import { FramedCard } from "@revolt/ui/components/features/profiles/frames/ProfileFrame";
import { fetchFullProfile } from "@revolt/ui/components/features/profiles/linkedGames";
import { createProfileTheme } from "@revolt/ui/components/features/profiles/profileTheme";
import {
  themeColours,
  userStyleOf,
} from "@revolt/ui/components/features/profiles/userStyle";
import { Icon } from "@revolt/ui/icons/Icon";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Full profile: the card's sections with room to breathe, then Note and ID.
 *
 * [ banner                              x ]
 * [ (avatar) (status)  [Message] [+] [⋯] ]
 * [ Name                          badges ]
 * [ sections, roles in the server        ]
 * [ in common, Note, User ID             ]
 */
export function UserProfileModal(
  props: DialogProps & Modals & { type: "user_profile" },
) {
  const { t } = useLingui();
  const { openModal } = useModals();
  const client = useClient();

  const query = useQuery(() => ({
    queryKey: ["profile", props.user.id],
    queryFn: () => fetchFullProfile(client(), props.user),
  }));

  // the person's chosen colours colour the whole dialog
  const theme = createProfileTheme(
    () =>
      query.data?.bannerURL ?? props.member?.avatarURL ?? props.user.avatarURL,
    () => props.user.id,
    () => themeColours(userStyleOf(props.user)),
  );

  const style = () => userStyleOf(props.user);
  const framed = () => !!style()?.profile_frame;

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      bare
      unclipped={framed()}
      width={460}
    >
      <FramedCard
        class={framedBox()}
        frame={style()?.profile_frame}
        file={style()?.profile_frame_file}
      >
        <Layout
          data-sheet-edge
          style={theme()}
          data-framed={framed() || undefined}
        >
          <ProfileEffect
            effect={userStyleOf(props.user)?.effect}
            file={userStyleOf(props.user)?.effect_file}
          />
          <div class={main()} use:scrollable>
            <Profile.Banner
              size="full"
              user={props.user}
              member={props.member}
              bannerUrl={query.data?.animatedBannerURL}
              onClick={
                query.data?.banner
                  ? () =>
                      openModal({
                        type: "image_viewer",
                        file: query.data!.banner!,
                      })
                  : undefined
              }
              onClickAvatar={(e) => {
                e.stopPropagation();
                if (props.user.avatar) {
                  openModal({ type: "image_viewer", file: props.user.avatar });
                }
              }}
              edge={
                <Profile.Actions
                  user={props.user}
                  member={props.member}
                  onClose={props.onClose}
                />
              }
            />

            <Details>
              <Profile.Identity
                user={props.user}
                member={props.member}
                size="full"
              />
              <Profile.Body
                user={props.user}
                member={props.member}
                profile={query.data}
                loading={query.isLoading}
                failed={query.isError}
                full
                bot={
                  props.user.bot ? { owner: props.user.bot.owner } : undefined
                }
                onClose={props.onClose}
              >
                <Show when={!props.user.self}>
                  <Profile.Note user={props.user} />
                </Show>
              </Profile.Body>
            </Details>

            {/* the last thing in the profile: it scrolls with the rest */}
            <Foot data-testid="profile-full-foot">
              <Show
                when={!props.user.self && props.user.relationship !== "Blocked"}
              >
                <Profile.Message
                  user={props.user}
                  member={props.member}
                  onClose={props.onClose}
                />
              </Show>
              <ProfileId user={props.user} />
            </Foot>
          </div>

          <Close
            type="button"
            data-dialog-close
            aria-label={t`Close`}
            title={t`Close (Esc)`}
            onClick={props.onClose}
          >
            <Icon name="x" size={18} />
          </Close>
        </Layout>
      </FramedCard>
    </Dialog>
  );
}

const Layout = styled("div", {
  base: {
    // (solid: the avatar ring uses it to cut the avatar out of the banner)
    "--profile-surface":
      "var(--z-dialog-bg, var(--z-bg-modal, var(--z-bg-raised)))",

    position: "relative",
    display: "flex",
    flexDirection: "column",
    background: "var(--profile-surface)",
    maxHeight: "min(760px, calc(100dvh - 98px))",
    minHeight: 0,

    // the window no longer clips when a frame reaches past it: the profile
    // keeps the window's corners itself
    "&[data-framed]": {
      overflow: "hidden",
      borderRadius: "14px",
      _phone: { borderRadius: "20px 20px 0 0" },
    },

    // edge to edge on a phone: `data-sheet-edge` takes the sheet's padding off
    _phone: {
      paddingBlockEnd: "var(--z-safe-bottom)",
      height:
        "calc(100dvh - 48px - var(--z-safe-top) - max(var(--keyboard-inset, 0px), env(keyboard-inset-height, 0px)))",
      maxHeight: "none",
    },
  },
});

/** The profile and its frame fill the window as the profile alone did */
const framedBox = cva({
  base: {
    flex: "1 1 auto",
    minHeight: 0,
    "& > [data-sheet-edge]": { flex: "1 1 auto" },
  },
});

const main = cva({
  base: {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    overscrollBehavior: "contain",
    display: "flex",
    flexDirection: "column",
    "& > *": { flexShrink: 0 },
  },
});

const Details = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "4px 16px 12px",
  },
});

/** The end of the profile, after every section: a message box, then the ID */
const Foot = styled("div", {
  base: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px 16px 16px",
    borderBlockStart: "1px solid var(--profile-line, var(--z-border-subtle))",
  },
});

const Close = styled("button", {
  base: {
    position: "absolute",
    top: "12px",
    insetInlineEnd: "12px",
    zIndex: 2,
    width: "32px",
    height: "32px",
    display: "grid",
    placeItems: "center",
    padding: 0,
    border: "none",
    borderRadius: "var(--z-radius, 10px)",
    cursor: "pointer",
    // sits over the banner: white on dark on any banner or theme
    color: "white",
    background: "rgba(10, 12, 16, 0.72)",
    "--z-icon-color": "currentColor",
    _hover: { background: "rgba(10, 12, 16, 0.88)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    // phones: the profile is a sheet and closes as every sheet does (pulled
    // down, the back gesture, a tap outside); no close button on it (owner,
    // 2026-11-18). Still there for a screen reader and a keyboard.
    _phone: {
      // (!important: the phone rule for dialog close buttons sets 44 px so)
      width: "1px !important",
      height: "1px !important",
      overflow: "hidden",
      opacity: 0,
      pointerEvents: "none",
      _focusVisible: {
        width: "44px !important",
        height: "44px !important",
        opacity: 1,
        pointerEvents: "auto",
      },
    },
  },
});
