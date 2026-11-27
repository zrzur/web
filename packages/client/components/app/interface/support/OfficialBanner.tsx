import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Takes the place of the message box in the conversation with Zrzur's
 * official account: nobody can write there, so it says so and where help is.
 * A note, not an action (owner, 2026-11-27: no button here).
 */
export function OfficialBanner() {
  return (
    <Banner role="note">
      <Shield aria-hidden="true">
        <Icon name="shield-check" size={24} />
      </Shield>
      <Text>
        <strong>
          <Trans>Only the Zrzur team can write here.</Trans>
        </strong>
        <span>
          <Trans>For help, open Settings and choose Contact support.</Trans>
        </span>
      </Text>
    </Banner>
  );
}

const Banner = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    margin: "0 16px 16px",
    padding: "12px 16px",
    borderRadius: "var(--z-box-radius)",
    background: "var(--z-box-bg)",
    border: "var(--z-box-border)",
  },
});

const Shield = styled("div", {
  base: {
    display: "grid",
    placeItems: "center",
    color: "var(--z-accent, var(--md-sys-color-primary))",
    flexShrink: 0,
  },
});

const Text = styled("div", {
  base: {
    display: "grid",
    gap: "2px",
    flex: "1 1 240px",
    minWidth: 0,
    "& strong": {
      fontSize: "15px",
      color: "var(--z-fg, var(--md-sys-color-on-surface))",
    },
    "& span": {
      fontSize: "13px",
      color: "var(--z-fg-secondary, var(--md-sys-color-on-surface-variant))",
    },
  },
});
