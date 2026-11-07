import { type JSX, For, Show } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { comboLabel, isMac, keyLabel } from "@revolt/keybinds/shortcuts";
import { useState } from "@revolt/state";
import { Column, SettingsRow, SettingsSection } from "@revolt/ui";

import { useSettingsNavigation } from "../Settings";

type Row = { title: JSX.Element; description?: JSX.Element; keys: string[][] };

/**
 * Keyboard shortcuts (Ctrl+/ opens this page). Lists only what works today.
 */
export function KeybindsSettings() {
  const { t } = useLingui();
  const { voice } = useState();
  const { navigate } = useSettingsNavigation();
  const mac = isMac();

  const groups: { title: JSX.Element; rows: Row[] }[] = [
    {
      title: <Trans>Calls</Trans>,
      rows: [
        {
          title: <Trans>Mute or unmute</Trans>,
          description: <Trans>During a call.</Trans>,
          keys: [["Mod", "Shift", "M"]],
        },
        {
          title: <Trans>Deafen or undeafen</Trans>,
          description: <Trans>During a call.</Trans>,
          keys: [["Mod", "Shift", "D"]],
        },
      ],
    },
    {
      title: <Trans>Messages</Trans>,
      rows: [
        { title: <Trans>Send</Trans>, keys: [["Enter"]] },
        { title: <Trans>New line</Trans>, keys: [["Shift", "Enter"]] },
        {
          title: <Trans>Edit your last message</Trans>,
          description: <Trans>When the message box is empty.</Trans>,
          keys: [["↑"]],
        },
        { title: <Trans>Cancel editing</Trans>, keys: [["Esc"]] },
        {
          title: <Trans>Start typing</Trans>,
          description: <Trans>Any letter jumps into the message box.</Trans>,
          keys: [[t`Any letter`]],
        },
        {
          title: <Trans>Jump to the newest message</Trans>,
          description: <Trans>Also marks the channel as read.</Trans>,
          keys: [["Esc"]],
        },
        {
          title: <Trans>Mark the server as read</Trans>,
          keys: [["Shift", "Esc"]],
        },
      ],
    },
    {
      title: <Trans>Navigation</Trans>,
      rows: [
        {
          title: <Trans>Previous or next channel</Trans>,
          keys: [
            ["Alt", "↑"],
            ["Alt", "↓"],
          ],
        },
        {
          title: <Trans>Previous or next server</Trans>,
          keys: [
            ["Ctrl", "Alt", "↑"],
            ["Ctrl", "Alt", "↓"],
          ],
        },
        {
          title: <Trans>Search Discover</Trans>,
          description: <Trans>On the Discover page.</Trans>,
          keys: [["/"]],
        },
      ],
    },
    {
      title: <Trans>General</Trans>,
      rows: [
        { title: <Trans>Show keyboard shortcuts</Trans>, keys: [["Mod", "/"]] },
        {
          title: <Trans>Close a window or menu</Trans>,
          keys: [["Esc"]],
        },
      ],
    },
  ];

  return (
    <Column gap="xl">
      <SettingsSection
        title={<Trans>Push to talk</Trans>}
        description={
          <Trans>
            Hold one key to talk instead of an open microphone. Works while
            Zrzur is the active window.
          </Trans>
        }
      >
        <SettingsRow
          title={
            voice.inputMode === "ptt" ? <Trans>On</Trans> : <Trans>Off</Trans>
          }
          description={
            <Trans>Turn it on and choose the key in voice settings.</Trans>
          }
          navigational
          onClick={() => navigate("voice")}
          control={() => (
            <Show when={voice.inputMode === "ptt"}>
              <Keys keys={[keyLabel(voice.pttKey)]} />
            </Show>
          )}
        />
      </SettingsSection>
      <For each={groups}>
        {(group) => (
          <SettingsSection title={group.title}>
            <For each={group.rows}>
              {(row) => (
                <SettingsRow
                  title={row.title}
                  description={row.description}
                  control={() => (
                    <Combos>
                      <For each={row.keys}>
                        {(combo) => <Keys keys={comboLabel(combo, mac)} />}
                      </For>
                    </Combos>
                  )}
                />
              )}
            </For>
          </SettingsSection>
        )}
      </For>
    </Column>
  );
}

/** One combo as key caps, always left to right (keys are not text) */
function Keys(props: { keys: string[] }) {
  return (
    <Caps dir="ltr">
      <For each={props.keys}>{(key) => <Cap>{key}</Cap>}</For>
    </Caps>
  );
}

const Combos = styled("div", {
  base: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
});

const Caps = styled("span", {
  base: {
    display: "inline-flex",
    gap: "4px",
  },
});

const Cap = styled("kbd", {
  base: {
    minWidth: "24px",
    height: "24px",
    paddingInline: "8px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "6px",
    background: "var(--z-card-bg, var(--md-sys-color-surface-container-high))",
    border:
      "1px solid var(--z-border-subtle, var(--md-sys-color-outline-variant))",
    boxShadow: "inset 0 -1px 0 var(--z-border-subtle, rgb(0 0 0 / 0.25))",
    color: "var(--z-fg, var(--md-sys-color-on-surface))",
    fontFamily: "inherit",
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
});
