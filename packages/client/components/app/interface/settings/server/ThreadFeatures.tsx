import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";

import { TranslatedError } from "@revolt/i18n/errors";
import {
  Column,
  SettingsRow,
  SettingsSection,
  Text,
  Toggle,
} from "@revolt/ui";

import { useSaved } from "./savedNotice";

/**
 * Threads and forums on or off for the whole server. Off stops anything new
 * and keeps what exists readable; the server enforces it (threads.rs).
 */
export function ThreadFeatures(props: { server: Server }) {
  const { t } = useLingui();

  const saved = useSaved();
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<unknown>();

  const canManage = () => props.server.havePermission("ManageServer");

  async function change(
    field: "threads_disabled" | "forums_disabled",
    on: boolean,
  ) {
    if (!canManage() || pending()) return;
    setPending(true);
    setError(undefined);
    try {
      await props.server.edit({ [field]: !on });
      saved();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  const row = (
    title: string,
    description: string,
    field: "threads_disabled" | "forums_disabled",
    on: () => boolean,
  ) => (
    <SettingsRow
      title={title}
      description={description}
      disabled={!canManage() || pending()}
      onClick={() => void change(field, !on())}
      control={(ids) => (
        <Toggle
          checked={on()}
          disabled={!canManage() || pending()}
          onChange={() => void change(field, !on())}
          aria-labelledby={ids.labelId}
          aria-describedby={ids.descriptionId}
        />
      )}
    />
  );

  return (
    <Column gap="lg">
      <SettingsSection>
        {row(
          t`Threads`,
          t`Side conversations in the text channels of this server.`,
          "threads_disabled",
          () => !props.server.threadsDisabled,
        )}
        {row(
          t`Forums`,
          t`Channels of posts with a title and tags in this server.`,
          "forums_disabled",
          () => !props.server.forumsDisabled,
        )}
      </SettingsSection>
      <Text class="label" size="small">
        <Trans>
          When one is off, nobody can add to it, the owner included. Nothing is
          deleted: everything already there can still be read.
        </Trans>
      </Text>
      <Show when={error()}>
        <div role="alert">
          <TranslatedError error={error()} />
        </div>
      </Show>
    </Column>
  );
}
