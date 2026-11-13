import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createSignal,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { DOWNLOAD_PAGE_URL } from "@revolt/common/lib/links";
import { pauseShortcuts } from "@revolt/keybinds/active";
import { keyLabel } from "@revolt/keybinds/keyLabels";
import { useVoice } from "@revolt/rtc";
import {
  type BindProblem,
  type GameBind,
  type GameBinds,
  type GameKeyAction,
  GAME_KEY_ACTIONS,
  RELEASE_DELAYS,
  bindCaps,
  checkBind,
  cleanStoredBinds,
  desktopGameKeys,
  formatBind,
  gameKeysUsable,
  parseBind,
  readBindKey,
  readBindKeyUp,
  readBindMouse,
} from "@revolt/rtc/gameKeys";
import { useState } from "@revolt/state";
import {
  Button,
  FloatingSelect,
  MenuItem,
  SettingsRow,
  SettingsSection,
  Toggle,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

/** How long the key test listens before it stops by itself */
const TEST_MS = 60_000;

/**
 * Keys that work in games: push to talk, push to mute, mute and deafen
 * from any app (desktop app), the release delay, and a test that shows a
 * key being heard while another window is in front.
 */
export function GameKeysOptions() {
  const { voice } = useState();
  const call = useVoice();
  const { t } = useLingui();
  const bridge = desktopGameKeys();
  const status = () => call?.gameKeys();
  const usable = () => !!bridge && gameKeysUsable(status());

  const names: Record<GameKeyAction, () => string> = {
    talk: () => t`Push to talk`,
    mute: () => t`Push to mute`,
    toggleMute: () => t`Mute or unmute`,
    toggleDeafen: () => t`Deafen or undeafen`,
  };
  const lines: Record<GameKeyAction, () => string> = {
    talk: () =>
      t`Others hear you while you hold it. Without a key here, your push-to-talk key is used.`,
    mute: () => t`Your microphone is off while you hold it.`,
    toggleMute: () => t`One press mutes you, the next unmutes.`,
    toggleDeafen: () =>
      t`One press turns the call's sound off, the next turns it back on.`,
  };
  const icons: Record<GameKeyAction, string> = {
    talk: "microphone",
    mute: "microphone-slash",
    toggleMute: "microphone-slash",
    toggleDeafen: "headphones",
  };

  const stored = (): GameBinds => {
    const out: GameBinds = {};
    const clean = cleanStoredBinds(voice.gameBinds);
    for (const action of GAME_KEY_ACTIONS) {
      const bind = parseBind(clean[action]);
      if (bind) out[action] = bind;
    }
    return out;
  };
  /** The bind shown for an action: its own, or the push-to-talk key */
  const shown = (action: GameKeyAction): GameBind | undefined =>
    stored()[action] ??
    (action === "talk" ? parseBind(voice.pttKey) : undefined);

  // ------------------------------------------------------------ recording
  const [recording, setRecording] = createSignal<GameKeyAction>();
  const [problem, setProblem] = createSignal<BindProblem>();
  let resume: (() => void) | undefined;
  const swallowUp = new Set<string>();

  const take = (bind: GameBind) => {
    const action = recording();
    if (!action) return;
    const others = stored();
    delete others[action];
    const wrong = checkBind(action, bind, others);
    if (wrong) return setProblem(wrong);
    voice.setGameBind(action, formatBind(bind));
    stop();
  };
  const onKey = (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    swallowUp.add(event.code);
    const result = readBindKey(event);
    if (result === "wait") return;
    if (result === "cancel") return stop();
    take(result);
  };
  const onKeyUp = (event: KeyboardEvent) => {
    const wasOurs = swallowUp.delete(event.code);
    if (!recording()) {
      if (wasOurs) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    // a modifier pressed and let go alone is the bind itself
    const alone = wasOurs && swallowUp.size === 0 && readBindKeyUp(event);
    if (alone) take(alone);
  };
  // a side button also goes back or forward in the page when it is let
  // go: that release is swallowed, also after the bind was taken
  let swallowButton: number | undefined;
  const onMouse = (event: MouseEvent) => {
    const bind = readBindMouse(event);
    if (!bind) return;
    event.preventDefault();
    event.stopPropagation();
    swallowButton = event.button;
    take(bind);
  };
  const onAux = (event: MouseEvent) => {
    if (event.button !== swallowButton) return;
    event.preventDefault();
    event.stopPropagation();
    // the release comes as mouseup, then auxclick
    if (event.type === "auxclick") swallowButton = undefined;
  };
  function stop() {
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("mousedown", onMouse, true);
    resume?.();
    resume = undefined;
    setRecording();
    setProblem();
  }
  function start(action: GameKeyAction) {
    stop();
    swallowUp.clear();
    setRecording(action);
    // the app's own shortcuts and the binds themselves stay quiet meanwhile
    resume = pauseShortcuts();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onMouse, true);
  }
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("mouseup", onAux, true);
  window.addEventListener("auxclick", onAux, true);

  // ----------------------------------------------------------------- test
  const [testing, setTesting] = createSignal(false);
  /** Per action: heard in another window, or only inside Zrzur */
  const [heard, setHeard] = createSignal<
    Partial<Record<GameKeyAction, "away" | "here">>
  >({});
  let testTimer: ReturnType<typeof setTimeout> | undefined;
  let lastSeen: unknown;
  createEffect(() => {
    const event = call?.gameKeyHeard();
    if (!testing() || !event || event === lastSeen || !event.down) return;
    lastSeen = event;
    setHeard((before) => ({
      ...before,
      [event.action]:
        event.away || before[event.action] === "away" ? "away" : "here",
    }));
  });
  function endTest() {
    clearTimeout(testTimer);
    setTesting(false);
    call?.setGameKeyTest(false);
  }
  function startTest() {
    lastSeen = call?.gameKeyHeard();
    setHeard({});
    setTesting(true);
    call?.setGameKeyTest(true);
    clearTimeout(testTimer);
    testTimer = setTimeout(endTest, TEST_MS);
  }

  onCleanup(() => {
    stop();
    endTest();
    window.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("mouseup", onAux, true);
    window.removeEventListener("auxclick", onAux, true);
  });

  const problemText = () => {
    const p = problem();
    if (!p)
      return t`Press a key, a combination or a mouse side button. Esc cancels.`;
    if (p === "reserved")
      return t`That key is needed elsewhere. Press another key, or Esc to cancel.`;
    if (p === "typing")
      return t`A key that types would switch this while you write. Hold Ctrl, Alt or Shift with it, or press another key.`;
    const other = names[p.clash]();
    return t`${other} already uses that. Press another key, or Esc to cancel.`;
  };

  return (
    <SettingsSection
      title={<Trans>Keys that work in games</Trans>}
      description={
        <Show
          when={bridge}
          fallback={
            <Trans>
              In the browser, your keys work only while the Zrzur tab is active.
              To talk while you play, use the Zrzur desktop app.
            </Trans>
          }
        >
          <Trans>
            Zrzur hears these keys while a game or another app is in front. The
            game still gets every key.
          </Trans>
        </Show>
      }
      aside={
        <Show when={!bridge}>
          <a href={DOWNLOAD_PAGE_URL} target="_blank" rel="noreferrer">
            <Trans>Get the desktop app</Trans>
          </a>
        </Show>
      }
    >
      <Show when={bridge}>
        <SettingsRow
          icon={<Icon name="game-controller" size={20} />}
          title={<Trans>Keys work in games</Trans>}
          description={
            <>
              <StatusLine
                data-testid="game-keys-status"
                data-state={status()?.state}
              >
                <Switch>
                  <Match when={status()?.state === "permission"}>
                    <Trans>
                      macOS asks for your permission first: allow Zrzur under
                      Privacy & Security, Accessibility.
                    </Trans>
                  </Match>
                  <Match when={status()?.state === "error"}>
                    <Trans>
                      Zrzur could not start listening for keys on this computer.
                      Your keys work while the Zrzur window is active.
                    </Trans>
                    <Show when={status()?.detail}>
                      <details class="z-error-details">
                        <summary>
                          <Trans>Details</Trans>
                        </summary>
                        <code dir="ltr">{status()?.detail}</code>
                      </details>
                    </Show>
                  </Match>
                  <Match when={!voice.gameKeys}>
                    <Trans>
                      Off. Your keys work only while the Zrzur window is active.
                    </Trans>
                  </Match>
                  <Match when={status()?.state === "on"}>
                    <Trans>Listening now: your keys work in every app.</Trans>
                  </Match>
                  <Match when={true}>
                    <Trans>
                      Ready. Zrzur listens only while you are in a call.
                    </Trans>
                  </Match>
                </Switch>
              </StatusLine>
              <Trans>
                Zrzur reacts only to the keys you choose here. It records
                nothing and sends nothing.
              </Trans>
              <Show when={status()?.wayland}>
                {" "}
                <Trans>
                  On Wayland, keys are heard only in games that run through
                  XWayland.
                </Trans>
              </Show>
              <Show when={status()?.platform === "win32"}>
                {" "}
                <Trans>
                  A game started as administrator hides its keys from other
                  apps; start Zrzur as administrator too to use them there.
                </Trans>
              </Show>
            </>
          }
          control={(ids) => (
            <Controls>
              <Show when={status()?.state === "permission"}>
                <Button
                  size="sm"
                  variant="tonal"
                  onPress={() =>
                    void bridge!
                      .askPermission()
                      .then((s) => s && call?.setGameKeys(s))
                  }
                >
                  <Trans>Allow…</Trans>
                </Button>
              </Show>
              <Toggle
                checked={voice.gameKeys}
                onChange={() => (voice.gameKeys = !voice.gameKeys)}
                aria-labelledby={ids.labelId}
                aria-describedby={ids.descriptionId}
              />
            </Controls>
          )}
        />
        <For each={GAME_KEY_ACTIONS}>
          {(action) => (
            <SettingsRow
              icon={<Icon name={icons[action] as never} size={20} />}
              title={names[action]()}
              description={
                recording() === action ? problemText() : lines[action]()
              }
              disabled={!voice.gameKeys}
              control={(ids) => (
                <Controls data-testid={`game-key-${action}`}>
                  <Show
                    when={recording() !== action}
                    fallback={
                      <Waiting aria-live="polite">
                        <Trans>Press a key…</Trans>
                      </Waiting>
                    }
                  >
                    <Show
                      when={shown(action)}
                      fallback={
                        <Waiting>
                          <Trans>No key</Trans>
                        </Waiting>
                      }
                    >
                      {(bind) => (
                        <Caps dir="ltr" aria-labelledby={ids.labelId}>
                          <For each={bindCaps(bind(), keyLabel)}>
                            {(cap) => <Cap>{cap}</Cap>}
                          </For>
                        </Caps>
                      )}
                    </Show>
                  </Show>
                  <Button
                    size="sm"
                    variant="tonal"
                    isDisabled={!voice.gameKeys}
                    onPress={() =>
                      recording() === action ? stop() : start(action)
                    }
                  >
                    {recording() === action ? t`Cancel` : t`Change key`}
                  </Button>
                  <Show when={stored()[action] && recording() !== action}>
                    <Button
                      size="sm"
                      variant="text"
                      onPress={() => voice.setGameBind(action, undefined)}
                    >
                      <Trans>Remove</Trans>
                    </Button>
                  </Show>
                </Controls>
              )}
            />
          )}
        </For>
      </Show>
      <SettingsRow
        icon={<Icon name="timer" size={20} />}
        title={<Trans>Release delay</Trans>}
        description={
          <Trans>
            Push to talk keeps the microphone open this long after you let go,
            so the end of a word is not cut off.
          </Trans>
        }
        control={(ids) => (
          <SelectWidth>
            <FloatingSelect
              aria-labelledby={ids.labelId}
              value={String(voice.pttReleaseDelay)}
              onChange={(e) => {
                const ms = Number(e.currentTarget.value);
                if (Number.isFinite(ms)) voice.pttReleaseDelay = ms;
              }}
            >
              <For each={RELEASE_DELAYS}>
                {(ms) => (
                  <MenuItem value={String(ms)}>
                    {ms === 0 ? t`None` : t`${(ms / 1000).toLocaleString()} s`}
                  </MenuItem>
                )}
              </For>
            </FloatingSelect>
          </SelectWidth>
        )}
      />
      <Show when={bridge}>
        <SettingsRow
          icon={<Icon name="check-circle" size={20} />}
          title={<Trans>Test your keys</Trans>}
          description={
            <>
              <Show
                when={testing()}
                fallback={
                  <Trans>
                    Shows whether Zrzur hears a key while another window is in
                    front. Works outside a call.
                  </Trans>
                }
              >
                <Trans>
                  Switch to your game or any other window, hold each key, then
                  come back.
                </Trans>
                <Results aria-live="polite" data-testid="game-keys-test">
                  <For each={GAME_KEY_ACTIONS.filter((a) => shown(a))}>
                    {(action) => (
                      <Result data-heard={heard()[action] ?? "no"}>
                        <span>{names[action]()}</span>
                        <span>
                          {heard()[action] === "away"
                            ? t`Heard in another window`
                            : heard()[action] === "here"
                              ? t`Heard in the Zrzur window only`
                              : t`Not heard yet`}
                        </span>
                      </Result>
                    )}
                  </For>
                </Results>
              </Show>
            </>
          }
          disabled={!usable() || !voice.gameKeys}
          control={() => (
            <Button
              size="sm"
              variant="tonal"
              isDisabled={!usable() || !voice.gameKeys}
              onPress={() => (testing() ? endTest() : startTest())}
              data-testid="game-keys-test-button"
            >
              {testing() ? t`Stop test` : t`Start test`}
            </Button>
          )}
        />
      </Show>
    </SettingsSection>
  );
}

const SelectWidth = styled("div", {
  base: {
    width: "min(220px, 36vw)",
  },
});

const Controls = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "8px",
  },
});

const Waiting = styled("span", {
  base: {
    color: "var(--z-fg-muted, var(--md-sys-color-on-surface-variant))",
    fontSize: "14px",
  },
});

const StatusLine = styled("span", {
  base: {
    display: "block",
    color: "var(--z-fg, var(--md-sys-color-on-surface))",
    "&[data-state='on']": {
      color: "var(--z-status-success, var(--md-sys-color-on-surface))",
    },
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
    minWidth: "32px",
    height: "32px",
    paddingInline: "10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px",
    background: "var(--z-card-bg, var(--md-sys-color-surface-container-high))",
    border:
      "1px solid var(--z-border-subtle, var(--md-sys-color-outline-variant))",
    boxShadow: "inset 0 -1px 0 var(--z-border-subtle, rgb(0 0 0 / 0.25))",
    color: "var(--z-fg, var(--md-sys-color-on-surface))",
    fontFamily: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
});

const Results = styled("span", {
  base: {
    display: "grid",
    gap: "4px",
    marginBlockStart: "8px",
  },
});

const Result = styled("span", {
  base: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    color: "var(--z-fg-muted, var(--md-sys-color-on-surface-variant))",
    "&[data-heard='away']": {
      color: "var(--z-status-success, var(--md-sys-color-on-surface))",
    },
    "&[data-heard='here']": {
      color: "var(--z-fg, var(--md-sys-color-on-surface))",
    },
  },
});
