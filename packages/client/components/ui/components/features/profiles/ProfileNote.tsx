import { createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { User } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";

import { ProfileSection } from "./ProfileCard";

const MAX_NOTE = 256;

/**
 * A note about someone, for your eyes only. There is no API for notes yet, so
 * it stays in this browser and is never sent anywhere; the line under the
 * field says so.
 */
export function ProfileNote(props: { user: User }) {
  const { t } = useLingui();
  const client = useClient();

  const key = () => `zrzur:note:${client().user?.id}:${props.user.id}`;

  function read() {
    try {
      return localStorage.getItem(key()) ?? "";
    } catch {
      return "";
    }
  }

  const [value, setValue] = createSignal(read());

  function write(text: string) {
    setValue(text);
    try {
      if (text.trim()) localStorage.setItem(key(), text);
      else localStorage.removeItem(key());
    } catch {
      // private browsing without storage: the note lasts until the dialog closes
    }
  }

  return (
    <ProfileSection title={<Trans>Note</Trans>}>
      <Field
        rows={2}
        maxLength={MAX_NOTE}
        value={value()}
        aria-label={t`Note`}
        placeholder={t`Add a note`}
        dir="auto"
        onInput={(e) => write(e.currentTarget.value)}
      />
      <Hint>
        <Trans>Only you can see this. It stays on this device.</Trans>
      </Hint>
    </ProfileSection>
  );
}

const Field = styled("textarea", {
  base: {
    display: "block",
    width: "100%",
    minHeight: "64px",
    paddingBlock: "8px",
    paddingInline: "12px",
    resize: "vertical",
    borderRadius: "8px",
    border: "1px solid var(--profile-line, var(--z-border-subtle))",
    background: "var(--profile-chip, var(--z-bg-input))",
    font: "inherit",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--profile-ink, var(--z-fg-primary))",
    outline: "none",
    "&::placeholder": { color: "var(--profile-ink-2, var(--z-fg-muted))" },
    _focusVisible: { borderColor: "var(--z-focus)" },
    // a phone zooms the page into anything smaller
    _phone: { fontSize: "16px" },
  },
});

const Hint = styled("p", {
  base: {
    margin: 0,
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--profile-ink-2, var(--z-fg-muted))",
  },
});
