import {
  For,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { pluginApi } from "@revolt/plugins/api";
import { plugins } from "@revolt/plugins/registry";
import {
  Segmented,
  SettingsRow,
  SettingsSection,
  SettingsStatus,
  TextField,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { CATEGORIES } from "../../../../../../../plugin-sdk/src/manifest.ts";

import { PluginIcon } from "./common";
import { usePluginText } from "./text";

/** The plugin store: reviewed plugins only */
export function BrowseTab(props: { onOpen: (id: string) => void }) {
  const { t } = useLingui();
  const client = useClient();
  const text = usePluginText();
  const [query, setQuery] = createSignal("");
  const [category, setCategory] = createSignal<string>("all");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const [debounced, setDebounced] = createSignal("");

  const [page] = createResource(
    () => ({ query: debounced(), category: category() }),
    (q) =>
      pluginApi.list(client(), {
        query: q.query || undefined,
        category: q.category === "all" ? undefined : q.category,
      }),
  );

  const publisher = (id: string) =>
    page()?.publishers.find((p) => p._id === id);

  return (
    <SettingsSection
      title={<Trans>Browse plugins</Trans>}
      description={
        <Trans>
          Every plugin here was reviewed by Zrzur. Check what each one asks
          for before you install it.
        </Trans>
      }
    >
      <Filters>
        <TextField
          type="search"
          aria-label={t`Search plugins`}
          placeholder={t`Search plugins`}
          value={query()}
          onInput={(e) => {
            setQuery(e.currentTarget.value);
            clearTimeout(timer);
            timer = setTimeout(() => setDebounced(query().trim()), 250);
          }}
        />
        <Segmented
          aria-label={t`Category`}
          value={category()}
          onChange={setCategory}
          options={[
            { value: "all", label: <Trans>All</Trans> },
            ...CATEGORIES.map((c) => ({
              value: c as string,
              label: text.category(c),
            })),
          ]}
        />
      </Filters>
      <Switch>
        <Match when={page.loading}>
          <SettingsRow
            icon={<Icon name="hourglass" size={20} />}
            title={<Trans>Loading…</Trans>}
          />
        </Match>
        <Match when={page.error}>
          <SettingsRow
            danger
            icon={<Icon name="warning-circle" size={20} />}
            title={<Trans>The plugin store couldn't be loaded</Trans>}
          />
        </Match>
        <Match when={!page()?.plugins.length}>
          <SettingsRow
            icon={<Icon name="magnifying-glass" size={20} />}
            title={
              debounced() || category() !== "all" ? (
                <Trans>No plugin matches that</Trans>
              ) : (
                <Trans>No plugins are published yet</Trans>
              )
            }
          />
        </Match>
        <Match when={page()}>
          <For each={page()!.plugins}>
            {(plugin) => (
              <SettingsRow
                icon={
                  <PluginIcon icon={plugin.icon} category={plugin.category} />
                }
                title={
                  <>
                    {plugin.name}
                    <Show when={plugin.official}>
                      {" "}
                      <SettingsStatus tone="success">
                        <Trans>Official</Trans>
                      </SettingsStatus>
                    </Show>
                  </>
                }
                description={
                  <>
                    {plugin.summary}
                    <br />
                    {/* official plugins come from Zrzur, not the staff account that uploaded them */}
                    {plugin.official
                      ? "Zrzur"
                      : (publisher(plugin.publisher_id)?.display_name ??
                        publisher(plugin.publisher_id)?.username ??
                        "")}
                    <Show when={publisher(plugin.publisher_id)?.verified}>
                      {" ✓"}
                    </Show>
                    {" · "}v{plugin.latest_version} ·{" "}
                    {text.category(plugin.category)}
                  </>
                }
                secondary={
                  <Show when={plugins[plugin._id]}>
                    <SettingsStatus>
                      <Trans>Installed</Trans>
                    </SettingsStatus>
                  </Show>
                }
                navigational
                onClick={() => props.onOpen(plugin._id)}
              />
            )}
          </For>
        </Match>
      </Switch>
    </SettingsSection>
  );
}

const Filters = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "12px",
    "& > div:last-child": { overflowX: "auto", maxWidth: "100%" },
  },
});
