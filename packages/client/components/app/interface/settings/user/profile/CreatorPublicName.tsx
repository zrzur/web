import { Show, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { patchSharedAnswer } from "@revolt/common/lib/creatorCache";
import { TranslatedError } from "@revolt/i18n/errors";
import { SettingsRow, SettingsSection, Toggle } from "@revolt/ui";

import { type CommunityPermissions, communityApi } from "./communityApi";

/**
 * A creator's own choice about the public Designs site, in Profile settings
 * with the rest of what people see about you
 */
export function CreatorPublicName(props: { initial: boolean }) {
  const client = useClient();
  // eslint-disable-next-line solid/reactivity
  const [shown, setShown] = createSignal(props.initial);
  const [saving, setSaving] = createSignal(false);
  const [failure, setFailure] = createSignal<unknown>();

  async function toggle() {
    const next = !shown();
    setShown(next);
    setSaving(true);
    setFailure(undefined);
    try {
      await communityApi.setPublicName(client(), next);
      patchSharedAnswer<CommunityPermissions>((answer) => ({
        ...answer,
        show_public_name: next,
      }));
    } catch (error) {
      setShown(!next);
      setFailure(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection title={<Trans>Designs</Trans>}>
      <SettingsRow
        title={<Trans>Show my name on the public Designs site</Trans>}
        description={
          <Trans>
            Off by default. Designs.zrzur.com is open to everyone and search
            engines, without an account. Switched on, your name and avatar
            appear on your designs there, and anyone can open a page of all your
            work. Switched off, visitors see the designs without any name and
            nobody gets that page. Your #tag never shows.
          </Trans>
        }
        control={(ids) => (
          <Toggle
            checked={shown()}
            disabled={saving()}
            onChange={() => void toggle()}
            aria-labelledby={ids.labelId}
            aria-describedby={ids.descriptionId}
          />
        )}
      />
      <Show when={failure()}>
        <Problem role="alert">
          <TranslatedError error={failure()} />
        </Problem>
      </Show>
    </SettingsSection>
  );
}

const Problem = styled("div", {
  base: { fontSize: "13px", color: "var(--z-danger)" },
});
