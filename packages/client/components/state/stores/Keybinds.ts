import { type Accessor, createMemo, createRoot } from "solid-js";

import {
  bindKeymap,
  compiler,
  defaultKeymap,
  deviceMac,
} from "../../keybinds/active";
import {
  type Combo,
  type CustomCombos,
  type Keymap,
  type ShortcutId,
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
  }

  /**
   * Every key listener reads the compiled table from now on
   */
  hydrate(): void {
    bindKeymap((mac) => this.table(mac));
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
    // combinations are checked when compiled (keymapCompile.ts); here only
    // the shape, so this stays small in the first download
    const custom = input?.custom;
    const data: TypeKeybinds = {
      custom:
        custom && typeof custom === "object" && !Array.isArray(custom)
          ? custom
          : {},
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
        createMemo(() => {
          // reading the whole object tracks every change to it
          const custom = JSON.parse(JSON.stringify(this.get()?.custom ?? {}));
          const compile = compiler();
          if (compile) return compile(custom, mac);
          // the person has their own shortcuts: load the compiler (the
          // defaults apply for the few milliseconds until it is there)
          if (Object.keys(custom).length)
            void import("../../keybinds/keymapCompile");
          return defaultKeymap(mac);
        }),
      );
      this.#tables[slot] = table;
    }
    return table();
  }

  /** The combination a shortcut has now */
  combo(id: ShortcutId): Combo {
    return this.table().byId[id];
  }

  /** The person's own combinations as stored (keymapRules.ts cleans them) */
  get custom(): CustomCombos {
    return this.get().custom ?? {};
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

  /** (the voice store checks the key first) */
  set pttKey(value: string | undefined) {
    this.set("pttKey", value);
  }
}
