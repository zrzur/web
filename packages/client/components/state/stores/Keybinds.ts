import { type Accessor, createMemo, createRoot } from "solid-js";

import { bindKeymap, deviceMac } from "../../keybinds/active";
import {
  type Combo,
  type CustomCombos,
  type Keymap,
  type ShortcutId,
  cleanCustom,
  compileKeymap,
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
    const data: TypeKeybinds = {
      custom: cleanCustom(input?.custom, deviceMac()),
    };
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
    return this.table().custom.has(id);
  }

  /** The person's own combinations (cleaned for this system) */
  get customCombos(): CustomCombos {
    return cleanCustom(this.get().custom, deviceMac());
  }

  /**
   * Replace the whole set of changes (edits live in keymapRules.ts, loaded
   * with the shortcuts screen). Written one level up: a store setter given
   * an object merges it, which would keep a removed shortcut.
   */
  replaceCustom(custom: CustomCombos) {
    this.set({ custom });
  }

  /** The synced push-to-talk key, if one was chosen on any device */
  get pttKey(): string | undefined {
    return this.get().pttKey;
  }

  set pttKey(value: string | undefined) {
    if (value === undefined || pttKeyAllowed(value)) this.set("pttKey", value);
  }
}
