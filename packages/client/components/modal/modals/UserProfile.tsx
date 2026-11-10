import { Show } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { useQuery } from "@tanstack/solid-query";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { Dialog, DialogProps, Profile } from "@revolt/ui";
import { ProfileEffect } from "@revolt/ui/components/features/profiles/effects/ProfileEffect";
import { createProfileTheme } from "@revolt/ui/components/features/profiles/profileTheme";
import {
  themeColours,
  userStyleOf,
} from "@revolt/ui/components/features/profiles/userStyle";
import { Icon } from "@revolt/ui/icons/Icon";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Full profile: one narrow column, the sections of the card, then Note.
 *
 * [ banner                 x ]
 * [ (avatar) (status)   ...  ]
 * [ Name / username          ]
 * [ sections, roles          ]
 * [ Note                     ]
 */
export function UserProfileModal(
  props: DialogProps & Modals & { type: "user_profile" },
) {
  const { t } = useLingui();
  const { openModal } = useModals();

  const query = useQuery(() => ({
    queryKey: ["profile", props.user.id],
    queryFn: () => props.user.fetchProfile(),
  }));

  // the person's chosen colours colour the whole dialog
  const theme = createProfileTheme(
    () =>
      query.data?.bannerURL ?? props.member?.avatarURL ?? props.user.avatarURL,
    () => props.user.id,
    () => themeColours(userStyleOf(props.user)),
  );

  return (
    <Dialog show={props.show} onClose={props.onClose} bare width={460}>
      <Layout data-sheet-edge style={theme()}>
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
              bot={props.user.bot ? { owner: props.user.bot.owner } : undefined}
              onClose={props.onClose}
            >
              <Show when={!props.user.self}>
                <Profile.Note user={props.user} />
              </Show>
            </Profile.Body>
          </Details>
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
    maxHeight: "min(638px, calc(100dvh - 98px))",
    minHeight: 0,

    // edge to edge on a phone: `data-sheet-edge` takes the sheet's padding off
    _phone: {
      paddingBlockEnd: "var(--z-safe-bottom)",
      height:
        "calc(100dvh - 48px - var(--z-safe-top) - max(var(--keyboard-inset, 0px), env(keyboard-inset-height, 0px)))",
      maxHeight: "none",
    },
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
    padding: "4px 20px 20px",
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
    borderRadius: "8px",
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
    _phone: { width: "44px", height: "44px" },
  },
});
