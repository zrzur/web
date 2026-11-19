import { For, Show, createResource, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import { SettingsRow, SettingsSection, Toggle } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import type { IconName } from "@revolt/ui/icons/registry";

import {
  EVENT_NOTICES_KEY,
  EVENT_NOTICE_KINDS,
  type EventNoticeKind,
  type EventNoticeSwitches,
  parseEventNotices,
  serializeEventNotices,
} from "./eventNoticeSwitches";

const ICONS: Record<EventNoticeKind, IconName> = {
  reminders: "bell",
  changes: "calendar",
  invitations: "users",
  seats: "check",
};

/**
 * Which notices of events reach your phone. Kept with the account: the
 * server reads these switches when it sends a notice.
 */
export default function EventNotices() {
  const client = useClient();
  const [error, setError] = createSignal<unknown>();
  const [switches, { mutate }] = createResource(async () => {
    const response = (await client().api.post("/sync/settings/fetch", {
      keys: [EVENT_NOTICES_KEY],
    })) as Record<string, [number, string] | undefined>;
    return parseEventNotices(response[EVENT_NOTICES_KEY]?.[1]);
  });
  const enabled = () =>
    client().configuration?.features?.server_events === true;

  async function set(kind: EventNoticeKind, on: boolean) {
    const before = switches();
    if (!before) return;
    const next: EventNoticeSwitches = { ...before, [kind]: on };
    setError(undefined);
    mutate(next);
    try {
      await client().api.post(
        "/sync/settings/set",
        { [EVENT_NOTICES_KEY]: serializeEventNotices(next) },
        { query: { timestamp: Date.now() } },
      );
    } catch (failure) {
      // not saved: the switch goes back
      mutate(before);
      setError(failure);
    }
  }

  return (
    <Show when={enabled() && switches()}>
      <SettingsSection
        title={<Trans context="notification settings">Events</Trans>}
      >
        <For each={EVENT_NOTICE_KINDS}>
          {(kind) => (
            <SettingsRow
              icon={<Icon name={ICONS[kind]} size={20} />}
              title={<Title kind={kind} />}
              description={<Description kind={kind} />}
              onClick={() => void set(kind, !switches()![kind])}
              control={(ids) => (
                <Toggle
                  checked={switches()![kind]}
                  onChange={(value: boolean) => void set(kind, value)}
                  aria-labelledby={ids.labelId}
                  aria-describedby={ids.descriptionId}
                  data-testid={`event-notices-${kind}`}
                />
              )}
            />
          )}
        </For>
        <Show when={error()}>
          <Problem role="alert">
            <TranslatedError error={error()} />
          </Problem>
        </Show>
      </SettingsSection>
    </Show>
  );
}

function Title(props: { kind: EventNoticeKind }) {
  return (
    <>
      <Show when={props.kind === "reminders"}>
        <Trans>Reminders before an event</Trans>
      </Show>
      <Show when={props.kind === "changes"}>
        <Trans>Changed or called off</Trans>
      </Show>
      <Show when={props.kind === "invitations"}>
        <Trans>Invitations to events</Trans>
      </Show>
      <Show when={props.kind === "seats"}>
        <Trans>A seat came free for you</Trans>
      </Show>
    </>
  );
}

function Description(props: { kind: EventNoticeKind }) {
  return (
    <>
      <Show when={props.kind === "reminders"}>
        <Trans>For events you are going to, or maybe going to.</Trans>
      </Show>
      <Show when={props.kind === "changes"}>
        <Trans>When the time or place of an event you answered changes.</Trans>
      </Show>
      <Show when={props.kind === "invitations"}>
        <Trans>When an organiser invites you to an event.</Trans>
      </Show>
      <Show when={props.kind === "seats"}>
        <Trans>When you move up from the waiting list.</Trans>
      </Show>
    </>
  );
}

const Problem = styled("span", {
  base: { fontSize: "13px", lineHeight: "18px", color: "var(--z-danger)" },
});
