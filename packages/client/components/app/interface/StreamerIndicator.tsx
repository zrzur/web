import { Portal } from "solid-js/web";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useState } from "@revolt/state";
import { setStreamerMode } from "@revolt/state/streamer";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * The small sign at the top while streamer mode is on. Pressing it turns
 * the mode off. Loaded only when the mode is on.
 */
export default function StreamerIndicator() {
  const state = useState();
  const { t } = useLingui();

  return (
    // on top of every layer of the app, whatever opened it
    <Portal>
      <Pill
        type="button"
        data-testid="streamer-indicator"
        title={t`Streamer mode is on. Press to turn it off.`}
        aria-label={t`Streamer mode is on. Press to turn it off.`}
        onClick={() => setStreamerMode(state, false)}
      >
        <Icon name="eye-slash" size={16} />
        <span>
          <Trans>Streamer mode</Trans>
        </span>
      </Pill>
    </Portal>
  );
}

const Pill = styled("button", {
  base: {
    position: "fixed",
    // above dialogs and settings too: the sign must always be seen
    zIndex: "2000",
    top: "4px",
    // centred without a transform, the same in both directions
    insetInline: 0,
    marginInline: "auto",
    width: "fit-content",
    height: "28px",
    paddingInline: "12px",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    borderRadius: "999px",
    border: "1px solid var(--z-accent)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-accent)",
    fontFamily: "inherit",
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: "16px",
    whiteSpace: "nowrap",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgb(0 0 0 / 0.24)",
    "&:hover": { background: "var(--z-slate-1, var(--z-bg-raised))" },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    // phones: a 44 px target around the small sign
    _phone: {
      height: "32px",
      "&::after": {
        content: '""',
        position: "absolute",
        inset: "-6px -4px",
      },
    },
  },
});
