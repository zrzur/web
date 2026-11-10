import { For, Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { SettingsStatus } from "@revolt/ui";
import { type IconName, Icon, iconRegistry } from "@revolt/ui/icons/Icon";

import type { InstallView } from "@revolt/plugins/api";
import type { ActivePlugin } from "@revolt/plugins/registry";

import { categoryIcon, usePluginText } from "./text";

/** A plugin's own icon if it names one Zrzur has, else its category's */
export function PluginIcon(props: {
  icon?: string;
  category: string;
  size?: number;
}) {
  const name = (): IconName =>
    props.icon && Object.hasOwn(iconRegistry, props.icon)
      ? (props.icon as IconName)
      : categoryIcon(props.category);
  return (
    <IconTile>
      <Icon name={name()} size={props.size ?? 22} />
    </IconTile>
  );
}

const IconTile = styled("span", {
  base: {
    display: "inline-grid",
    placeItems: "center",
    width: "40px",
    height: "40px",
    flexShrink: 0,
    color: "var(--z-accent, var(--md-sys-color-primary))",
  },
});

/**
 * Lifecycle state in words. Never says "running" unless the host really
 * runs it.
 */
export function StateChip(props: {
  view?: InstallView;
  active?: ActivePlugin;
  updating?: boolean;
}) {
  const state = () => {
    const view = props.view;
    const active = props.active;
    if (props.updating)
      return { tone: "neutral" as const, label: <Trans>Updating…</Trans> };
    if (view?.blocked === "revoked")
      return { tone: "warning" as const, label: <Trans>Revoked</Trans> };
    if (view?.blocked === "suspended" || view?.blocked === "removed")
      return { tone: "warning" as const, label: <Trans>Blocked</Trans> };
    if (active?.status === "quarantined")
      return { tone: "warning" as const, label: <Trans>Quarantined</Trans> };
    if (active?.status === "failed")
      return { tone: "warning" as const, label: <Trans>Failed</Trans> };
    if (view && !view.enabled)
      return { tone: "neutral" as const, label: <Trans>Disabled</Trans> };
    if (active?.status === "unsupported")
      return {
        tone: "neutral" as const,
        label: <Trans>Not supported here</Trans>,
      };
    if (active?.status === "blocked")
      return { tone: "warning" as const, label: <Trans>Can't run</Trans> };
    if (active?.status === "running")
      return { tone: "success" as const, label: <Trans>Running</Trans> };
    if (active?.status === "starting")
      return { tone: "neutral" as const, label: <Trans>Starting…</Trans> };
    if (view?.enabled)
      return {
        tone: "neutral" as const,
        label: <Trans>Enabled · not running</Trans>,
      };
    return { tone: "neutral" as const, label: <Trans>Installed</Trans> };
  };
  return <SettingsStatus tone={state().tone}>{state().label}</SettingsStatus>;
}

/** Permission list with risk levels */
export function PermissionList(props: {
  permissions: string[];
  highlight?: string[];
}) {
  const text = usePluginText();
  return (
    <Show
      when={props.permissions.length}
      fallback={
        <Muted>
          <Trans>Needs no permissions.</Trans>
        </Muted>
      }
    >
      <Perms>
        <For each={props.permissions}>
          {(id) => (
            <li
              data-risk={text.risk(id)}
              data-new={props.highlight?.includes(id) || undefined}
            >
              <Icon
                name={
                  text.risk(id) === "low" ? "shield-check" : "warning-circle"
                }
                size={18}
              />
              <div>
                <strong>
                  {text.permission(id).title}
                  <Show when={props.highlight?.includes(id)}>
                    {" "}
                    <SettingsStatus tone="warning">
                      <Trans>New</Trans>
                    </SettingsStatus>
                  </Show>
                </strong>
                <span>
                  {text.permission(id).detail} · {text.riskLabel(text.risk(id))}
                </span>
                <code>{id}</code>
              </div>
            </li>
          )}
        </For>
      </Perms>
    </Show>
  );
}

export const Muted = styled("p", {
  base: {
    margin: 0,
    color: "var(--z-fg-secondary, var(--md-sys-color-on-surface-variant))",
    fontSize: "0.875rem",
  },
});

const Perms = styled("ul", {
  base: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    "& li": { display: "flex", gap: "10px", alignItems: "flex-start" },
    "& li[data-risk=medium] svg, & li[data-risk=high] svg": {
      color: "var(--z-status-warning)",
    },
    "& li[data-risk=low] svg": { color: "var(--z-status-success)" },
    "& li > div": {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      minWidth: 0,
    },
    "& span": {
      fontSize: "0.8125rem",
      color: "var(--z-fg-secondary, var(--md-sys-color-on-surface-variant))",
    },
    "& code": {
      fontSize: "0.75rem",
      opacity: 0.7,
      direction: "ltr",
      unicodeBidi: "isolate",
    },
  },
});

export const Card = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    borderRadius: "var(--z-radius-lg, 14px)",
    border:
      "1px solid var(--z-border-subtle, var(--md-sys-color-outline-variant))",
    background: "var(--z-bg-raised, var(--md-sys-color-surface-container))",
  },
});

export const Row = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
});

export const Stack = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
    flex: 1,
  },
});

export const Title = styled("h2", {
  base: { margin: 0, fontSize: "1.125rem", fontWeight: 650 },
});

export const Pre = styled("pre", {
  base: {
    margin: 0,
    maxHeight: "320px",
    overflow: "auto",
    padding: "12px",
    borderRadius: "10px",
    fontSize: "0.75rem",
    lineHeight: 1.5,
    direction: "ltr",
    textAlign: "start",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    background: "color-mix(in srgb, var(--z-fg-primary, #fff) 6%, transparent)",
  },
});

export const ErrorText = styled("p", {
  base: {
    margin: 0,
    color: "var(--md-sys-color-error)",
    fontSize: "0.875rem",
    whiteSpace: "pre-wrap",
  },
});
