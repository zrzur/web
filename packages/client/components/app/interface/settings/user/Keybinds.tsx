import {
  type JSX,
  For,
  Match,
  Show,
  Switch,
  createSignal,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { deviceMac, pauseShortcuts } from "@revolt/keybinds/active";
import { comboLabel, keyLabel } from "@revolt/keybinds/keyLabels";
import { type Combo, type ShortcutId } from "@revolt/keybinds/keymap";
import {
  type ComboCheck,
  checkCombo,
  comboKeys,
  readCombo,
  resetAllShortcuts,
  resetShortcut,
  setCombo,
  shortcutsChanged,
  swapShortcuts,
} from "@revolt/keybinds/keymapRules";
import { desktopPushToTalk } from "@revolt/rtc/desktopPushToTalk";
import {
  type GameKeyAction,
  bindCaps,
  cleanStoredBinds,
  desktopGameKeys,
  parseBind,
} from "@revolt/rtc/gameKeys";
import { useState } from "@revolt/state";
import {
  Button,
  Column,
  IconButton,
  SettingsRow,
  SettingsSection,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSettingsNavigation } from "../Settings";

/** A row: fixed keys, or a shortcut the person can change */
type Row = {
  title: JSX.Element;
  description?: JSX.Element;
  keys?: string[][];
  id?: ShortcutId;
};

/**
 * Keyboard shortcuts (Ctrl+/ opens this page). Lists only what works today;
 * the app's own shortcuts can be changed here, and follow the account to
 * every device.
 */
export function KeybindsSettings() {
  const { t } = useLingui();
  const state = useState();
  const { voice } = state;
  const { navigate } = useSettingsNavigation();
  const mac = deviceMac();

  /** Names for the clash message */
  const names: Record<ShortcutId, () => string> = {
    toggle_mute: () => t`Mute or unmute`,
    toggle_deafen: () => t`Deafen or undeafen`,
    create_poll: () => t`Create a poll`,
    navigation_channel_up: () => t`Previous channel`,
    navigation_channel_down: () => t`Next channel`,
    navigation_server_up: () => t`Previous server`,
    navigation_server_down: () => t`Next server`,
    chat_mark_server_as_read: () => t`Mark the server as read`,
    open_events: () => t`Open the server's events`,
    toggle_streamer: () => t`Streamer mode on or off`,
    open_shortcuts: () => t`Show keyboard shortcuts`,
  };

  // desktop app: binds heard in games (set in voice settings)
  const gameKeys = !!desktopGameKeys() && voice.gameKeys;
  const gameBinds = () => cleanStoredBinds(voice.gameBinds);
  const gameRows: { action: GameKeyAction; title: JSX.Element }[] = [
    { action: "talk", title: <Trans>Push to talk (hold)</Trans> },
    { action: "mute", title: <Trans>Push to mute (hold)</Trans> },
    { action: "toggleMute", title: <Trans>Mute or unmute, in any app</Trans> },
    {
      action: "toggleDeafen",
      title: <Trans>Deafen or undeafen, in any app</Trans>,
    },
  ];

  const groups: { title: JSX.Element; rows: Row[] }[] = [
    {
      title: <Trans>Calls</Trans>,
      rows: [
        {
          id: "toggle_mute",
          title: <Trans>Mute or unmute</Trans>,
          description: <Trans>During a call.</Trans>,
        },
        {
          id: "toggle_deafen",
          title: <Trans>Deafen or undeafen</Trans>,
          description: <Trans>During a call.</Trans>,
        },
        // desktop app: the binds that work in games
        ...(gameKeys
          ? gameRows.flatMap((row) => {
              const bind =
                parseBind(gameBinds()[row.action]) ??
                (row.action === "talk" && voice.inputMode === "ptt"
                  ? parseBind(voice.pttKey)
                  : undefined);
              return bind
                ? [
                    {
                      title: row.title,
                      description: (
                        <Trans>
                          Desktop app, during a call: works in games and other
                          apps. Change it in voice settings.
                        </Trans>
                      ),
                      keys: [bindCaps(bind, keyLabel)],
                    },
                  ]
                : [];
            })
          : []),
        // desktop app: the global talk toggle, with the person's own key
        ...(desktopPushToTalk() && !gameKeys
          ? [
              {
                title: <Trans>Talk from other apps (on or off)</Trans>,
                description: (
                  <Trans>
                    Desktop app, during a push-to-talk call, once turned on in
                    voice settings.
                  </Trans>
                ),
                keys: [["Mod", "Shift", keyLabel(voice.pttKey)]],
              },
            ]
          : []),
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
          id: "chat_mark_server_as_read",
          title: <Trans>Mark the server as read</Trans>,
        },
        {
          title: <Trans>Select a range of messages</Trans>,
          description: <Trans>While selecting messages to delete.</Trans>,
          keys: [["Shift", t`Click`]],
        },
        {
          title: <Trans>Stop selecting messages</Trans>,
          keys: [["Esc"]],
        },
        {
          title: <Trans>Choose where to forward</Trans>,
          description: (
            <Trans>
              In the forward window: move through the list, then send.
            </Trans>
          ),
          keys: [["↑"], ["↓"], ["Enter"]],
        },
        {
          id: "create_poll",
          title: <Trans>Create a poll</Trans>,
          description: <Trans>In a channel where you can post polls.</Trans>,
        },
      ],
    },
    {
      title: <Trans>Bot commands</Trans>,
      rows: [
        {
          title: <Trans>Open the command list</Trans>,
          description: <Trans>In a server channel or a DM with a bot.</Trans>,
          keys: [["/"]],
        },
        {
          title: <Trans>Move in the list</Trans>,
          keys: [["↑"], ["↓"]],
        },
        {
          title: <Trans>Choose a command or a suggestion</Trans>,
          description: <Trans>A command typed in full is chosen too.</Trans>,
          keys: [["Enter"], ["Tab"]],
        },
        {
          title: <Trans>Run the chosen command</Trans>,
          keys: [["Enter"]],
        },
        { title: <Trans>Close the command list</Trans>, keys: [["Esc"]] },
      ],
    },
    {
      title: <Trans>Navigation</Trans>,
      rows: [
        { id: "navigation_channel_up", title: <Trans>Previous channel</Trans> },
        { id: "navigation_channel_down", title: <Trans>Next channel</Trans> },
        { id: "navigation_server_up", title: <Trans>Previous server</Trans> },
        { id: "navigation_server_down", title: <Trans>Next server</Trans> },
        {
          id: "open_events",
          title: <Trans>Open the server's events</Trans>,
          description: <Trans>In a server.</Trans>,
        },
        {
          title: <Trans>Search Discover</Trans>,
          description: <Trans>On the Discover page.</Trans>,
          keys: [["/"]],
        },
      ],
    },
    {
      title: <Trans>Developer Portal</Trans>,
      rows: [
        {
          title: <Trans>Save a command</Trans>,
          description: <Trans>In the command editor.</Trans>,
          keys: [["Mod", "Enter"]],
        },
        {
          title: <Trans>Leave the command editor</Trans>,
          description: <Trans>Asks first if you changed something.</Trans>,
          keys: [["Esc"]],
        },
      ],
    },
    {
      title: <Trans>General</Trans>,
      rows: [
        { id: "open_shortcuts", title: <Trans>Show keyboard shortcuts</Trans> },
        {
          id: "toggle_streamer",
          title: <Trans>Streamer mode on or off</Trans>,
          description: (
            <Trans>
              Hides your email, tag, invite links and DM previews on screen.
            </Trans>
          ),
        },
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
        title={<Trans>Your shortcuts</Trans>}
        description={
          <Trans>
            Press a shortcut's keys to choose new ones. Your shortcuts follow
            you to every device you sign in on.
          </Trans>
        }
      >
        <SettingsRow
          icon={<Icon name="arrow-u-up-left" size={20} />}
          title={<Trans>Reset all shortcuts</Trans>}
          description={
            <Trans>
              Every shortcut and the push-to-talk key go back to the defaults.
            </Trans>
          }
          control={() => (
            <Button
              size="sm"
              variant="tonal"
              isDisabled={!shortcutsChanged(state.keybinds, voice.pttKey)}
              onPress={() => resetAllShortcuts(state.keybinds)}
              data-testid="keybinds-reset-all"
            >
              <Trans>Reset all</Trans>
            </Button>
          )}
        />
      </SettingsSection>
      <SettingsSection
        title={<Trans>Push to talk</Trans>}
        description={
          <Show
            when={gameKeys}
            fallback={
              <Trans>
                Hold one key to talk instead of an open microphone. Works while
                Zrzur is the active window.
              </Trans>
            }
          >
            <Trans>
              Hold one key to talk instead of an open microphone. In the
              desktop app it works in games and other apps too.
            </Trans>
          </Show>
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
                <Show
                  when={row.id}
                  fallback={
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
                  }
                >
                  {(id) => (
                    <ShortcutRow
                      id={id()}
                      title={row.title}
                      description={row.description}
                      name={names[id()]}
                      names={names}
                    />
                  )}
                </Show>
              )}
            </For>
          </SettingsSection>
        )}
      </For>
    </Column>
  );
}

type Phase =
  | { kind: "idle" }
  | { kind: "recording" }
  | {
      kind: "refused";
      combo: Combo;
      reason: NonNullable<ComboCheck["blocked"]>;
    }
  | { kind: "confirm"; combo: Combo; check: ComboCheck };

/**
 * A shortcut the person can change: press the key caps, then the new keys.
 * A clash offers to swap; keys the browser or the system keep are refused.
 */
export function ShortcutRow(props: {
  id: ShortcutId;
  title: JSX.Element;
  description?: JSX.Element;
  name: () => string;
  names: Record<ShortcutId, () => string>;
}) {
  const { t } = useLingui();
  const state = useState();
  const mac = deviceMac();
  const [phase, setPhase] = createSignal<Phase>({ kind: "idle" });

  const label = (combo: Combo) =>
    comboLabel(comboKeys(combo), mac).join(mac ? "" : "+");

  let resume: (() => void) | undefined;
  let keysButton: HTMLButtonElement | undefined;

  function stop(next: Phase = { kind: "idle" }, refocus = false) {
    window.removeEventListener("keydown", onKey, true);
    resume?.();
    resume = undefined;
    setPhase(next);
    // after Swap, Use anyway or Cancel the focus goes back to this row
    if (refocus) keysButton?.focus();
  }

  function onKey(event: KeyboardEvent) {
    // the press is the new combination: nothing else may act on it
    event.preventDefault();
    event.stopPropagation();
    if (event.isComposing) return;
    const read = readCombo(event, mac);
    if (read === "wait") return;
    if (read === "cancel") return stop();
    const check = checkCombo(props.id, read, state.keybinds.table(), mac, {
      pttKey: state.voice.pttKey,
      typesSlash: event.key === "/",
    });
    if (check.blocked)
      return stop({ kind: "refused", combo: read, reason: check.blocked });
    if (check.clash || check.warn)
      return stop({ kind: "confirm", combo: read, check });
    setCombo(state.keybinds, props.id, read);
    stop();
  }

  function record() {
    if (phase().kind === "recording") return stop();
    resume = pauseShortcuts();
    window.addEventListener("keydown", onKey, true);
    setPhase({ kind: "recording" });
  }

  onCleanup(() => stop());

  function confirm(current: Extract<Phase, { kind: "confirm" }>) {
    if (current.check.clash)
      swapShortcuts(
        state.keybinds,
        props.id,
        current.check.clash,
        current.combo,
      );
    else setCombo(state.keybinds, props.id, current.combo);
    stop(undefined, true);
  }

  const message = () => {
    const current = phase();
    switch (current.kind) {
      case "recording":
        return (
          <span style={NOTE} data-testid="keybind-note">
            <Trans>Press the new keys. Esc cancels.</Trans>
          </span>
        );
      case "refused": {
        const keys = label(current.combo);
        return (
          <span role="alert" style={NOTE_ERROR} data-testid="keybind-note">
            <Switch>
              <Match when={current.reason === "browser"}>
                <Trans>
                  Your browser keeps <bdi dir="ltr">{keys}</bdi> for itself.
                  Choose other keys.
                </Trans>
              </Match>
              <Match when={current.reason === "system"}>
                <Trans>
                  Your system keeps <bdi dir="ltr">{keys}</bdi> for itself.
                  Choose other keys.
                </Trans>
              </Match>
              <Match when={current.reason === "ptt"}>
                <Trans>
                  <bdi dir="ltr">{keys}</bdi> is your push-to-talk key. Add{" "}
                  {mac ? "⌘" : "Ctrl"} or choose another key.
                </Trans>
              </Match>
              <Match when={current.reason === "typing"}>
                <Trans>
                  <bdi dir="ltr">{keys}</bdi> is needed for typing. Add{" "}
                  {mac ? "⌘" : "Ctrl"} or use an F key.
                </Trans>
              </Match>
            </Switch>
          </span>
        );
      }
      case "confirm": {
        const keys = label(current.combo);
        const other = current.check.clash;
        return (
          <span role="alert" style={NOTE} data-testid="keybind-note">
            <Show when={other}>
              {(other) => (
                <span>
                  <Trans>
                    <bdi dir="ltr">{keys}</bdi> is already used for “
                    {props.names[other()]()}”. Swap them?
                  </Trans>
                </span>
              )}
            </Show>
            <Show when={current.check.warn}>
              <span>
                <Trans>
                  <bdi dir="ltr">{keys}</bdi> replaces a browser shortcut while
                  Zrzur is open.
                </Trans>
              </span>
            </Show>
            <span style={ROW_WRAP}>
              <Button
                size="sm"
                variant="filled"
                onPress={() => confirm(current)}
              >
                {other ? <Trans>Swap</Trans> : <Trans>Use anyway</Trans>}
              </Button>
              <Button
                size="sm"
                variant="text"
                onPress={() => stop(undefined, true)}
              >
                <Trans>Cancel</Trans>
              </Button>
            </span>
          </span>
        );
      }
      default:
        return null;
    }
  };

  // synced from a device where they differed: on this one two shortcuts
  // have the same keys, and only one of them works
  const conflict = () => state.keybinds.table().conflicts.get(props.id);

  return (
    <SettingsRow
      title={props.title}
      description={
        <Show when={props.description || phase().kind !== "idle" || conflict()}>
          <span style={COLUMN}>
            <Show when={props.description}>
              <span>{props.description}</span>
            </Show>
            <Show when={phase().kind === "idle" && conflict()}>
              {(other) => (
                <span
                  role="alert"
                  style={NOTE_ERROR}
                  data-testid="keybind-conflict"
                >
                  <Trans>
                    Same keys as “{props.names[other()]()}” on this device, so
                    only one of them works. Choose other keys.
                  </Trans>
                </span>
              )}
            </Show>
            {message()}
          </span>
        </Show>
      }
      control={() => (
        <span style={CONTROLS}>
          <Show when={state.keybinds.table().custom.has(props.id)}>
            <IconButton
              variant="toolbar"
              size="xs"
              aria-label={t`Reset ${props.name()} to the default`}
              onPress={() => {
                resetShortcut(state.keybinds, props.id);
                stop(undefined, true);
              }}
            >
              <Icon name="arrow-u-up-left" size={16} />
            </IconButton>
          </Show>
          <button
            ref={keysButton}
            type="button"
            class={PHONE_TARGET}
            style={{
              ...KEYS_BUTTON,
              ...(phase().kind === "recording" ? RECORDING : {}),
            }}
            data-recording={phase().kind === "recording"}
            data-shortcut={props.id}
            aria-label={
              phase().kind === "recording"
                ? t`Press the new keys for ${props.name()}. Esc cancels.`
                : t`Change the keys for ${props.name()}: ${label(state.keybinds.table().byId[props.id])}`
            }
            onClick={record}
            onBlur={() => phase().kind === "recording" && stop()}
          >
            <Show
              when={phase().kind !== "recording"}
              fallback={<Trans>Press keys…</Trans>}
            >
              <Keys
                keys={comboLabel(
                  comboKeys(state.keybinds.table().byId[props.id]),
                  mac,
                )}
              />
            </Show>
          </button>
        </span>
      )}
    />
  );
}

// inline styles: this screen loads on demand, so its look stays out of the
// stylesheet every page downloads
const COLUMN = {
  display: "flex",
  "flex-direction": "column",
  gap: "4px",
} satisfies JSX.CSSProperties;
const NOTE = {
  display: "flex",
  "flex-direction": "column",
  gap: "8px",
  color: "var(--z-fg-primary)",
} satisfies JSX.CSSProperties;
const NOTE_ERROR: JSX.CSSProperties = { ...NOTE, color: "var(--z-danger)" };
const ROW_WRAP = {
  display: "flex",
  gap: "8px",
  "flex-wrap": "wrap",
} satisfies JSX.CSSProperties;
const CONTROLS = {
  display: "flex",
  "align-items": "center",
  gap: "4px",
} satisfies JSX.CSSProperties;
const KEYS_BUTTON = {
  "min-width": "64px",
  "padding-inline": "8px",
  display: "inline-flex",
  "align-items": "center",
  "justify-content": "center",
  gap: "4px",
  "border-radius": "8px",
  border: "1px solid var(--z-border-subtle)",
  background: "transparent",
  color: "var(--z-fg-primary)",
  font: "inherit",
  "font-size": "12px",
  "font-weight": 600,
  cursor: "pointer",
} satisfies JSX.CSSProperties;
const RECORDING = {
  "border-color": "var(--z-accent)",
  color: "var(--z-accent)",
} satisfies JSX.CSSProperties;
// phones: a 44 px target (the same rule other screens use)
const PHONE_TARGET = css({ minHeight: "32px", _phone: { minHeight: "44px" } });

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
    borderRadius: "8px",
    background: "var(--z-card-bg, var(--md-sys-color-surface-container-high))",
    border:
      "1px solid var(--z-border-subtle, var(--md-sys-color-outline-variant))",
    boxShadow: "inset 0 -1px 0 var(--z-border-subtle)",
    color: "var(--z-fg-primary, var(--md-sys-color-on-surface))",
    fontFamily: "inherit",
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
});
