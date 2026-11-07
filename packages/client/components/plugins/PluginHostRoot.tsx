import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  on,
  onCleanup,
  onMount,
} from "solid-js";

import { Portal } from "solid-js/web";

import { i18n } from "@lingui/core";
import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useNavigate, useSmartParams } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Button, IconButton, Toggle, useSnackbar } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { type PanelBlock, localise } from "../../../plugin-sdk/src/manifest.ts";

import { PluginHost } from "./host";
import { registerPluginTranslations } from "./i18n";
import {
  type DynamicBlock,
  hostHooks,
  openPanel,
  pluginHost,
  plugins,
  setOpenPanel,
  setPluginHost,
} from "./registry";

/**
 * Starts the plugin host for the signed-in user and renders the one place
 * plugin UI appears outside settings: a side panel built from structured
 * blocks, always labelled with the plugin's name.
 */
export default function PluginHostRoot() {
  const state = useState();
  const client = useClient();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const params = useSmartParams();
  const { t } = useLingui();

  const host = new PluginHost({
    client,
    settings: {
      getValue: (key) => !!state.settings.getValue(key),
      setValue: (key, value) => state.settings.setValue(key, value),
    },
    insertText: (text) => state.draft.insertText(text),
    navigate: (path) => navigate(path),
    notify: (message) => snackbar.show({ message }),
    locale: () => i18n.locale || "en",
  });

  // development builds only: lets local tests read timings and state
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__zrzurPlugins = {
      plugins,
      host,
      footprint: () => PluginHost.footprint(),
      current: () => pluginHost(),
      live: () => PluginHost.live,
    };
  }

  onMount(async () => {
    await registerPluginTranslations();
    const forceSafeMode = new URLSearchParams(location.search).has("safe_mode");
    try {
      const { autoSafeMode } = await host.boot({ forceSafeMode });
      setPluginHost(host);
      if (autoSafeMode) {
        snackbar.show({
          message: t`Zrzur started in Safe Mode because it didn't start properly with plugins last time. Turn Safe Mode off in Settings → Advanced → Plugins.`,
          messageLine: 2,
        });
      }
    } catch (error) {
      // the plugin service being down must never break the app
      console.warn("[plugins] could not load installed plugins", error);
      setPluginHost(host);
    }
  });

  // channel switches (only to plugins with context.channel)
  createEffect(
    on(
      () => params().channelId,
      (channelId) => {
        if (!channelId) return;
        const channel = client().channels.get(channelId);
        host.emit("channel.switch", {
          channel_id: channelId,
          server_id: params().serverId ?? null,
          // only channels the user can already see are in the cache
          name: channel?.name ?? null,
        });
      },
      { defer: true },
    ),
  );

  const onLocale = () =>
    host.emit("app.locale_change", { locale: i18n.locale });
  i18n.on("change", onLocale);
  createEffect(
    on(
      () => state.theme.activeTheme,
      () => {
        host.applyOverlays();
        host.emit("app.theme_change", {});
      },
      { defer: true },
    ),
  );

  onCleanup(() => {
    i18n.removeListener("change", onLocale);
    setPluginHost(null);
    void host.dispose();
  });

  return <PluginPanel />;
}

function PluginPanel() {
  const { t } = useLingui();
  const locale = () => i18n.locale || "en";

  const plugin = () => {
    const panel = openPanel();
    return panel ? plugins[panel.pluginId] : undefined;
  };
  const name = () => {
    const p = plugin();
    if (!p) return "";
    return localise(
      p.manifest.locales?.[locale().split("-")[0]]?.name ?? p.manifest.name,
      locale(),
    );
  };
  const staticPanel = () => {
    const panel = openPanel();
    if (panel?.kind !== "static") return undefined;
    return plugin()?.manifest.contributes?.panels?.find(
      (p) => p.id === panel.panelId,
    );
  };
  const title = () => {
    const panel = openPanel();
    if (!panel) return "";
    return panel.kind === "static"
      ? localise(staticPanel()?.title, locale())
      : localise(panel.title, locale());
  };
  const blocks = (): (DynamicBlock | PanelBlock)[] => {
    const panel = openPanel();
    if (!panel) return [];
    return panel.kind === "static"
      ? (staticPanel()?.blocks ?? [])
      : panel.blocks;
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && openPanel()) setOpenPanel(null);
  };
  window.addEventListener("keydown", onKey);
  onCleanup(() => window.removeEventListener("keydown", onKey));

  return (
    <Show when={openPanel() && plugin()}>
      {/* at the end of the page, so it stays in front of open dialogs */}
      <Portal>
        <Sheet
          role="dialog"
          aria-label={t`${name()} plugin panel`}
          data-plugin-panel={plugin()!.id}
        >
          <Header>
            <Icon name="squares-four" size={18} />
            <div>
              <Owner>
                <Trans>Plugin · {name()}</Trans>
              </Owner>
              <Title>{title()}</Title>
            </div>
            <IconButton
              aria-label={t`Close`}
              variant="standard"
              onPress={() => setOpenPanel(null)}
            >
              <Icon name="x" size={18} />
            </IconButton>
          </Header>
          <Body>
            <For each={blocks()}>
              {(block) => (
                <Switch>
                  <Match when={block.type === "heading"}>
                    <Heading>
                      {localise((block as { text: string }).text, locale())}
                    </Heading>
                  </Match>
                  <Match when={block.type === "text"}>
                    <Paragraph>
                      {localise((block as { text: string }).text, locale())}
                    </Paragraph>
                  </Match>
                  <Match when={block.type === "divider"}>
                    <Divider />
                  </Match>
                  <Match when={block.type === "button"}>
                    <Button
                      size="sm"
                      variant="tonal"
                      onPress={() => {
                        const b = block as {
                          command?: string;
                          handler?: string;
                        };
                        const id = plugin()!.id;
                        if (b.command) hostHooks.runCommand(id, b.command);
                        else if (b.handler)
                          hostHooks.panelButton(id, b.handler);
                      }}
                    >
                      {localise((block as { label: string }).label, locale())}
                    </Button>
                  </Match>
                  <Match when={block.type === "setting"}>
                    <PanelSetting
                      pluginId={plugin()!.id}
                      settingKey={(block as { key: string }).key}
                    />
                  </Match>
                </Switch>
              )}
            </For>
          </Body>
        </Sheet>
      </Portal>
    </Show>
  );
}

/** A boolean setting inside a panel (other types are edited in settings) */
function PanelSetting(props: { pluginId: string; settingKey: string }) {
  const locale = () => i18n.locale || "en";
  const definition = () =>
    plugins[props.pluginId]?.manifest.contributes?.settings?.find(
      (s) => s.key === props.settingKey,
    );
  const value = () =>
    plugins[props.pluginId]?.settings[props.settingKey] ??
    definition()?.default;
  return (
    <Show when={definition()}>
      <SettingLine>
        <span>{localise(definition()!.title, locale())}</span>
        <Show
          when={definition()!.type === "boolean"}
          fallback={<code>{String(value())}</code>}
        >
          <Toggle
            checked={value() === true}
            aria-label={localise(definition()!.title, locale())}
            onChange={(checked) =>
              hostHooks.setSetting(props.pluginId, props.settingKey, checked)
            }
          />
        </Show>
      </SettingLine>
    </Show>
  );
}

const Sheet = styled("aside", {
  base: {
    position: "fixed",
    insetInlineEnd: "16px",
    bottom: "16px",
    // above dialogs (998): a command run from the plugin's settings page
    // opens its panel in front of that page, not hidden behind it
    zIndex: 999,
    width: "min(360px, calc(100vw - 32px))",
    maxHeight: "min(520px, calc(100vh - 96px))",
    display: "flex",
    flexDirection: "column",
    borderRadius: "var(--z-radius-lg, 14px)",
    border:
      "1px solid var(--z-border-subtle, var(--md-sys-color-outline-variant))",
    background:
      "var(--z-bg-raised, var(--md-sys-color-surface-container-high))",
    color: "var(--z-fg-primary, var(--md-sys-color-on-surface))",
    boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
    overflow: "hidden",
  },
});

const Header = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 12px 10px 14px",
    borderBottom:
      "1px solid var(--z-border-subtle, var(--md-sys-color-outline-variant))",
    "& > div": { flex: 1, minWidth: 0 },
  },
});

const Owner = styled("div", {
  base: {
    fontSize: "0.75rem",
    color: "var(--z-fg-secondary, var(--md-sys-color-on-surface-variant))",
  },
});

const Title = styled("div", {
  base: {
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Body = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "14px",
    overflowY: "auto",
    "& > button": { alignSelf: "flex-start" },
  },
});

const Heading = styled("h3", {
  base: { fontSize: "0.95rem", fontWeight: 600, margin: 0 },
});
const Paragraph = styled("p", {
  base: {
    margin: 0,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
});
const Divider = styled("hr", {
  base: {
    border: 0,
    borderTop:
      "1px solid var(--z-border-subtle, var(--md-sys-color-outline-variant))",
    margin: "2px 0",
  },
});
const SettingLine = styled("label", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
});
