import { For, JSX, Show, createSignal, onCleanup } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";

import { i18n } from "@lingui/core";
import { useError } from "@revolt/i18n";

import {
  Button,
  Column,
  FloatingSelect,
  MenuItem,
  SettingsRow,
  SettingsSection,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSettingsNavigation } from "../Settings";
import { useSaved } from "./savedNotice";

type PauseKind = "invites" | "dms";
type PauseHours = 1 | 6 | 12 | 24;

/**
 * Temporary actions for a raid or a spam wave. Each pause ends by itself;
 * the server enforces it (safety_pause.rs).
 */
export function ServerEmergency(props: { server: Server }) {
  const { t } = useLingui();
  const describeError = useError();
  const { navigate } = useSettingsNavigation();

  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [hours, setHours] = createSignal<Record<PauseKind, PauseHours>>({
    invites: 1,
    dms: 1,
  });

  const canManage = () => props.server.havePermission("ManageServer");

  // pauses end by themselves: re-read the clock every minute
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 60_000);
  onCleanup(() => clearInterval(timer));

  const pausedUntil = (until?: Date) =>
    until && +until > now() ? until : undefined;
  const timeOf = (until: Date) =>
    new Intl.DateTimeFormat(i18n.locale, { timeStyle: "short" }).format(until);

  const saved = useSaved();

  async function pause(kind: PauseKind, value: 0 | PauseHours) {
    if (!canManage() || pending()) return;
    setPending(true);
    setError(undefined);
    try {
      await props.server.pauseSafety(
        kind === "invites" ? { invitesHours: value } : { dmsHours: value },
      );
      setNow(Date.now());
      saved();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  }

  const durations = (): [PauseHours, string][] => [
    [1, t`1 hour`],
    [6, t`6 hours`],
    [12, t`12 hours`],
    [24, t`1 day`],
  ];

  const levelName = () =>
    ({
      None: t`None`,
      Low: t`Low`,
      Medium: t`Medium`,
      High: t`High`,
    })[props.server.verificationLevel] ?? props.server.verificationLevel;

  /** One pause: while active, when it ends and End now; else duration + Pause */
  const PauseRow = (p: {
    kind: PauseKind;
    until?: Date;
    icon: JSX.Element;
    title: JSX.Element;
    /** The row's name for screen readers: both rows have a "Pause" button */
    label: string;
    off: JSX.Element;
  }) => (
    <SettingsRow
      icon={p.icon}
      title={p.title}
      description={
        <Show when={pausedUntil(p.until)} fallback={p.off}>
          {(until) => (
            <span data-paused>
              <Trans>Paused until {timeOf(until())}.</Trans>
            </span>
          )}
        </Show>
      }
      control={() => (
        <Show
          when={pausedUntil(p.until)}
          fallback={
            <span style={{ display: "flex", gap: "8px" }}>
              <FloatingSelect
                aria-label={t`Duration: ${p.label}`}
                value={String(hours()[p.kind])}
                disabled={!canManage() || pending()}
                onChange={(e) =>
                  setHours({
                    ...hours(),
                    [p.kind]: Number(e.currentTarget.value) as PauseHours,
                  })
                }
              >
                <For each={durations()}>
                  {([value, label]) => (
                    <MenuItem value={String(value)}>{label}</MenuItem>
                  )}
                </For>
              </FloatingSelect>
              <Button
                size="sm"
                variant="tonal"
                aria-label={p.label}
                isDisabled={!canManage() || pending()}
                onPress={() => void pause(p.kind, hours()[p.kind])}
              >
                <Trans>Pause</Trans>
              </Button>
            </span>
          }
        >
          <Button
            size="sm"
            variant="tonal"
            aria-label={t`End now: ${p.label}`}
            isDisabled={!canManage() || pending()}
            onPress={() => void pause(p.kind, 0)}
          >
            <Trans>End now</Trans>
          </Button>
        </Show>
      )}
    />
  );

  return (
    <Column gap="xl">
      <SettingsSection title={<Trans>Pauses</Trans>}>
        <PauseRow
          kind="invites"
          until={props.server.invitesPausedUntil}
          icon={<Icon name="link" size={20} />}
          title={<Trans>Pause invites</Trans>}
          label={t`Pause invites`}
          off={
            <Trans>
              Nobody can join with an invite, the custom link or Discover.
            </Trans>
          }
        />
        <PauseRow
          kind="dms"
          until={props.server.dmsPausedUntil}
          icon={<Icon name="chat-circle" size={20} />}
          title={<Trans>Pause direct messages</Trans>}
          label={t`Pause direct messages`}
          off={
            <Trans>Members who aren't friends can't message each other.</Trans>
          }
        />
        <Show when={error()}>
          <SettingsRow
            icon={<Icon name="warning-circle" size={20} />}
            title={<span role="alert">{error()}</span>}
          />
        </Show>
      </SettingsSection>

      <SettingsSection title={<Trans>Lasting protection</Trans>}>
        <SettingsRow
          navigational
          icon={<Icon name="seal-check" size={20} />}
          title={<Trans context="server-settings">Verification</Trans>}
          description={
            <Trans>Now: {levelName()}. Raise it during a raid.</Trans>
          }
          onClick={() => navigate("joining#verification")}
        />
        <SettingsRow
          navigational
          icon={<Icon name="funnel" size={20} />}
          title={<Trans>Filters</Trans>}
          description={
            <Trans>Block spam, links and words before they post.</Trans>
          }
          onClick={() => navigate("safety#filters")}
        />
      </SettingsSection>
    </Column>
  );
}
