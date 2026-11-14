import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { User } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { copyText } from "@revolt/common/lib/copyText";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * The person's ID as one small line at the foot of the full profile. A press
 * copies it; it says Copied only when the browser took the text.
 */
export function ProfileId(props: { user: User }) {
  const { t } = useLingui();
  const [copied, setCopied] = createSignal(false);

  async function copy() {
    if (!(await copyText(props.user.id))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Line
      type="button"
      aria-label={t`Copy user ID`}
      title={t`Copy user ID`}
      onClick={() => void copy()}
    >
      <span>
        <Trans>User ID</Trans>
      </span>
      <code dir="ltr" data-testid="profile-user-id">
        {props.user.id}
      </code>
      <Icon name="copy" size={12} />
      <span aria-live="polite">
        <Show when={copied()}>
          <Trans>Copied!</Trans>
        </Show>
      </span>
    </Line>
  );
}

const Line = styled("button", {
  base: {
    alignSelf: "flex-start",
    display: "inline-flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "4px",
    maxWidth: "100%",
    minHeight: "24px",
    padding: 0,
    border: "none",
    background: "none",
    font: "inherit",
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--profile-ink-2, var(--z-fg-muted))",
    "--z-icon-color": "currentColor",
    cursor: "pointer",
    borderRadius: "var(--z-radius-xs, 4px)",

    "& code": {
      fontFamily: "var(--z-font-mono, ui-monospace, monospace)",
      overflowWrap: "anywhere",
    },
    _hover: { color: "var(--profile-ink, var(--z-fg-primary))" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { minHeight: "44px" },
  },
});
