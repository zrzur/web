import { For, Show, onMount } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import {
  billingPlans,
  formatMegabytes,
  nextLevel,
  refreshBilling,
} from "@revolt/client/billing";
import { useModals } from "@revolt/modal";
import { Button, Column, SettingsRow, SettingsSection } from "@revolt/ui";
import { FeatherIcon } from "@revolt/ui/icons/FeatherIcon";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Wings and what they unlock: the server's level, how far the next level is,
 * and the perks of every level. Giving Wings happens in the Wings window.
 */
export function WingsSettings(props: { server: Server }) {
  const { i18n } = useLingui();
  const client = useClient();
  const { openModal } = useModals();

  onMount(() => {
    if (!billingPlans()) refreshBilling(client());
  });

  const levels = () => billingPlans()?.levels ?? [];
  const count = () => props.server.supercharge?.count ?? 0;
  const level = () => props.server.supercharge?.level ?? 0;
  const next = () => nextLevel(count());
  const stream = (resolution: number[], fps: number) =>
    `${resolution[1]}p${fps}`;

  const give = () =>
    openModal({ type: "supercharge_server", server: props.server });

  return (
    <Column gap="xl">
      <SettingsSection
        title={<Trans>Progress</Trans>}
        description={
          <Trans>
            Members give the server Wings. More Wings unlock higher levels and
            their perks for everyone.
          </Trans>
        }
        aside={
          <Button size="sm" shape="square" onPress={give}>
            <Icon name="lightning" size={16} />
            <Trans>Give Wings</Trans>
          </Button>
        }
      >
        <SettingsRow
          icon={<FeatherIcon size={20} />}
          title={
            <Show when={level()} fallback={<Trans>No level yet</Trans>}>
              <Trans>Level {level()}</Trans>
            </Show>
          }
          description={
            <Show
              when={next()}
              fallback={<Trans>{count()} Wings · highest level reached</Trans>}
            >
              <Trans>
                {count()} Wings · {Math.max(0, next()!.supercharges - count())}{" "}
                more to level {next()!.level}
              </Trans>
            </Show>
          }
        />
        <Show when={next()}>
          <Progress aria-hidden="true">
            <i
              style={{
                width: `${Math.min(100, (count() / next()!.supercharges) * 100)}%`,
              }}
            />
          </Progress>
        </Show>
      </SettingsSection>

      <For each={levels()}>
        {(entry) => (
          <SettingsSection
            title={<Trans>Level {entry.level}</Trans>}
            description={
              <Show
                when={level() >= entry.level}
                fallback={<Trans>From {entry.supercharges} Wings</Trans>}
              >
                <Trans>Unlocked</Trans>
              </Show>
            }
          >
            <Perks data-unlocked={level() >= entry.level}>
              <li>
                <Icon name="smiley" size={16} />
                <Trans>{entry.server_emoji} emoji slots</Trans>
              </li>
              <li>
                <Icon name="upload-simple" size={16} />
                <Trans>
                  {formatMegabytes(entry.attachments, i18n().locale)} uploads
                  for everyone
                </Trans>
              </li>
              <li>
                <Icon name="microphone" size={16} />
                <Trans>{entry.voice_bitrate / 1000} kbps voice</Trans>
              </li>
              <li>
                <Icon name="monitor-arrow-up" size={16} />
                <Trans>
                  {stream(entry.video_resolution, entry.video_framerate)}{" "}
                  streams
                </Trans>
              </li>
              <Show when={entry.vanity_invite}>
                <li>
                  <Icon name="link" size={16} />
                  <Trans>Custom invite link zrzur.cc/your-name</Trans>
                </li>
              </Show>
            </Perks>
          </SettingsSection>
        )}
      </For>
    </Column>
  );
}

const Progress = styled("div", {
  base: {
    height: "6px",
    marginInline: "16px",
    marginBlockEnd: "16px",
    borderRadius: "999px",
    overflow: "hidden",
    background: "color-mix(in srgb, var(--z-fg-primary) 8%, transparent)",
    "& i": {
      display: "block",
      height: "100%",
      borderRadius: "inherit",
      background: "var(--z-wings, var(--z-accent))",
    },
  },
});

const Perks = styled("ul", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "12px 16px",
    margin: 0,
    padding: "16px",
    listStyle: "none",
    fontSize: "14px",
    color: "var(--z-fg-primary)",
    "& li": { display: "flex", alignItems: "center", gap: "8px" },
    "&[data-unlocked=false]": { color: "var(--z-fg-secondary)" },
  },
});
