import {
  For,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
  onMount,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { STAFF_TOOLS_ENABLED } from "@revolt/common/lib/staffTools";
import { pluginApi } from "@revolt/plugins/api";
import { registerPluginTranslations } from "@revolt/plugins/i18n";
import { pluginHost, plugins, safeMode } from "@revolt/plugins/registry";
import {
  Button,
  Column,
  Segmented,
  SettingsRow,
  SettingsSection,
  Toggle,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { BrowseTab } from "./BrowseTab";
import { Muted, PluginIcon, StateChip } from "./common";
import { DeveloperTab } from "./DeveloperTab";
import { PluginDetail } from "./PluginDetail";
import { ReviewTab } from "./ReviewTab";
import { usePluginText } from "./text";

type Tab = "installed" | "browse" | "developer" | "review";

/**
 * Settings → Advanced → Plugins: everything about plugins in one place.
 */
export function PluginsPage() {
  const { t } = useLingui();
  const client = useClient();
  const text = usePluginText();
  const [tab, setTab] = createSignal<Tab>("installed");
  const [selected, setSelected] = createSignal<string | null>(null);
  const [version, setVersion] = createSignal(0);
  const [access] = createResource(() =>
    pluginApi.access(client()).catch(() => null),
  );

  onMount(() => void registerPluginTranslations());

  const views = () => {
    version();
    return pluginHost()?.views ?? [];
  };
  const refresh = async () => {
    await pluginHost()?.refresh();
    setVersion((v) => v + 1);
  };

  const tabs = () => [
    { value: "installed" as Tab, label: <Trans>Installed</Trans> },
    { value: "browse" as Tab, label: <Trans>Browse</Trans> },
    { value: "developer" as Tab, label: <Trans>Developer</Trans> },
    // the reviewers' queue, hidden with the other staff tools for now
    ...(STAFF_TOOLS_ENABLED && access()?.review
      ? [{ value: "review" as Tab, label: <Trans>Review</Trans> }]
      : []),
  ];

  return (
    <Column gap="xl">
      <Show
        when={!selected()}
        fallback={
          <PluginDetail
            id={selected()!}
            onBack={() => {
              setSelected(null);
              setVersion((v) => v + 1);
            }}
            onChanged={() => setVersion((v) => v + 1)}
          />
        }
      >
        {/* the page title already says "Plugins" */}
        <SettingsSection
          description={
            <Trans>
              Plugins add themes, shortcuts and tools to Zrzur. Every plugin is
              reviewed by Zrzur before you can install it, asks for each
              permission it needs, and runs isolated from your account: no
              plugin can see your password, session or private messages.
            </Trans>
          }
        >
          <SettingsRow
            icon={<Icon name="shield-check" size={20} />}
            title={<Trans>Run plugins</Trans>}
            description={
              safeMode() ? (
                <Trans>
                  Safe Mode is on: no plugin runs. Your plugins and their
                  settings are kept.
                </Trans>
              ) : (
                <>
                  <Trans>
                    Turn off to start Safe Mode, which stops every plugin at
                    once. You can also add this to the address:
                  </Trans>{" "}
                  <code
                    dir="ltr"
                    style={{
                      "white-space": "nowrap",
                      "unicode-bidi": "isolate",
                    }}
                  >
                    ?safe_mode
                  </code>
                </>
              )
            }
            control={(ids) => (
              <Toggle
                checked={!safeMode()}
                aria-labelledby={ids.labelId}
                aria-describedby={ids.descriptionId}
                disabled={!pluginHost()}
                onChange={(on) =>
                  void pluginHost()
                    ?.setSafeMode(!on)
                    .then(() => setVersion((v) => v + 1))
                }
              />
            )}
          />
        </SettingsSection>

        <Segmented
          aria-label={t`Plugin sections`}
          value={tab()}
          options={tabs()}
          onChange={setTab}
        />

        <Switch>
          <Match when={tab() === "installed"}>
            <SettingsSection
              title={<Trans>Installed</Trans>}
              aside={
                <Button
                  size="sm"
                  variant="tonal"
                  onPress={() => void refresh()}
                >
                  <Trans>Check for updates</Trans>
                </Button>
              }
            >
              <Show
                when={pluginHost()}
                fallback={
                  <SettingsRow
                    icon={<Icon name="hourglass" size={20} />}
                    title={<Trans>Loading plugins…</Trans>}
                  />
                }
              >
                <Show
                  when={views().length}
                  fallback={
                    <SettingsRow
                      icon={<Icon name="squares-four" size={20} />}
                      title={<Trans>No plugins yet</Trans>}
                      description={
                        <Trans>Browse reviewed plugins to add one.</Trans>
                      }
                      navigational
                      onClick={() => setTab("browse")}
                    />
                  }
                >
                  <For each={views()}>
                    {(view) => (
                      <SettingsRow
                        icon={
                          <PluginIcon
                            icon={view.plugin.icon}
                            category={view.plugin.category}
                          />
                        }
                        title={view.plugin.name}
                        description={
                          <>
                            v{view.release.version} ·{" "}
                            {text.category(view.plugin.category)}
                            <Show when={view.update}>
                              {" · "}
                              <Trans>Update available</Trans>
                            </Show>
                          </>
                        }
                        secondary={
                          <StateChip
                            view={view}
                            active={plugins[view.plugin._id]}
                          />
                        }
                        navigational
                        onClick={() => setSelected(view.plugin._id)}
                      />
                    )}
                  </For>
                </Show>
              </Show>
            </SettingsSection>
            <Show
              when={Object.values(plugins).some((p) => p.source === "preview")}
            >
              <SettingsSection title={<Trans>Local previews</Trans>}>
                <For
                  each={Object.values(plugins).filter(
                    (p) => p.source === "preview",
                  )}
                >
                  {(plugin) => (
                    <SettingsRow
                      icon={
                        <PluginIcon
                          icon={plugin.manifest.icon}
                          category={plugin.manifest.category}
                        />
                      }
                      title={plugin.manifest.name}
                      description={
                        <Trans>
                          Preview · not installed · gone after reload
                        </Trans>
                      }
                      secondary={<StateChip active={plugin} />}
                      control={() => (
                        <Button
                          size="sm"
                          variant="tonal"
                          onPress={() =>
                            void pluginHost()?.stopPreview(plugin.id)
                          }
                        >
                          <Trans>Stop</Trans>
                        </Button>
                      )}
                    />
                  )}
                </For>
              </SettingsSection>
            </Show>
          </Match>
          <Match when={tab() === "browse"}>
            <BrowseTab onOpen={setSelected} />
          </Match>
          <Match when={tab() === "developer"}>
            <DeveloperTab access={access() ?? null} onOpen={setSelected} />
          </Match>
          <Match when={tab() === "review"}>
            <ReviewTab />
          </Match>
        </Switch>
        <Muted>
          <Trans>
            Plugins can't read hidden channels, bypass server permissions, use
            bot tokens or reach your files. A crashing plugin is stopped without
            affecting chat, voice or screen sharing.
          </Trans>
        </Muted>
      </Show>
    </Column>
  );
}
