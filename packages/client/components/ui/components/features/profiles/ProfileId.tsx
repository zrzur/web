import { Show, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { User } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { copyText } from "@revolt/common/lib/copyText";
import { Icon } from "@revolt/ui/icons/Icon";

import { ProfileSection, chip } from "./ProfileCard";

/**
 * The person's ID at the end of the full profile, with a button that copies
 * it. The button says Copied only when the browser took the text.
 */
export function ProfileId(props: { user: User }) {
  const [copied, setCopied] = createSignal(false);

  async function copy() {
    if (!(await copyText(props.user.id))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <ProfileSection title={<Trans>User ID</Trans>}>
      <Row>
        <Id dir="ltr" data-testid="profile-user-id">
          {props.user.id}
        </Id>
        <button
          class={chip({ press: true })}
          type="button"
          onClick={() => void copy()}
        >
          <Icon name="copy" size={14} />
          <span aria-live="polite">
            <Show when={copied()} fallback={<Trans>Copy ID</Trans>}>
              <Trans>Copied!</Trans>
            </Show>
          </span>
        </button>
      </Row>
    </ProfileSection>
  );
}

const Row = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px 12px",
    minWidth: 0,
  },
});

const Id = styled("code", {
  base: {
    minWidth: 0,
    fontFamily: "var(--z-font-mono, ui-monospace, monospace)",
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
    overflowWrap: "anywhere",
    userSelect: "all",
  },
});
