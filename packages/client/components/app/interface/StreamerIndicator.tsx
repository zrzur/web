import { Portal } from "solid-js/web";

import { Trans, useLingui } from "@lingui/solid/macro";
import { css } from "styled-system/css";

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
      <button
        type="button"
        class={PHONE_TARGET}
        style={PILL}
        data-testid="streamer-indicator"
        title={t`Streamer mode is on. Press to turn it off.`}
        aria-label={t`Streamer mode is on. Press to turn it off.`}
        onClick={() => setStreamerMode(state, false)}
      >
        <Icon name="eye-slash" size={16} />
        <span>
          <Trans>Streamer mode</Trans>
        </span>
      </button>
    </Portal>
  );
}

// inline styles: this sign loads on demand, so its look stays out of the
// stylesheet every page downloads
const PILL = {
  position: "fixed",
  // above dialogs and settings too: the sign must always be seen
  "z-index": 2000,
  top: "4px",
  // centred without a transform, the same in both directions
  "inset-inline": 0,
  "margin-inline": "auto",
  width: "fit-content",
  "padding-inline": "12px",
  display: "inline-flex",
  "align-items": "center",
  gap: "8px",
  "border-radius": "999px",
  border: "1px solid var(--z-accent)",
  background: "var(--z-bg-raised)",
  color: "var(--z-fg-primary)",
  "--z-icon-color": "var(--z-accent)",
  font: "inherit",
  "font-size": "12px",
  "font-weight": 600,
  "white-space": "nowrap",
  cursor: "pointer",
  "box-shadow": "var(--z-shadow-md)",
} as const;
// phones: a 44 px target (the same rule other screens use)
const PHONE_TARGET = css({ minHeight: "32px", _phone: { minHeight: "44px" } });
