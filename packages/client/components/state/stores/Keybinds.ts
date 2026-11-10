import { type Accessor, createMemo, createRoot } from "solid-js";

import { bindKeymap, deviceMac } from "../../keybinds/active";
import {
  type Combo,
  type CustomCombos,
  type Keymap,
  type ShortcutId,
  cleanCustom,
  compileKeymap,
  defaultCombo,
  sameCombo,
  swapCombos,
} from "../../keybinds/keymap";
import { pttKeyAllowed } from "../../keybinds/shortcuts";

import { State } from "..";

import { AbstractSyncedStore } from ".";

export type TypeKeybinds = {
  /** Shortcuts the person changed (the others keep their default) */
  custom: CustomCombos;
  /** Physical key (`KeyboardEvent.code`) held to talk; unset = the old device value or ` */
  pttKey?: string;
};

/**
 * The person's own keyboard shortcuts. A synced key, so they follow the
 * account to every device; the desktop app's global talk combination reads
 * the push-to-talk key from here too (through the voice store).
 */
export class Keybinds extends AbstractSyncedStore<"keybinds", TypeKeybinds> {
  #tables: Partial<Record<"mac" | "other", Accessor<Keymap>>> = {};

  /**
   * Construct store
   * @param state State
   */
  constructor(state: State) {
    super(state, "keybinds");
    this.table = this.table.bind(this);
  }

  /**
   * Every key listener reads the compiled table from now on
   */
  hydrate(): void {
    bindKeymap(this.table);
  }

  /**
   * Generate default values
   */
  default(): TypeKeybinds {
    return { custom: {} };
  }

  /**
   * Validate the given data to see if it is compliant and return a compliant object
   */
  clean(input: Partial<TypeKeybinds>): TypeKeybinds {
    const data: TypeKeybinds = { custom: cleanCustom(input?.custom) };
    if (typeof input?.pttKey === "string" && pttKeyAllowed(input.pttKey))
      data.pttKey = input.pttKey;
    return data;
  }

  /**
   * The lookup table for this system. Compiled when the shortcuts change,
   * never on a key press.
   */
  table(mac: boolean = deviceMac()): Keymap {
    const slot = mac ? "mac" : "other";
    let table = this.#tables[slot];
    if (!table) {
      table = createRoot(() =>
        createMemo(() =>
          // reading the whole object tracks every change to it
          compileKeymap(
            JSON.parse(JSON.stringify(this.get()?.custom ?? {})),
            mac,
          ),
        ),
      );
      this.#tables[slot] = table;
    }
    return table();
  }

  /** The combination a shortcut has now */
  combo(id: ShortcutId): Combo {
    return this.table().byId[id];
  }

  /** Whether the person changed this shortcut */
  isCustom(id: ShortcutId): boolean {
    return !!this.get().custom?.[id];
  }

  /** The person's changes, without the ones equal to the default again */
  #withoutDefaults(custom: CustomCombos): CustomCombos {
    const mac = deviceMac();
    const out: CustomCombos = {};
    for (const [id, combo] of Object.entries(cleanCustom(custom)) as [
      ShortcutId,
      Combo,
    ][])
      if (!sameCombo(combo, defaultCombo(id, mac))) out[id] = combo;
    return out;
  }

  /**
   * Replace the whole set of changes. Written one level up: a store setter
   * given an object merges it, which would keep a removed shortcut.
   */
  #setCustom(custom: CustomCombos) {
    this.set({ custom });
  }

  /** Give a shortcut a new combination */
  setCombo(id: ShortcutId, combo: Combo) {
    this.#setCustom(
      this.#withoutDefaults({ ...this.get().custom, [id]: combo }),
    );
  }

  /**
   * Give a shortcut the combination another one has; that one gets this
   * shortcut's old combination
   */
  swap(id: ShortcutId, other: ShortcutId, combo: Combo) {
    this.#setCustom(
      this.#withoutDefaults(
        swapCombos(this.get().custom, id, other, combo, this.table()),
      ),
    );
  }

  /** One shortcut back to its default */
  reset(id: ShortcutId) {
    const next = { ...cleanCustom(this.get().custom) };
    delete next[id];
    this.#setCustom(next);
  }

  /** Every shortcut, and the push-to-talk key, back to the defaults */
  resetAll() {
    this.state.set("keybinds", { custom: {}, pttKey: "Backquote" });
  }

  /** Whether anything differs from the defaults */
  get changed(): boolean {
    return (
      Object.keys(this.get().custom ?? {}).length > 0 ||
      this.state.voice.pttKey !== "Backquote"
    );
  }

  /** The synced push-to-talk key, if one was chosen on any device */
  get pttKey(): string | undefined {
    return this.get().pttKey;
  }

  set pttKey(value: string | undefined) {
    if (value === undefined || pttKeyAllowed(value)) this.set("pttKey", value);
  }
}
