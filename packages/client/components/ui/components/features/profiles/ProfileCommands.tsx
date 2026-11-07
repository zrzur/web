import { For, Show, createMemo, createResource } from "solid-js";

import { i18n } from "@lingui/core";
import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { loadServerCommands } from "@revolt/app/interface/channels/text/interactions/store";
import { localized } from "@revolt/app/interface/channels/text/interactions/types";
import { useClient } from "@revolt/client";

import { ProfileSection } from "./ProfileCard";

/** Commands shown before "and N more" */
const SHOWN = 6;

/**
 * Slash commands a bot offers in this server, so people can see what it does
 */
export function ProfileCommands(props: { botId: string; serverId?: string }) {
  const client = useClient();
  const [commands] = createResource(
    () => props.serverId,
    (serverId) => loadServerCommands(client(), serverId).catch(() => undefined),
  );

  const list = createMemo(() =>
    (commands()?.commands ?? [])
      .filter(
        (command) =>
          command.application_id === props.botId &&
          command.type === "ChatInput",
      )
      .map((command) => ({
        id: command._id,
        name: localized(command.name, command.name_localizations, i18n.locale),
        description: localized(
          command.description ?? "",
          command.description_localizations,
          i18n.locale,
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  const more = () => list().length - SHOWN;

  return (
    <Show when={list().length}>
      <ProfileSection title={<Trans>Commands</Trans>}>
        <List>
          <For each={list().slice(0, SHOWN)}>
            {(command) => (
              <li>
                <Name dir="ltr">/{command.name}</Name>
                <Show when={command.description}>
                  <Description dir="auto">{command.description}</Description>
                </Show>
              </li>
            )}
          </For>
        </List>
        <Show when={more() > 0}>
          <More>
            <Trans>
              and {more()} more — type / in a channel to see them all
            </Trans>
          </More>
        </Show>
      </ProfileSection>
    </Show>
  );
}

const List = styled("ul", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    margin: 0,
    padding: 0,
    listStyle: "none",
    "& li": {
      display: "flex",
      alignItems: "baseline",
      gap: "8px",
      minWidth: 0,
    },
  },
});

const Name = styled("span", {
  base: {
    flexShrink: 0,
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--profile-ink, var(--z-fg-primary))",
    fontFamily: "var(--fonts-monospace, monospace)",
  },
});

const Description = styled("span", {
  base: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "13px",
    color: "var(--profile-ink-2, var(--z-fg-muted))",
  },
});

const More = styled("span", {
  base: { fontSize: "12px", color: "var(--profile-ink-2, var(--z-fg-muted))" },
});
