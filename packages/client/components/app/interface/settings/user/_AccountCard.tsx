import { Trans } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { Avatar, OverflowingText, Ripple, UserStatus } from "@revolt/ui";

import { arrow_back as MdArrowBack } from "@revolt/ui/icons/legacy";

import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";
import { useSettingsNavigation } from "../Settings";
import {
  SidebarButton,
  SidebarButtonContent,
  SidebarButtonTitle,
} from "../_layout/SidebarButton";

/**
 * Account card at the top of the settings sidebar:
 * [avatar + presence]  Display name
 *                      My account
 * Selected = accent ring around the avatar, not a filled box (a box around
 * a large avatar looked cramped and heavy) and not the side bar the other
 * rows have (it sat tight against the avatar); the only row without one
 */
export function AccountCard() {
  const client = useClient();
  const { page, navigate } = useSettingsNavigation();

  const selected = () => page() === "account";

  return (
    <SidebarButton
      flat
      class={card}
      onClick={() => navigate("account")}
      aria-selected={selected()}
    >
      <SidebarButtonTitle>
        <AvatarRing data-avatar-ring data-selected={selected()}>
          <Avatar
            size={36}
            src={client().user!.animatedAvatarURL}
            fallback={client().user!.displayName}
            holepunch="bottom-right"
            overlay={<UserStatus.Graphic status={client().user!.presence} />}
          />
        </AvatarRing>
        <SidebarButtonContent>
          <Name>
            <OverflowingText>{client().user!.displayName}</OverflowingText>
          </Name>
          <Sub data-selected={selected()}>
            <Trans>My account</Trans>
          </Sub>
        </SidebarButtonContent>
      </SidebarButtonTitle>
    </SidebarButton>
  );
}

export function BackCard(props: { onClose?: () => void }) {
  return (
    <SidebarButton
      class={"back " + mobileOnly}
      onClick={props.onClose}
      noDrawer
    >
      <Ripple />
      <SidebarButtonTitle>
        <MdArrowBack />
        <SidebarButtonContent>
          <Trans>Back</Trans>
        </SidebarButtonContent>
      </SidebarButtonTitle>
    </SidebarButton>
  );
}

const mobileOnly = css({
  display: "none",
  _tablet: { display: "flex" },
});

/** Taller than nav rows, with room around the avatar */
const card = css({
  minHeight: "56px",
  paddingBlock: "8px",
  paddingInline: "8px",
  borderRadius: "10px",
  marginBottom: "4px",
});

const AvatarRing = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    padding: "2px",
    borderRadius: "50%",
    boxShadow: "0 0 0 2px transparent",
    transition: "box-shadow 0.15s ease",

    "&[data-selected='true']": {
      boxShadow: "0 0 0 2px var(--z-accent)",
    },
  },
});

const Name = styled("span", {
  base: {
    minWidth: 0,
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: "18px",
    color: "var(--z-fg-primary)",
  },
});

const Sub = styled("span", {
  base: {
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: "16px",
    color: "var(--z-fg-muted)",
    transition: "color 0.15s ease",

    "&[data-selected='true']": {
      color: "var(--z-accent-text, var(--z-accent))",
    },
  },
});
