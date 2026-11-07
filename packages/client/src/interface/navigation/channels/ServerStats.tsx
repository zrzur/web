import { For, Show } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import type { Server, ServerStat } from "@zrzur/sdk/solid";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { type IconName, Icon } from "@revolt/ui/icons/Icon";

const ICONS: Record<ServerStat, IconName> = {
  Members: "users",
  Channels: "hash",
  Roles: "shield",
  Wings: "lightning",
};

/**
 * Live counters at the top of a server's channel list, chosen by the
 * server's managers in Settings (Overview). Read-only rows with a lock:
 * nobody opens them, they only show a number that stays current.
 *
 * SERVER STATS
 * [users+lock] Members: 3.08K
 */
export function ServerStats(props: { server: Server }) {
  const { t, i18n } = useLingui();

  const format = (value: number) =>
    new Intl.NumberFormat(i18n().locale, {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);

  const value = (stat: ServerStat) => {
    switch (stat) {
      case "Members":
        return props.server.approximateMemberCount;
      case "Channels":
        return props.server.channelIds.size;
      case "Roles":
        return props.server.roles.size;
      case "Wings":
        return props.server.supercharge?.count ?? 0;
    }
  };

  const label = (stat: ServerStat) => {
    switch (stat) {
      case "Members":
        return t`Members: ${format(value(stat))}`;
      case "Channels":
        return t`Channels: ${format(value(stat))}`;
      case "Roles":
        return t`Roles: ${format(value(stat))}`;
      case "Wings":
        return t`Wings: ${format(value(stat))}`;
    }
  };

  return (
    <Show when={props.server.stats.length}>
      <section class={section} aria-label={t`Server stats`}>
        <Title>{t`Server stats`}</Title>
        <For each={props.server.stats}>
          {(stat) => (
            <Row title={t`Updates by itself. Nobody can open it.`}>
              <span class={iconWithLock}>
                <Icon name={ICONS[stat]} size={20} />
                <span class={lockBadge} aria-hidden="true">
                  <Icon name="lock-simple" size={10} />
                </span>
              </span>
              <span class={text}>{label(stat)}</span>
            </Row>
          )}
        </For>
      </section>
    </Show>
  );
}

const section = css({
  display: "flex",
  flexDirection: "column",
  gap: "1px",
  paddingBlockEnd: "6px",
});

/** Same look as a category title */
const Title = styled("div", {
  base: {
    padding: "14px 16px 4px",
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
    _phone: { fontSize: "12px" },
  },
});

/** Same size as a channel row, never interactive */
const Row = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "34px",
    marginInline: "6px",
    paddingInline: "8px",
    borderRadius: "6px",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "var(--z-fg-muted)",
    fontSize: "15px",
    fontWeight: 500,
    cursor: "default",
    userSelect: "none",
    _phone: { minHeight: "44px" },
  },
});

const text = css({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
});

const iconWithLock = css({
  position: "relative",
  display: "inline-flex",
  flexShrink: 0,
});

const lockBadge = css({
  position: "absolute",
  bottom: "-3px",
  insetInlineEnd: "-4px",
  width: "13px",
  height: "13px",
  display: "grid",
  placeItems: "center",
  borderRadius: "50%",
  background: "var(--z-bg-sidebar, var(--z-bg-nav))",
  "--z-icon-color": "var(--z-fg-muted)",
});
