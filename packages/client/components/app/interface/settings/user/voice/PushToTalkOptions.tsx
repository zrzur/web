import { Show, createSignal, onCleanup } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { globalPttCombo, keyLabel } from "@revolt/keybinds/keyLabels";
import { readPttKey } from "@revolt/keybinds/keymapRules";
import { isMac } from "@revolt/keybinds/shortcuts";
import { useVoice } from "@revolt/rtc";
import {
  desktopPushToTalk,
  globalTalkAllowed,
  globalTalkBlock,
} from "@revolt/rtc/desktopPushToTalk";
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

/**
 * Voice activity or push to talk, and the key to hold
 */
export function PushToTalkOptions() {
  const { voice } = useState();
  const call = useVoice();
  const { t } = useLingui();
  // the desktop app adds a toggle that works from other apps
  const desktop = !!desktopPushToTalk();
  const combo = () => globalPttCombo(voice.pttKey, isMac());
  const [recording, setRecording] = createSignal(false);
  const [refused, setRefused] = createSignal(false);

  // the next key press becomes the push-to-talk key; caught before
  // anything else so Esc cancels here instead of closing settings
  const onKey = (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    // its key-up is caught too: Enter or Space released on the focused
    // "Change key" button would otherwise press it again
    swallowUp.add(event.code);
    const result = readPttKey(event);
    if (result === "wait") return;
    if (result === "blocked") {
      setRefused(true);
      return;
    }
    if (result !== "cancel") voice.pttKey = result.code;
    stop();
  };
  const swallowUp = new Set<string>();
  const onKeyUp = (event: KeyboardEvent) => {
    if (!swallowUp.delete(event.code)) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const stop = () => {
    window.removeEventListener("keydown", onKey, true);
    setRecording(false);
  };
  const start = () => {
    setRefused(false);
    setRecording(true);
    swallowUp.clear();
    window.addEventListener("keydown", onKey, true);
  };
  window.addEventListener("keyup", onKeyUp, true);
  onCleanup(() => {
    stop();
    window.removeEventListener("keyup", onKeyUp, true);
  });

  return (
    <SettingsSection
      title={<Trans>Push to talk</Trans>}
      description={
        <Trans>
          Push to talk works while Zrzur is the active window and you are not
          typing.
        </Trans>
      }
    >
      <SettingsRow
        icon={<Icon name="microphone" size={20} />}
        title={<Trans>Input mode</Trans>}
        description={
          voice.inputMode === "ptt"
            ? t`Others hear you only while you hold the key.`
            : t`Your microphone sends whenever you speak.`
        }
        control={(ids) => (
          <SelectWidth>
            <FloatingSelect
              aria-labelledby={ids.labelId}
              value={voice.inputMode}
              onChange={(e) => {
                const v = e.currentTarget.value;
                if (v === "voice" || v === "ptt") voice.inputMode = v;
              }}
            >
              <MenuItem value="voice">
                <Trans>Voice activity</Trans>
              </MenuItem>
              <MenuItem value="ptt">
                <Trans>Push to talk</Trans>
              </MenuItem>
            </FloatingSelect>
          </SelectWidth>
        )}
      />
      <Show when={voice.inputMode === "ptt"}>
        <SettingsRow
          icon={<Icon name="keyboard" size={20} />}
          title={<Trans>Push-to-talk key</Trans>}
          description={
            recording()
              ? refused()
                ? t`That key is needed elsewhere. Press another key, or Esc to cancel.`
                : t`Press the key you want to hold. Esc cancels.`
              : undefined
          }
          control={(ids) => (
            <Controls>
              <Show
                when={!recording()}
                fallback={
                  <Waiting aria-live="polite">
                    <Trans>Press a key…</Trans>
                  </Waiting>
                }
              >
                <Cap dir="ltr" aria-labelledby={ids.labelId}>
                  {keyLabel(voice.pttKey)}
                </Cap>
              </Show>
              <Button
                size="sm"
                variant="tonal"
                onPress={() => (recording() ? stop() : start())}
              >
                {recording() ? t`Cancel` : t`Change key`}
              </Button>
            </Controls>
          )}
        />
      </Show>
      {/* desktop app only: a toggle that works while Zrzur is in the
          background (Electron sees no key release outside the window) */}
      <Show when={desktop && voice.inputMode === "ptt"}>
        <SettingsRow
          icon={<Icon name="desktop" size={20} />}
          title={<Trans>Talk from other apps</Trans>}
          description={
            globalTalkBlock(voice.pttKey) === "app"
              ? t`${combo()} is one of your Zrzur shortcuts. Choose another key to use this.`
              : !globalTalkAllowed(voice.pttKey)
                ? t`Other apps use ${combo()} for editing. Choose another key to use this.`
                : voice.globalTalk && call?.globalPtt() === "unavailable"
                  ? t`${combo()} is not available from other apps. Try another key.`
                  : t`${combo()} turns talking on and off while Zrzur is in the background.`
          }
          disabled={!globalTalkAllowed(voice.pttKey)}
          onClick={() => (voice.globalTalk = !voice.globalTalk)}
          control={(ids) => (
            <Toggle
              checked={voice.globalTalk && globalTalkAllowed(voice.pttKey)}
              disabled={!globalTalkAllowed(voice.pttKey)}
              onChange={() => (voice.globalTalk = !voice.globalTalk)}
              aria-labelledby={ids.labelId}
              aria-describedby={ids.descriptionId}
            />
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
    gap: "8px",
  },
});

const Waiting = styled("span", {
  base: {
    color: "var(--z-fg-muted, var(--md-sys-color-on-surface-variant))",
    fontSize: "14px",
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
  },
});
