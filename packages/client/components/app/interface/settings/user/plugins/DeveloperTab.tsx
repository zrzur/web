import { For, Show, createResource, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import {
  type PluginAccess,
  type PluginValidation,
  pluginApi,
} from "@revolt/plugins/api";
import { pluginHost } from "@revolt/plugins/registry";
import {
  Button,
  FloatingSelect,
  MenuItem,
  SettingsRow,
  SettingsSection,
  SettingsStatus,
  TextField,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  type Manifest,
  type PluginPackage,
  CATEGORIES,
  validateManifest,
} from "../../../../../../../plugin-sdk/src/manifest.ts";

import { Card, ErrorText, Muted, PermissionList, Pre, Row } from "./common";
import { usePluginText } from "./text";

/** Largest package file accepted (manifest + code, as JSON) */
const MAX_PACKAGE_BYTES = 400 * 1024;

/**
 * Developer tools: create a plugin, validate a package, preview it here,
 * and submit releases for review. Creating a plugin never makes it
 * installable; only an approved release is.
 */
export function DeveloperTab(props: {
  access: PluginAccess | null;
  onOpen: (id: string) => void;
}) {
  const { t } = useLingui();
  const client = useClient();
  const text = usePluginText();
  const [projects, { refetch }] = createResource(() =>
    pluginApi.projects(client()),
  );

  const [newId, setNewId] = createSignal("");
  const [newName, setNewName] = createSignal("");
  const [newCategory, setNewCategory] = createSignal("appearance");
  const [createFailure, setCreateFailure] = createSignal<unknown>();

  const [pkg, setPkg] = createSignal<PluginPackage | null>(null);
  const [pkgName, setPkgName] = createSignal("");
  const [changelog, setChangelog] = createSignal("");
  const [local, setLocal] = createSignal<string[] | null>(null);
  const [server, setServer] = createSignal<PluginValidation | null>(null);
  const [message, setMessage] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [failure, setFailure] = createSignal<unknown>();
  const [busy, setBusy] = createSignal(false);

  async function create() {
    setCreateFailure(undefined);
    try {
      await pluginApi.create(client(), {
        id: newId().trim(),
        name: newName().trim(),
        category: newCategory(),
      });
      setNewId("");
      setNewName("");
      await refetch();
    } catch (e) {
      setCreateFailure(e);
    }
  }

  async function load(file: File) {
    setError(null);
    setFailure(undefined);
    setMessage(null);
    setServer(null);
    setLocal(null);
    if (file.size > MAX_PACKAGE_BYTES) {
      setError(t`That file is too large for a plugin package.`);
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as PluginPackage;
      // `manifest.json` on its own is a declarative package
      const value: PluginPackage =
        parsed && typeof parsed === "object" && "manifest" in parsed
          ? parsed
          : { manifest: parsed as unknown as Manifest };
      setPkg(value);
      setPkgName(file.name);
      const result = validateManifest(value.manifest, {
        code: value.code,
        official: props.access?.official,
      });
      setLocal(
        result.ok ? [] : result.issues.map((i) => `${i.path}: ${i.message}`),
      );
      setServer(await pluginApi.validate(client(), value));
    } catch (e) {
      setPkg(null);
      if (e instanceof SyntaxError) setError(t`That file isn't valid JSON.`);
      else setFailure(e);
    }
  }

  async function submit() {
    const value = pkg();
    if (!value) return;
    setBusy(true);
    setError(null);
    setFailure(undefined);
    try {
      await pluginApi.submit(client(), value.manifest.id, {
        ...value,
        changelog: changelog().trim() || undefined,
      });
      setMessage(
        t`Submitted. A Zrzur reviewer will look at it; you'll see the result here.`,
      );
      setPkg(null);
      await refetch();
    } catch (e) {
      setFailure(e);
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    const value = pkg();
    if (!value) return;
    setError(null);
    setFailure(undefined);
    try {
      await pluginHost()?.preview(value.manifest, value.code);
      setMessage(
        t`Previewing on this device only. Find it under Installed → Local previews.`,
      );
    } catch (e) {
      const reason = e instanceof Error ? e.message : undefined;
      if (reason === "worker_preview_dev_only")
        setError(
          t`Previewing code plugins needs a development build of Zrzur.`,
        );
      else if (reason === "installed")
        setError(t`Uninstall the store version first to preview this one.`);
      else setFailure(e);
    }
  }

  const owned = (id: string) => projects()?.some((p) => p.plugin._id === id);

  return (
    <>
      <SettingsSection
        title={<Trans>Build a plugin</Trans>}
        description={
          <Trans>
            Use the Zrzur plugin SDK: `zrzur-plugin init` makes a project,
            `validate` checks it and `pack` makes the package you upload here.
            Plugins describe what they add in a manifest; only official Zrzur
            plugins can include code for now.
          </Trans>
        }
      >
        <Show
          when={props.access?.can_publish}
          fallback={
            <SettingsRow
              icon={<Icon name="prohibit" size={20} />}
              title={
                props.access?.publisher_suspended ? (
                  <Trans>Your publishing is suspended</Trans>
                ) : (
                  <Trans>This account can't publish plugins</Trans>
                )
              }
            />
          }
        >
          <Card>
            <strong>
              <Trans>New plugin</Trans>
            </strong>
            <TextField
              label={t`Plugin id (like yourname.my-plugin)`}
              value={newId()}
              maxlength={64}
              onInput={(e) => setNewId(e.currentTarget.value.toLowerCase())}
            />
            <TextField
              label={t`Name`}
              value={newName()}
              maxlength={48}
              onInput={(e) => setNewName(e.currentTarget.value)}
            />
            <label>
              <Muted>
                <Trans>Category</Trans>
              </Muted>
              <FloatingSelect
                value={newCategory()}
                onChange={(e) => setNewCategory(e.currentTarget.value)}
              >
                <For each={CATEGORIES}>
                  {(c) => <MenuItem value={c}>{text.category(c)}</MenuItem>}
                </For>
              </FloatingSelect>
            </label>
            <Show when={createFailure()}>
              <ErrorText>
                <TranslatedError error={createFailure()} />
              </ErrorText>
            </Show>
            <Row>
              <Button
                variant="filled"
                isDisabled={newId().length < 3 || newName().trim().length < 2}
                onPress={() => void create()}
              >
                <Trans>Create plugin</Trans>
              </Button>
            </Row>
          </Card>
        </Show>
      </SettingsSection>

      <SettingsSection
        title={<Trans>Package</Trans>}
        description={
          <Trans>
            Choose a `.zplugin.json` package (or a manifest) to check it,
            preview it on this device, or submit it for review.
          </Trans>
        }
      >
        <Card>
          <input
            type="file"
            accept=".json,application/json"
            aria-label={t`Choose a plugin package`}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) void load(file);
            }}
          />
          <Show when={failure()}>
            <ErrorText role="alert">
              <TranslatedError error={failure()} />
            </ErrorText>
          </Show>
          <Show when={error()}>
            <ErrorText role="alert">{error()}</ErrorText>
          </Show>
          <Show when={message()}>
            <Muted role="status">{message()}</Muted>
          </Show>
          <Show when={pkg()}>
            <strong>
              {pkg()!.manifest.name} v{pkg()!.manifest.version} ·{" "}
              <code>{pkg()!.manifest.id}</code> · {pkgName()}
            </strong>
            <Show
              when={local()?.length || server()?.issues.length}
              fallback={
                <SettingsStatus tone="success">
                  <Trans>Valid · {server()?.risk ?? ""}</Trans>
                </SettingsStatus>
              }
            >
              <ErrorText>
                {[
                  ...new Set([...(local() ?? []), ...(server()?.issues ?? [])]),
                ].join("\n")}
              </ErrorText>
            </Show>
            <Show when={server()?.scan.length}>
              <Muted>
                <Trans>Scanner notes for the reviewer:</Trans>{" "}
                {server()!
                  .scan.map((s) => `${s.message} (line ${s.line})`)
                  .join(" · ")}
              </Muted>
            </Show>
            <PermissionList
              permissions={(pkg()!.manifest.permissions ?? []) as string[]}
            />
            <TextField
              label={t`What changed (shown to users)`}
              value={changelog()}
              maxlength={2000}
              onInput={(e) => setChangelog(e.currentTarget.value)}
            />
            <Row>
              <Button
                variant="filled"
                isDisabled={
                  busy() || !server()?.ok || !owned(pkg()!.manifest.id)
                }
                onPress={() => void submit()}
              >
                <Trans>Submit for review</Trans>
              </Button>
              <Button
                variant="tonal"
                isDisabled={!!local()?.length}
                onPress={() => void preview()}
              >
                <Trans>Preview here</Trans>
              </Button>
            </Row>
            <Show when={!owned(pkg()!.manifest.id)}>
              <Muted>
                <Trans>Create a plugin with this id first.</Trans>
              </Muted>
            </Show>
          </Show>
        </Card>
      </SettingsSection>

      <SettingsSection title={<Trans>Your plugins</Trans>}>
        <Show
          when={projects()?.length}
          fallback={
            <SettingsRow
              icon={<Icon name="code" size={20} />}
              title={<Trans>You haven't created a plugin yet</Trans>}
            />
          }
        >
          <For each={projects()}>
            {(project) => (
              <Card>
                <Row>
                  <strong style={{ flex: 1 }}>
                    {project.plugin.name} · <code>{project.plugin._id}</code>
                  </strong>
                  <SettingsStatus
                    tone={
                      project.plugin.status === "Listed" ? "success" : "neutral"
                    }
                  >
                    {project.plugin.status}
                  </SettingsStatus>
                  <Button
                    size="sm"
                    variant="tonal"
                    onPress={() => props.onOpen(project.plugin._id)}
                  >
                    <Trans>Open</Trans>
                  </Button>
                </Row>
                <For each={project.releases}>
                  {(release) => (
                    <Row>
                      <span style={{ flex: 1 }}>
                        v{release.version} · {text.riskLabel(release.risk)}
                        <Show when={release.review_note}>
                          {" "}
                          · {release.review_note}
                        </Show>
                      </span>
                      <SettingsStatus
                        tone={
                          release.status === "Approved"
                            ? "success"
                            : release.status === "Rejected" ||
                                release.status === "Revoked"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {release.status}
                      </SettingsStatus>
                      <Show when={release.status === "PendingReview"}>
                        <Button
                          size="sm"
                          variant="text"
                          onPress={() =>
                            void pluginApi
                              .withdraw(client(), release._id)
                              .then(refetch)
                          }
                        >
                          <Trans>Withdraw</Trans>
                        </Button>
                      </Show>
                    </Row>
                  )}
                </For>
              </Card>
            )}
          </For>
        </Show>
      </SettingsSection>
      <Show when={pkg()}>
        <SettingsSection title={<Trans>Manifest</Trans>}>
          <Pre>{JSON.stringify(pkg()!.manifest, null, 2)}</Pre>
        </SettingsSection>
      </Show>
    </>
  );
}
