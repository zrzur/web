import {
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createResource,
  createSignal,
  onMount,
} from "solid-js";

import { i18n } from "@lingui/core";
import { Plural, Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import {
  type InstallView,
  type PluginDetails,
  pluginApi,
} from "@revolt/plugins/api";
import { compatibility, crashLog } from "@revolt/plugins/host";
import {
  hostHooks,
  pluginHost,
  plugins,
  safeMode,
  setOpenPanel,
} from "@revolt/plugins/registry";
import {
  Button,
  FloatingSelect,
  MenuItem,
  SettingsRow,
  SettingsSection,
  SettingsStatus,
  TextField,
  Toggle,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  type SettingDefinition,
  localise,
} from "../../../../../../../plugin-sdk/src/manifest.ts";

import {
  Card,
  ErrorText,
  Muted,
  PermissionList,
  PluginIcon,
  Row,
  Stack,
  StateChip,
  Title,
} from "./common";
import { usePluginText } from "./text";

/**
 * One plugin: what it is, what it asks for, and every action on it
 */
export function PluginDetail(props: {
  id: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const { t } = useLingui();
  const describeError = useError();
  const client = useClient();
  const text = usePluginText();
  const locale = () => i18n.locale || "en";
  const [details, { refetch }] = createResource(
    () => props.id,
    (id) => pluginApi.details(client(), id),
  );
  const [busy, setBusy] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [consent, setConsent] = createSignal<"install" | "update" | null>(null);
  const [confirmUninstall, setConfirmUninstall] = createSignal(false);
  let consentText: HTMLParagraphElement | undefined;
  /** Install sits at the top; consent happens next to the permissions */
  function askToInstall() {
    setConsent("install");
    queueMicrotask(() => {
      const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
      consentText?.scrollIntoView({
        block: "center",
        behavior: still ? "auto" : "smooth",
      });
      consentText?.focus({ preventScroll: true });
    });
  }
  const [reporting, setReporting] = createSignal(false);
  const [reportReason, setReportReason] = createSignal("");
  const [reported, setReported] = createSignal(false);
  const [tick, setTick] = createSignal(0);

  const view = createMemo((): InstallView | undefined => {
    tick();
    return pluginHost()?.views.find((v) => v.plugin._id === props.id);
  });
  const active = () => plugins[props.id];
  const release = () => view()?.release ?? details()?.release;
  const manifest = () => release()?.manifest;
  const compat = () =>
    manifest() ? compatibility(manifest()!) : { ok: true as const };
  const name = () => {
    const m = manifest();
    if (!m) return details()?.plugin.name ?? props.id;
    return localise(
      m.locales?.[locale().split("-")[0]]?.name ?? m.name,
      locale(),
    );
  };
  const description = () => {
    const m = manifest();
    if (!m) return details()?.plugin.summary ?? "";
    return m.locales?.[locale().split("-")[0]]?.description ?? m.description;
  };

  async function act(label: string, fn: () => Promise<InstallView | void>) {
    setBusy(label);
    setError(null);
    try {
      const result = await fn();
      if (result) await pluginHost()?.apply(result);
      setTick((n) => n + 1);
      props.onChanged();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  }

  const install = () =>
    act("install", async () => {
      const r = details()!.release!;
      const result = await pluginApi.install(
        client(),
        props.id,
        r._id,
        r.permissions,
      );
      setConsent(null);
      return result;
    });

  const update = () =>
    act("update", async () => {
      const next = view()!.update!;
      const result = await pluginApi.install(
        client(),
        props.id,
        next.release_id,
        next.permissions,
      );
      setConsent(null);
      return result;
    });

  const setEnabled = (enabled: boolean) =>
    act("enabled", () => pluginApi.setEnabled(client(), props.id, enabled));

  const uninstall = () =>
    act("uninstall", async () => {
      await pluginApi.uninstall(client(), props.id);
      await pluginHost()?.forget(props.id);
      setConfirmUninstall(false);
      // nothing left to manage here: back to the list
      props.onBack();
    });

  const report = () =>
    act("report", async () => {
      await pluginApi.report(client(), props.id, reportReason().trim());
      setReporting(false);
      setReported(true);
    });

  const reviewedAt = () => {
    const at = release()?.reviewed_at;
    return at ? new Date(at).toLocaleDateString(locale()) : "";
  };

  // open at the top, not at the place the store list was scrolled to
  let top: HTMLDivElement | undefined;
  onMount(() => {
    for (let el = top?.parentElement; el; el = el.parentElement) {
      if (
        el.scrollHeight > el.clientHeight &&
        /auto|scroll/.test(getComputedStyle(el).overflowY)
      ) {
        el.scrollTop = 0;
        break;
      }
    }
  });

  return (
    <>
      <Row ref={top}>
        <Button size="sm" variant="text" onPress={props.onBack}>
          <Icon name="arrow-left" size={18} /> <Trans>Plugins</Trans>
        </Button>
      </Row>
      <Switch>
        <Match when={details.loading && !view()}>
          <SettingsRow
            icon={<Icon name="hourglass" size={20} />}
            title={<Trans>Loading…</Trans>}
          />
        </Match>
        <Match when={details.error && !view()}>
          <SettingsRow
            danger
            icon={<Icon name="warning-circle" size={20} />}
            title={<Trans>This plugin isn't available</Trans>}
          />
        </Match>
        <Match when={manifest()}>
          <Card>
            <Row>
              <PluginIcon
                icon={manifest()!.icon}
                category={manifest()!.category}
                size={26}
              />
              <Stack>
                <Title>{name()}</Title>
                <Muted>
                  {details()?.plugin.official
                    ? "Zrzur"
                    : (details()?.publisher?.display_name ??
                      details()?.publisher?.username ??
                      manifest()!.author.name)}
                  <Show when={details()?.publisher?.verified}>
                    {" · "}
                    <Trans>Verified publisher</Trans>
                  </Show>
                  {" · "}v{manifest()!.version} ·{" "}
                  {text.category(manifest()!.category)}
                </Muted>
              </Stack>
              <Show when={details()?.plugin.official}>
                <SettingsStatus tone="success">
                  <Trans>Official</Trans>
                </SettingsStatus>
              </Show>
              <Show when={view()}>
                <StateChip
                  view={view()}
                  active={active()}
                  updating={busy() === "update"}
                />
              </Show>
            </Row>
            <p style={{ margin: 0, "line-height": "1.5" }}>{description()}</p>
            <Muted>
              <Show
                when={release()?.status === "Approved"}
                fallback={<Trans>Review status: {release()?.status}</Trans>}
              >
                <Trans>Reviewed and approved by Zrzur on {reviewedAt()}.</Trans>
              </Show>{" "}
              <Show when={details()}>
                <Plural
                  value={details()!.plugin.install_count}
                  one="# install."
                  other="# installs."
                />
              </Show>
            </Muted>
            <Show when={!compat().ok}>
              <ErrorText>
                {text.reason((compat() as { reason: string }).reason)}
              </ErrorText>
            </Show>
            <Show when={release()?.entrypoint === "worker"}>
              <Muted>
                <Trans>
                  Runs code in an isolated sandbox with no network, no access to
                  the page and limited time and messages.
                </Trans>
              </Muted>
            </Show>
            <Show
              when={!view() && details()?.release && consent() !== "install"}
            >
              <Row>
                <Button
                  variant="filled"
                  isDisabled={!compat().ok || !!busy()}
                  onPress={askToInstall}
                >
                  <Trans>Install</Trans>
                </Button>
              </Row>
            </Show>
          </Card>

          <Show when={error()}>
            <ErrorText role="alert">{error()}</ErrorText>
          </Show>

          {/* not installed */}
          <Show when={!view() && details()?.release}>
            <SettingsSection title={<Trans>Permissions it asks for</Trans>}>
              <Card>
                <PermissionList permissions={details()!.release!.permissions} />
                <Show when={consent() === "install"}>
                  <Muted ref={consentText} tabIndex={-1}>
                    <Trans>
                      Allow {name()} to do the things listed above? You can turn
                      it off or uninstall it at any time.
                    </Trans>
                  </Muted>
                  <Row>
                    <Button
                      variant="filled"
                      isDisabled={!!busy()}
                      onPress={() => void install()}
                    >
                      <Trans>Allow and install</Trans>
                    </Button>
                    <Button
                      variant="tonal"
                      onPress={() => void setConsent(null)}
                    >
                      <Trans>Cancel</Trans>
                    </Button>
                  </Row>
                </Show>
              </Card>
            </SettingsSection>
          </Show>

          {/* installed */}
          <Show when={view()}>
            <SettingsSection title={<Trans>Status</Trans>}>
              <SettingsRow
                icon={<Icon name="power" size={20} />}
                title={<Trans>Enabled</Trans>}
                description={
                  pluginHost()?.blockedReason(view()!) ? (
                    text.reason(
                      active()?.error ?? pluginHost()?.blockedReason(view()!),
                    )
                  ) : (
                    <Trans>Running now.</Trans>
                  )
                }
                control={(ids) => (
                  <Toggle
                    checked={view()!.enabled}
                    aria-labelledby={ids.labelId}
                    disabled={
                      !!busy() ||
                      (!view()!.enabled &&
                        !!view()!.blocked &&
                        view()!.blocked !== "third_party_code")
                    }
                    onChange={(on) => void setEnabled(on)}
                  />
                )}
              />
              <Show
                when={
                  active()?.status === "quarantined" ||
                  active()?.status === "failed"
                }
              >
                <SettingsRow
                  icon={<Icon name="arrow-clockwise" size={20} />}
                  title={<Trans>Try again</Trans>}
                  description={
                    <Trans>Clears its error history and starts it again.</Trans>
                  }
                  control={() => (
                    <Button
                      size="sm"
                      variant="tonal"
                      onPress={() =>
                        void pluginHost()
                          ?.retry(props.id)
                          .then(() => setTick((n) => n + 1))
                      }
                    >
                      <Trans>Retry</Trans>
                    </Button>
                  )}
                />
              </Show>
              <Show when={safeMode()}>
                <SettingsRow
                  icon={<Icon name="shield" size={20} />}
                  title={<Trans>Safe Mode is on</Trans>}
                  description={
                    <Trans>No plugin runs until you turn Safe Mode off.</Trans>
                  }
                />
              </Show>
            </SettingsSection>

            <Show when={view()!.update}>
              <SettingsSection
                title={
                  view()!.update!.fallback ? (
                    <Trans>Switch to a safe version</Trans>
                  ) : (
                    <Trans>Update available</Trans>
                  )
                }
              >
                <Card>
                  <strong>v{view()!.update!.version}</strong>
                  <Show when={view()!.update!.changelog}>
                    <Muted>{view()!.update!.changelog}</Muted>
                  </Show>
                  <Show when={view()!.update!.new_permissions.length}>
                    <Muted>
                      <Trans>This version asks for new permissions:</Trans>
                    </Muted>
                    <PermissionList
                      permissions={view()!.update!.permissions}
                      highlight={view()!.update!.new_permissions}
                    />
                  </Show>
                  <Show
                    when={
                      consent() === "update" ||
                      !view()!.update!.new_permissions.length
                    }
                    fallback={
                      <Row>
                        <Button
                          variant="filled"
                          onPress={() => void setConsent("update")}
                        >
                          <Trans>Review and update</Trans>
                        </Button>
                      </Row>
                    }
                  >
                    <Row>
                      <Button
                        variant="filled"
                        isDisabled={!!busy()}
                        onPress={() => void update()}
                      >
                        {view()!.update!.new_permissions.length ? (
                          <Trans>Allow and update</Trans>
                        ) : (
                          <Trans>Update</Trans>
                        )}
                      </Button>
                    </Row>
                  </Show>
                </Card>
              </SettingsSection>
            </Show>

            <Show when={active()?.status === "running"}>
              <Contributions id={props.id} />
            </Show>

            <Show when={(manifest()!.contributes?.settings?.length ?? 0) > 0}>
              <SettingsSection title={<Trans>Plugin settings</Trans>}>
                <For each={manifest()!.contributes!.settings!}>
                  {(setting) => (
                    <SettingField id={props.id} setting={setting} />
                  )}
                </For>
              </SettingsSection>
            </Show>

            <SettingsSection title={<Trans>Permissions you granted</Trans>}>
              <Card>
                <PermissionList permissions={view()!.granted} />
              </Card>
            </SettingsSection>

            <Show when={crashLog(props.id).length}>
              <SettingsSection
                title={<Trans>Recent problems</Trans>}
                description={
                  <Trans>
                    Kept on this device only. No messages or personal data are
                    recorded.
                  </Trans>
                }
              >
                <For each={crashLog(props.id).slice(-5).reverse()}>
                  {(entry) => (
                    <SettingsRow
                      icon={<Icon name="warning" size={20} />}
                      title={text.reason(entry.reason)}
                      description={`v${entry.version} · ${new Date(entry.at).toLocaleString(locale())}`}
                    />
                  )}
                </For>
              </SettingsSection>
            </Show>

            <SettingsSection title={<Trans>Remove</Trans>}>
              <SettingsRow
                danger
                icon={<Icon name="trash" size={20} />}
                title={<Trans>Uninstall</Trans>}
                description={
                  <Trans>Removes it, its permissions and its settings.</Trans>
                }
                control={() => (
                  <Show
                    when={confirmUninstall()}
                    fallback={
                      <Button
                        size="sm"
                        variant="tonal"
                        onPress={() => setConfirmUninstall(true)}
                      >
                        <Trans>Uninstall</Trans>
                      </Button>
                    }
                  >
                    <Row>
                      <Button
                        size="sm"
                        variant="_error"
                        isDisabled={!!busy()}
                        onPress={() => void uninstall()}
                      >
                        <Trans>Yes, uninstall</Trans>
                      </Button>
                      <Button
                        size="sm"
                        variant="tonal"
                        onPress={() => setConfirmUninstall(false)}
                      >
                        <Trans>Cancel</Trans>
                      </Button>
                    </Row>
                  </Show>
                )}
              />
            </SettingsSection>
          </Show>

          <Show when={details()?.versions.length}>
            <SettingsSection title={<Trans>Versions</Trans>}>
              <For each={details()!.versions}>
                {(v) => (
                  <SettingsRow
                    icon={
                      <Icon
                        name={
                          v.status === "Revoked" ? "prohibit" : "seal-check"
                        }
                        size={20}
                      />
                    }
                    title={`v${v.version}`}
                    description={v.changelog ?? t`No changelog.`}
                    secondary={
                      <Show when={v.status === "Revoked"}>
                        <SettingsStatus tone="warning">
                          <Trans>Revoked</Trans>
                        </SettingsStatus>
                      </Show>
                    }
                  />
                )}
              </For>
            </SettingsSection>
          </Show>

          <Show when={details() && !details()!.can_manage}>
            <SettingsSection title={<Trans>Report</Trans>}>
              <Show
                when={!reported()}
                fallback={
                  <SettingsRow
                    icon={<Icon name="check-circle" size={20} />}
                    title={<Trans>Thanks, Zrzur will look at it.</Trans>}
                  />
                }
              >
                <Show
                  when={reporting()}
                  fallback={
                    <SettingsRow
                      icon={<Icon name="flag" size={20} />}
                      title={<Trans>Report this plugin</Trans>}
                      description={
                        <Trans>
                          Tell Zrzur if it misbehaves, misleads or looks unsafe.
                        </Trans>
                      }
                      navigational
                      onClick={() => setReporting(true)}
                    />
                  }
                >
                  <Card>
                    <TextField
                      label={t`What's wrong?`}
                      value={reportReason()}
                      maxlength={1000}
                      onInput={(e) => setReportReason(e.currentTarget.value)}
                    />
                    <Row>
                      <Button
                        variant="filled"
                        isDisabled={!reportReason().trim() || !!busy()}
                        onPress={() => void report()}
                      >
                        <Trans>Send report</Trans>
                      </Button>
                      <Button
                        variant="tonal"
                        onPress={() => setReporting(false)}
                      >
                        <Trans>Cancel</Trans>
                      </Button>
                    </Row>
                  </Card>
                </Show>
              </Show>
            </SettingsSection>
          </Show>
          <Show when={details()?.can_review}>
            <ReviewerActions
              details={details()!}
              onChanged={() => void refetch()}
            />
          </Show>
          <Show when={details()?.can_manage || details()?.can_review}>
            <ReviewLog id={props.id} onChanged={() => void refetch()} />
          </Show>
        </Match>
      </Switch>
    </>
  );
}

/** Commands, panels and toggles of a running plugin */
function Contributions(props: { id: string }) {
  const locale = () => i18n.locale || "en";
  const plugin = () => plugins[props.id];
  const contributes = () => plugin()?.manifest.contributes;
  const commands = () =>
    (contributes()?.commands ?? []).filter(
      (c) =>
        c.action.type !== "worker" ||
        plugin()?.workerCommands.includes(c.action.handler),
    );
  return (
    <SettingsSection title={<Trans>What it adds</Trans>}>
      <Show when={contributes()?.theme}>
        <SettingsRow
          icon={<Icon name="palette" size={20} />}
          title={<Trans>Theme colours</Trans>}
          control={(ids) => (
            <Toggle
              checked={plugin()!.themeOn}
              aria-labelledby={ids.labelId}
              onChange={() =>
                pluginHost()?.toggleContribution(props.id, "theme")
              }
            />
          )}
        />
      </Show>
      <Show when={contributes()?.accessibility}>
        <SettingsRow
          icon={<Icon name="person-arms-spread" size={20} />}
          title={<Trans>Reading and motion changes</Trans>}
          control={(ids) => (
            <Toggle
              checked={plugin()!.accessibilityOn}
              aria-labelledby={ids.labelId}
              onChange={() =>
                pluginHost()?.toggleContribution(props.id, "accessibility")
              }
            />
          )}
        />
      </Show>
      <Show when={contributes()?.notifications}>
        <SettingsRow
          icon={<Icon name="bell" size={20} />}
          title={<Trans>Changes how notifications are shown</Trans>}
          description={<Trans>Applied whenever this plugin runs.</Trans>}
        />
      </Show>
      <For each={commands()}>
        {(command) => (
          <SettingsRow
            icon={<Icon name="lightning" size={20} />}
            title={localise(command.title, locale())}
            description={
              contributes()?.keybinds?.find((k) => k.command === command.id)
                ?.keys ?? undefined
            }
            control={() => (
              <Button
                size="sm"
                variant="tonal"
                onPress={() => hostHooks.runCommand(props.id, command.id)}
              >
                <Trans>Run</Trans>
              </Button>
            )}
          />
        )}
      </For>
      <For each={contributes()?.panels ?? []}>
        {(panel) => (
          <SettingsRow
            icon={<Icon name="squares-four" size={20} />}
            title={localise(panel.title, locale())}
            control={() => (
              <Button
                size="sm"
                variant="tonal"
                onPress={() =>
                  setOpenPanel({
                    pluginId: props.id,
                    kind: "static",
                    panelId: panel.id,
                  })
                }
              >
                <Trans>Open</Trans>
              </Button>
            )}
          />
        )}
      </For>
    </SettingsSection>
  );
}

/** One manifest-declared setting, saved through the host */
function SettingField(props: { id: string; setting: SettingDefinition }) {
  const describeError = useError();
  const locale = () => i18n.locale || "en";
  const [error, setError] = createSignal<string | null>(null);
  const value = () =>
    plugins[props.id]?.settings[props.setting.key] ?? props.setting.default;
  const save = async (next: unknown) => {
    setError(null);
    try {
      await pluginHost()?.setSetting(props.id, props.setting.key, next);
    } catch (e) {
      setError(describeError(e));
    }
  };
  const title = () => localise(props.setting.title, locale());
  const description = () =>
    error() ??
    (props.setting.description
      ? localise(props.setting.description, locale())
      : undefined);
  return (
    <SettingsRow
      icon={<Icon name="sliders-horizontal" size={20} />}
      title={title()}
      description={description()}
      danger={!!error()}
      control={(ids) => (
        <Switch>
          <Match when={props.setting.type === "boolean"}>
            <Toggle
              checked={value() === true}
              aria-labelledby={ids.labelId}
              onChange={(on) => void save(on)}
            />
          </Match>
          <Match when={props.setting.type === "select"}>
            <FloatingSelect
              aria-labelledby={ids.labelId}
              value={String(value())}
              onChange={(e) => void save(e.currentTarget.value)}
            >
              <For
                each={
                  (
                    props.setting as Extract<
                      SettingDefinition,
                      { type: "select" }
                    >
                  ).options
                }
              >
                {(option) => (
                  <MenuItem value={option.value}>
                    {localise(option.label, locale())}
                  </MenuItem>
                )}
              </For>
            </FloatingSelect>
          </Match>
          <Match when={props.setting.type === "color"}>
            <input
              type="color"
              aria-labelledby={ids.labelId}
              value={String(value())}
              onChange={(e) => void save(e.currentTarget.value)}
            />
          </Match>
          <Match when={props.setting.type === "time"}>
            <input
              type="time"
              aria-labelledby={ids.labelId}
              value={String(value())}
              onChange={(e) => void save(e.currentTarget.value)}
            />
          </Match>
          <Match when={props.setting.type === "number"}>
            <input
              type="number"
              aria-labelledby={ids.labelId}
              min={
                (
                  props.setting as Extract<
                    SettingDefinition,
                    { type: "number" }
                  >
                ).min
              }
              max={
                (
                  props.setting as Extract<
                    SettingDefinition,
                    { type: "number" }
                  >
                ).max
              }
              step={
                (
                  props.setting as Extract<
                    SettingDefinition,
                    { type: "number" }
                  >
                ).step ?? "any"
              }
              value={String(value())}
              onChange={(e) => void save(Number(e.currentTarget.value))}
            />
          </Match>
          <Match when={props.setting.type === "text"}>
            <input
              type="text"
              aria-labelledby={ids.labelId}
              maxLength={
                (props.setting as Extract<SettingDefinition, { type: "text" }>)
                  .max_length ?? 200
              }
              value={String(value())}
              onChange={(e) => void save(e.currentTarget.value)}
            />
          </Match>
        </Switch>
      )}
    />
  );
}

/** Review and security history (publisher and reviewers) */
function ReviewLog(props: { id: string; onChanged: () => void }) {
  const client = useClient();
  const locale = () => i18n.locale || "en";
  const [log] = createResource(
    () => props.id,
    (id) => pluginApi.log(client(), id),
  );
  return (
    <SettingsSection title={<Trans>Review history</Trans>}>
      <For each={log() ?? []}>
        {(entry) => (
          <SettingsRow
            icon={<Icon name="clock-counter-clockwise" size={20} />}
            title={entry.action}
            description={`${new Date(entry.created_at).toLocaleString(locale())}${entry.reason ? ` · ${entry.reason}` : ""}`}
          />
        )}
      </For>
    </SettingsSection>
  );
}

/** Revoke a version, suspend or reinstate (reviewers) */
function ReviewerActions(props: {
  details: PluginDetails;
  onChanged: () => void;
}) {
  const { t } = useLingui();
  const describeError = useError();
  const client = useClient();
  const [reason, setReason] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      setReason("");
      props.onChanged();
    } catch (e) {
      setError(describeError(e));
    }
  };
  const id = () => props.details.plugin._id;
  return (
    <SettingsSection title={<Trans>Reviewer actions</Trans>}>
      <Card>
        <TextField
          label={t`Reason (required)`}
          value={reason()}
          maxlength={1000}
          onInput={(e) => setReason(e.currentTarget.value)}
        />
        <Row>
          <Show
            when={props.details.plugin.status === "Suspended"}
            fallback={
              <Button
                size="sm"
                variant="_error"
                isDisabled={!reason().trim()}
                onPress={() =>
                  void run(() =>
                    pluginApi.suspend(client(), id(), reason().trim()),
                  )
                }
              >
                <Trans>Suspend plugin</Trans>
              </Button>
            }
          >
            <Button
              size="sm"
              variant="tonal"
              onPress={() =>
                void run(() => pluginApi.reinstate(client(), id()))
              }
            >
              <Trans>Reinstate plugin</Trans>
            </Button>
          </Show>
          <For
            each={props.details.versions.filter((v) => v.status === "Approved")}
          >
            {(v) => (
              <Button
                size="sm"
                variant="tonal"
                isDisabled={!reason().trim()}
                onPress={() =>
                  void run(() =>
                    pluginApi.revoke(client(), v._id, reason().trim()),
                  )
                }
              >
                <Trans>Revoke v{v.version}</Trans>
              </Button>
            )}
          </For>
          <Button
            size="sm"
            variant="tonal"
            isDisabled={!reason().trim()}
            onPress={() =>
              void run(() =>
                pluginApi.suspendPublisher(
                  client(),
                  props.details.plugin.publisher_id,
                  reason().trim(),
                ),
              )
            }
          >
            <Trans>Suspend publisher</Trans>
          </Button>
        </Row>
        <Show when={error()}>
          <ErrorText role="alert">{error()}</ErrorText>
        </Show>
      </Card>
    </SettingsSection>
  );
}
