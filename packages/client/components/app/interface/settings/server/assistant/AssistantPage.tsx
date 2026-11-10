import {
  For,
  Index,
  Match,
  Show,
  Switch,
  createMemo,
  createResource,
  createSignal,
  onMount,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { CONFIGURATION } from "@revolt/common";
import {
  Button,
  FloatingSelect,
  MenuItem,
  Segmented,
  SettingsRow,
  SettingsSection,
  TextField,
  Toggle,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { ConfirmDialog } from "../ConfirmDialog";
import { Anchor, PageStack } from "../layout";
import { useSaved } from "../savedNotice";

import { FieldControl, PickMany, PickOne, serverRoles, textChannels } from "./AssistantFields";
import {
  type AssistantConfig,
  AssistantError,
  type ModuleMeta,
  type ModuleState,
  type Staff,
  alreadyAuthorized,
  assistantApi,
  connect,
  downloadJson,
  isConnected,
} from "./api";
import { tabsOf } from "./helpers";
import { useAssistantWords } from "./labels";

const LANGUAGES = [
  ["ar", "العربية"],
  ["en", "English"],
  ["de", "Deutsch"],
] as const;

const GROUPS = ["safety", "community", "support", "utilities"];

/** Server settings → Apps → Zrzur Assistant */
export function AssistantPage(props: { server: Server }) {
  const { t } = useLingui();
  const client = useClient();
  const [ready, setReady] = createSignal(isConnected());
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const canManage = () => props.server.havePermission("ManageServer");

  async function signIn() {
    setBusy(true);
    setError(undefined);
    try {
      await connect(client());
      setReady(true);
    } catch {
      setError(t`Zrzur Assistant can't be reached right now. Try again soon.`);
    } finally {
      setBusy(false);
    }
  }

  onMount(async () => {
    if (ready() || !canManage()) return;
    if (await alreadyAuthorized(client()).catch(() => false)) await signIn();
  });

  return (
    <Show
      when={canManage()}
      fallback={
        <Note role="note">
          <Trans>Only people who manage the server can change this.</Trans>
        </Note>
      }
    >
      <Show
        when={ready()}
        fallback={
          <SettingsSection>
            <SettingsRow
              icon={<Icon name="robot" size={20} />}
              title={<Trans>Connect Zrzur Assistant</Trans>}
              description={
                <Trans>
                  It learns your username, so it knows you may change these
                  settings. You can remove it under Connected apps.
                </Trans>
              }
              control={() => (
                <Button size="sm" isDisabled={busy()} onPress={signIn}>
                  <Trans>Connect</Trans>
                </Button>
              )}
            />
            <Show when={error()}>
              <ErrorText role="alert">{error()}</ErrorText>
            </Show>
          </SettingsSection>
        }
      >
        <Connected server={props.server} onExpired={() => setReady(false)} />
      </Show>
    </Show>
  );
}

function Connected(props: { server: Server; onExpired: () => void }) {
  const { t } = useLingui();
  const saved = useSaved();
  const words = useAssistantWords();
  const [meta] = createResource(() => assistantApi.meta());
  const [state, { mutate, refetch }] = createResource(
    () => props.server.id,
    assistantApi.server,
  );
  const [open, setOpen] = createSignal<string>();
  const [error, setError] = createSignal<string>();

  const config = () => state()?.config;
  const modules = createMemo(() =>
    (meta()?.modules ?? []).filter((module) => module.group !== "core"),
  );
  const current = () => modules().find((module) => module.id === open());

  /** Run a change; the page shows the server's answer, or says what went wrong */
  async function apply(run: () => Promise<{ config: AssistantConfig }>) {
    setError(undefined);
    try {
      const { config } = await run();
      const before = state();
      if (before) mutate({ ...before, config });
      saved();
    } catch (err) {
      if (err instanceof AssistantError && err.status === 401) props.onExpired();
      else setError(t`That change wasn't saved. Check it and try again.`);
    }
  }

  const changeModule = (id: string, patch: Partial<ModuleState>) =>
    apply(() => assistantApi.patchModule(props.server.id, id, patch));

  return (
    <Switch>
      <Match when={state.error}>
        <Show
          when={(state.error as AssistantError)?.status === 404}
          fallback={
            <ErrorText role="alert">
              <Trans>Zrzur Assistant can't be reached right now. Try again soon.</Trans>
            </ErrorText>
          }
        >
          <Note role="note">
            <Trans>Add Zrzur Assistant to this server first.</Trans>{" "}
            <a href={`/bot/${CONFIGURATION.ASSISTANT?.botId}`}>
              <Trans>Add it</Trans>
            </a>
          </Note>
        </Show>
      </Match>
      <Match when={config() && !current()}>
        <PageStack>
          <Show when={error()}>
            <ErrorText role="alert">{error()}</ErrorText>
          </Show>
          <Anchor
            id="assistant-health"
            title={<Trans>Overview</Trans>}
            description={<Trans>What the Assistant needs, and what happened lately.</Trans>}
          >
            <Health server={props.server} state={state()!} onRefresh={refetch} />
          </Anchor>

          <Anchor
            id="assistant-wizard"
            title={<Trans>Quick setup</Trans>}
            description={<Trans>Pick what your server is like; modules turn on to match.</Trans>}
          >
            <Grid>
              <For each={state()!.presets}>
                {(preset) => (
                  <Button
                    variant="tonal"
                    onPress={() =>
                      apply(() => assistantApi.wizard(props.server.id, preset))
                    }
                  >
                    {words.presets[preset]}
                  </Button>
                )}
              </For>
            </Grid>
          </Anchor>

          <For each={GROUPS}>
            {(group) => (
              <Anchor id={`assistant-${group}`} title={words.groups[group]}>
                <SettingsSection>
                  <For each={modules().filter((module) => module.group === group)}>
                    {(module) => (
                      <SettingsRow
                        title={words.modules[module.id]?.name ?? module.id}
                        description={words.modules[module.id]?.line}
                        control={() => (
                          <Controls>
                            <Toggle
                              checked={config()!.modules[module.id]?.enabled}
                              aria-label={words.modules[module.id]?.name}
                              onChange={(enabled) =>
                                changeModule(module.id, { enabled })
                              }
                            />
                            <Button
                              size="sm"
                              variant="tonal"
                              aria-label={t`Configure ${words.modules[module.id]?.name ?? ""}`}
                              onPress={() => setOpen(module.id)}
                            >
                              <Trans>Configure</Trans>
                            </Button>
                          </Controls>
                        )}
                      />
                    )}
                  </For>
                </SettingsSection>
              </Anchor>
            )}
          </For>

          <Anchor
            id="assistant-global"
            title={<Trans>General</Trans>}
            description={<Trans>Language, time and who counts as staff.</Trans>}
          >
            <Global
              server={props.server}
              config={config()!}
              onChange={(patch) =>
                apply(() => assistantApi.patchGlobal(props.server.id, patch))
              }
            />
          </Anchor>

          <Anchor
            id="assistant-backup"
            title={<Trans>Settings file</Trans>}
            description={<Trans>Save these settings as a file, or load them back.</Trans>}
          >
            <Backup
              server={props.server}
              onImport={(data) =>
                apply(() => assistantApi.importConfig(props.server.id, data))
              }
            />
            <Log>
              <For each={state()!.overview.changes}>
                {(change) => (
                  <li>
                    <time>{new Date(change.at).toLocaleString()}</time>{" "}
                    <bdi>{change.what}</bdi>
                  </li>
                )}
              </For>
            </Log>
          </Anchor>
        </PageStack>
      </Match>
      <Match when={config() && current()}>
        {(module) => (
          <ModulePage
            server={props.server}
            module={module()}
            state={config()!.modules[module().id]}
            error={error()}
            onBack={() => setOpen(undefined)}
            onChange={(patch) => changeModule(module().id, patch)}
          />
        )}
      </Match>
    </Switch>
  );
}

function Health(props: {
  server: Server;
  state: { health: { missing: string[]; rolesAbove: string[] } | null; overview: { cases: { number: number; action: string; target: string; at: number }[]; tickets: { number: number; user: string; state: string; opened: number }[] } };
  onRefresh: () => void;
}) {
  const words = useAssistantWords();
  const missing = () => props.state.health?.missing ?? [];
  const above = () => props.state.health?.rolesAbove ?? [];
  const active = () =>
    Object.keys(words.modules).filter(
      (id) => (props.state as unknown as { config: AssistantConfig }).config.modules[id]?.enabled,
    );
  const client = useClient();
  const userName = (id: string) => client().users.get(id)?.username ?? id;

  return (
    <SettingsSection>
      <SettingsRow
        icon={<Icon name={missing().length ? "warning-circle" : "check-circle"} size={20} />}
        title={
          missing().length ? (
            <Trans>Some permissions are missing</Trans>
          ) : (
            <Trans>All permissions are in place</Trans>
          )
        }
        description={missing().length ? <bdi>{missing().join(", ")}</bdi> : undefined}
        control={() => (
          <Button size="sm" variant="tonal" onPress={props.onRefresh}>
            <Trans>Check again</Trans>
          </Button>
        )}
      />
      <Show when={above().length}>
        <SettingsRow
          icon={<Icon name="warning-circle" size={20} />}
          title={<Trans>These roles are above the Assistant</Trans>}
          description={<bdi>{above().join(", ")}</bdi>}
        />
      </Show>
      <SettingsRow
        title={<Trans>Active modules</Trans>}
        description={active().map((id) => words.modules[id].name).join("، ") || undefined}
      />
      <SettingsRow
        title={<Trans>Recent cases</Trans>}
        description={
          props.state.overview.cases
            .map((row) => `#${row.number} ${words.cases[row.action] ?? row.action} · ${userName(row.target)}`)
            .join("، ") || undefined
        }
      />
      <SettingsRow
        title={<Trans>Recent tickets</Trans>}
        description={
          props.state.overview.tickets
            .map((row) => `#${row.number} · ${userName(row.user)}`)
            .join("، ") || undefined
        }
      />
    </SettingsSection>
  );
}

function Global(props: {
  server: Server;
  config: AssistantConfig;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const { t } = useLingui();
  const words = useAssistantWords();
  const staff = () => props.config.global.staff;
  return (
    <Fields>
      <FloatingSelect
        label={t`Language of the bot's messages`}
        value={props.config.global.language}
        onChange={(e) => props.onChange({ language: e.currentTarget.value })}
      >
        <For each={LANGUAGES}>
          {([id, name]) => <MenuItem value={id}>{name}</MenuItem>}
        </For>
      </FloatingSelect>
      <TextField
        label={t`Time zone`}
        dir="ltr"
        value={props.config.global.timezone}
        onChange={(e) => props.onChange({ timezone: e.currentTarget.value })}
      />
      <SettingsRow
        title={<Trans>Use the Hijri calendar</Trans>}
        control={() => (
          <Toggle
            checked={props.config.global.hijri}
            aria-label={t`Use the Hijri calendar`}
            onChange={(hijri) => props.onChange({ hijri })}
          />
        )}
      />
      <For each={Object.keys(words.tiers) as (keyof Staff)[]}>
        {(tier) => (
          <PickMany
            label={words.tiers[tier]}
            value={staff()[tier]}
            choices={serverRoles(props.server)}
            onChange={(value) => props.onChange({ staff: { [tier]: value } })}
          />
        )}
      </For>
    </Fields>
  );
}

function Backup(props: { server: Server; onImport: (data: unknown) => void }) {
  const { t } = useLingui();
  let input!: HTMLInputElement;
  const [problem, setProblem] = createSignal<string>();
  return (
    <Fields>
      <Grid>
        <Button
          variant="tonal"
          onPress={async () =>
            downloadJson(
              "zrzur-assistant-settings.json",
              await assistantApi.exportConfig(props.server.id),
            )
          }
        >
          <Trans>Save settings file</Trans>
        </Button>
        <Button variant="tonal" onPress={() => input.click()}>
          <Trans>Load settings file</Trans>
        </Button>
      </Grid>
      <input
        ref={input}
        type="file"
        accept="application/json"
        hidden
        aria-label={t`Load settings file`}
        onChange={async (e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (!file) return;
          try {
            setProblem(undefined);
            props.onImport(JSON.parse(await file.text()));
          } catch {
            setProblem(t`That file can't be read.`);
          }
        }}
      />
      <Show when={problem()}>
        <ErrorText role="alert">{problem()}</ErrorText>
      </Show>
    </Fields>
  );
}

function ModulePage(props: {
  server: Server;
  module: ModuleMeta;
  state: ModuleState;
  error?: string;
  onBack: () => void;
  onChange: (patch: Partial<ModuleState>) => void;
}) {
  const { t } = useLingui();
  const words = useAssistantWords();
  const [tab, setTab] = createSignal<string>("settings");
  const name = () => words.modules[props.module.id]?.name ?? props.module.id;

  return (
    <PageStack>
      <Head>
        <Button size="sm" variant="tonal" onPress={props.onBack}>
          <Trans>Back</Trans>
        </Button>
        <h2>{name()}</h2>
        <Toggle
          checked={props.state.enabled}
          aria-label={name()}
          onChange={(enabled) => props.onChange({ enabled })}
        />
      </Head>
      <Note>{words.modules[props.module.id]?.line}</Note>
      <Show when={props.error}>
        <ErrorText role="alert">{props.error}</ErrorText>
      </Show>
      <TabRow>
        <Segmented
          aria-label={t`Module sections`}
          value={tab()}
          onChange={setTab}
          options={tabsOf(props.module).map((value) => ({
            value,
            label: words.tabs[value as keyof typeof words.tabs],
          }))}
        />
      </TabRow>
      <Fields>
        <Switch>
          <Match when={tab() === "settings"}>
            <Show
              when={props.module.fields.length}
              fallback={
                <Note>
                  <Trans>This module has no settings. Use its slash commands.</Trans>
                </Note>
              }
            >
              <Index each={props.module.fields}>
                {(field) => (
                  <FieldControl
                    module={props.module.id}
                    field={field()}
                    value={props.state.settings[field().key]}
                    server={props.server}
                    onChange={(value) =>
                      props.onChange({ settings: { [field().key]: value } })
                    }
                  />
                )}
              </Index>
            </Show>
          </Match>
          <Match when={tab() === "messages"}>
            <Note>
              <Trans>Leave a box empty to use the standard text.</Trans>
            </Note>
            <For each={props.module.messages}>
              {(message) => (
                <Fields>
                  <SubTitle>{words.messages[message.key] ?? message.key}</SubTitle>
                  <For each={LANGUAGES}>
                    {([lang, language]) => (
                      <TextField
                        label={language}
                        rows={3}
                        lang={lang}
                        dir={lang === "ar" ? "rtl" : "ltr"}
                        placeholder={message.defaults?.[lang]}
                        value={props.state.messages[message.key]?.[lang] ?? ""}
                        onChange={(e) =>
                          props.onChange({
                            messages: {
                              [message.key]: {
                                ...props.state.messages[message.key],
                                [lang]: e.currentTarget.value,
                              },
                            },
                          })
                        }
                      />
                    )}
                  </For>
                </Fields>
              )}
            </For>
          </Match>
          <Match when={tab() === "permissions"}>
            <Note>
              <Trans>Empty lists follow the staff levels and work everywhere.</Trans>
            </Note>
            <PickMany
              label={t`Roles that may use this module`}
              value={props.state.allowRoles}
              choices={serverRoles(props.server)}
              onChange={(allowRoles) => props.onChange({ allowRoles })}
            />
            <PickMany
              label={t`Channels where its commands work`}
              value={props.state.allowChannels}
              choices={textChannels(props.server)}
              onChange={(allowChannels) => props.onChange({ allowChannels })}
            />
          </Match>
          <Match when={tab() === "log"}>
            <PickOne
              label={t`Log channel`}
              value={props.state.logChannel}
              choices={textChannels(props.server)}
              onChange={(logChannel) => props.onChange({ logChannel })}
            />
          </Match>
          <Match when={tab() === "data"}>
            <DataTab
              server={props.server}
              module={props.module}
              state={props.state}
            />
          </Match>
        </Switch>
      </Fields>
    </PageStack>
  );
}

function DataTab(props: { server: Server; module: ModuleMeta; state: ModuleState }) {
  const saved = useSaved();
  const [asking, setAsking] = createSignal(false);
  const purgeDate = () =>
    props.state.disabledAt
      ? new Date(props.state.disabledAt + 30 * 86400000).toLocaleDateString()
      : undefined;
  return (
    <>
      <Note>
        <Trans>
          Data of a module that stays off is deleted after 30 days. The server
          owner gets a copy first. No IP addresses are ever kept.
        </Trans>
      </Note>
      <Show when={purgeDate()}>
        {(date) => (
          <Note role="status">
            <Trans>This module's data will be deleted on {date()}.</Trans>
          </Note>
        )}
      </Show>
      <Grid>
        <Button
          variant="tonal"
          onPress={async () =>
            downloadJson(
              `zrzur-assistant-${props.module.id}.json`,
              await assistantApi.exportModule(props.server.id, props.module.id),
            )
          }
        >
          <Trans>Export data</Trans>
        </Button>
        <Button variant="_error" onPress={() => setAsking(true)}>
          <Trans>Delete data now</Trans>
        </Button>
      </Grid>
      <Show when={asking()}>
        <ConfirmDialog
          title={<Trans>Delete this module's data?</Trans>}
          confirm={<Trans>Delete data</Trans>}
          onClose={() => setAsking(false)}
          onConfirm={async () => {
            await assistantApi.purgeModule(props.server.id, props.module.id);
            saved();
          }}
        >
          <Trans>This can't be undone.</Trans>
        </ConfirmDialog>
      </Show>
    </>
  );
}

const Fields = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 },
});

const Grid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "8px",
  },
});

const Controls = styled("div", {
  base: { display: "flex", alignItems: "center", gap: "12px" },
});

const Head = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    "& h2": { flex: 1, margin: 0, fontSize: "18px", fontWeight: 600, minWidth: 0 },
  },
});

const TabRow = styled("div", {
  base: { overflowX: "auto", maxWidth: "100%", paddingBlockEnd: "4px" },
});

const SubTitle = styled("h4", {
  base: { margin: 0, fontSize: "15px", fontWeight: 600 },
});

const Note = styled("p", {
  base: { margin: 0, fontSize: "13px", color: "var(--z-fg-muted)" },
});

const ErrorText = styled("p", {
  base: { margin: 0, fontSize: "13px", color: "var(--z-danger)" },
});

const Log = styled("ul", {
  base: {
    margin: 0,
    paddingInlineStart: "16px",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
    overflowWrap: "anywhere",
  },
});
