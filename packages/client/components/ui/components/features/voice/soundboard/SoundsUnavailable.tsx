import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { setSoundboardOpen } from "./soundboardOpen";

/**
 * Shown instead of the sounds when their part of the app could not be
 * loaded twice (a network drop, or an update on the server): the call goes
 * on, nothing reloads
 */
export default function SoundsUnavailable(_props: Record<string, unknown>) {
  return (
    <Box role="alert" data-sounds-unavailable>
      <Trans>The sounds could not load. Close them and open them again.</Trans>
      <Close type="button" onClick={() => setSoundboardOpen(false)}>
        <Trans>Close</Trans>
      </Close>
    </Box>
  );
}

const Box = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-md)",
    padding: "var(--gap-md) var(--gap-lg)",
    borderRadius: "var(--z-box-radius)",
    background: "var(--z-box-bg)",
    border: "var(--z-box-border)",
    color: "var(--z-fg-primary)",
    fontSize: "13px",
    lineHeight: "18px",
  },
});

const Close = styled("button", {
  base: {
    flexShrink: 0,
    minHeight: "32px",
    _phone: { minHeight: "44px" },
    paddingInline: "var(--gap-md)",
    borderRadius: "var(--z-radius-sm)",
    border: "1px solid var(--z-border-subtle)",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    "&:focus-visible": { outline: "2px solid var(--z-accent)" },
  },
});
