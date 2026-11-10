import { createStore } from "solid-js/store";
import { describe, expect, it } from "vitest";

import {
  resetAllShortcuts,
  setCombo,
  shortcutsChanged,
} from "../../keybinds/keymapRules";

import { SYNCED_KEYS } from ".";
import { Keybinds } from "./Keybinds";
import { Voice } from "./Voice";

function fakeState() {
  const [store, setStore] = createStore<Record<string, unknown>>({
    keybinds: { custom: {} },
    voice: {},
  });
  const state: Record<string, unknown> = {
    get: (key: string) => store[key],
    set: (...args: unknown[]) =>
      (setStore as unknown as (...a: unknown[]) => void)(...args),
  };
  state.keybinds = new Keybinds(state as never);
  state.voice = new Voice(state as never);
  return state as unknown as { keybinds: Keybinds; voice: Voice };
}

const ctrlShift = (code: string) => ({ code, mod: true, shift: true });

describe("Keybinds store", () => {
  it("is synced with the account", () => {
    expect(SYNCED_KEYS).toContain("keybinds");
  });

  it("drops unknown shortcuts and broken data from another device", () => {
    const state = fakeState();
    const raw = state.keybinds.clean({
      custom: {
        toggle_mute: ctrlShift("KeyJ"),
        later_feature: ctrlShift("KeyQ"),
        toggle_deafen: { code: 5 },
      } as never,
      pttKey: "Escape",
    });
    // the push-to-talk key is checked at once, combinations when compiled
    expect(raw.pttKey).toBe(undefined);
    expect(state.keybinds.clean({ custom: "broken" as never }).custom).toEqual(
      {},
    );
    state.keybinds.setFromSync(raw);
    const table = state.keybinds.table();
    expect([...table.custom]).toEqual(["toggle_mute"]);
    expect(table.byId.toggle_deafen).toEqual(ctrlShift("KeyD"));
  });

  it("compiles the table again when the shortcuts change, also from sync", () => {
    const state = fakeState();
    const before = state.keybinds.table();
    expect(state.keybinds.table()).toBe(before); // cached, not rebuilt
    setCombo(state.keybinds, "toggle_mute", ctrlShift("KeyJ"));
    expect(state.keybinds.table().byId.toggle_mute).toEqual(ctrlShift("KeyJ"));
    state.keybinds.setFromSync({ custom: { toggle_mute: ctrlShift("KeyU") } });
    expect(state.keybinds.table().byId.toggle_mute).toEqual(ctrlShift("KeyU"));
  });

  it("stores nothing for a shortcut set back to its default", () => {
    const state = fakeState();
    setCombo(state.keybinds, "toggle_mute", ctrlShift("KeyJ"));
    setCombo(state.keybinds, "toggle_mute", ctrlShift("KeyM"));
    expect(state.keybinds.table().custom.has("toggle_mute")).toBe(false);
  });

  it("keeps the push-to-talk key with the synced shortcuts", () => {
    const state = fakeState();
    expect(state.voice.pttKey).toBe("Backquote");
    state.voice.pttKey = "KeyV";
    expect(state.keybinds.pttKey).toBe("KeyV");
    expect(state.voice.pttKey).toBe("KeyV");
    resetAllShortcuts(state.keybinds);
    expect(state.voice.pttKey).toBe("Backquote");
    expect(shortcutsChanged(state.keybinds, state.voice.pttKey)).toBe(false);
  });

  it("still reads a push-to-talk key this device saved before keys were synced", () => {
    const state = fakeState();
    (state as unknown as { set: (...a: unknown[]) => void }).set(
      "voice",
      "pttKey",
      "KeyB",
    );
    expect(state.voice.pttKey).toBe("KeyB");
  });
});
