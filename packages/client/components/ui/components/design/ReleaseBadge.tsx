import { Show } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

/**
 * A quiet "Beta" label for a deployment that runs the beta release
 * (VITE_RELEASE_CHANNEL). Neutral on purpose: it informs, it is not an
 * action, so it never wears the action colour.
 */
export function ReleaseBadge(props: {
  channel: "beta" | "stable";
  /** sit over the bottom edge of the element around it (the rail logo) */
  overlay?: boolean;
}) {
  const { t } = useLingui();
  return (
    <Show when={props.channel === "beta"}>
      <Label
        data-release-badge
        data-overlay={props.overlay || undefined}
        role="note"
        title={t`Beta version: some things may still change.`}
        aria-label={t`Beta version: some things may still change.`}
      >
        {t`Beta`}
      </Label>
    </Show>
  );
}

const Label = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    height: "16px",
    paddingInline: "6px",
    borderRadius: "999px",
    border: "1px solid var(--z-border-soft)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-secondary)",
    fontSize: "10px",
    lineHeight: "14px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    verticalAlign: "middle",
    userSelect: "none",
    // centred under the logo in both directions, no transform to mirror
    "&[data-overlay]": {
      position: "absolute",
      insetInline: 0,
      bottom: "-6px",
      width: "fit-content",
      marginInline: "auto",
      pointerEvents: "none",
    },
  },
});
