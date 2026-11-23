import { type Accessor, createMemo, createRoot } from "solid-js";

import {
  bindKeymap,
  compiler,
  defaultKeymap,
  devicePlatform,
} from "../../keybinds/active";
import {
  type CustomCombos,
  type Keymap,
  type Platform,
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
  #table?: Accessor<Keymap>;

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
    // (every real caller asks for this device's table)
    bindKeymap(() => this.table());
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
      custom: custom && typeof custom === "object" ? custom : {},
    };
    if (typeof input?.pttKey === "string" && pttKeyAllowed(input.pttKey))
      data.pttKey = input.pttKey;
    return data;
  }

  /**
   * The lookup table for this system. Compiled when the shortcuts change,
   * never on a key press.
   */
  table(): Keymap {
    const platform = devicePlatform();
    this.#table ??= createRoot(() =>
      createMemo(() => {
        // reading the whole object tracks every change to it
        const custom = JSON.parse(JSON.stringify(this.get()?.custom ?? {}));
        const compile = compiler();
        if (compile) return compile(custom, platform);
        // the person has their own shortcuts: load the compiler (the
        // defaults apply for the few milliseconds until it is there)
        if (Object.keys(custom).length)
          void import("../../keybinds/keymapCompile");
        return defaultKeymap(platform);
      }),
    );
    return this.#table();
  }

  /**
   * The table another system would use with the same shortcuts (the
   * shortcuts screen can show the Mac, Windows or Linux set). This device's
   * own system is the live table.
   */
  tableFor(platform: Platform): Keymap {
    if (platform === devicePlatform()) return this.table();
    const custom = JSON.parse(JSON.stringify(this.get()?.custom ?? {}));
    const compile = compiler();
    return compile ? compile(custom, platform) : defaultKeymap(platform);
  }

  /** The synced push-to-talk key, if one was chosen on any device */
  get pttKey(): string | undefined {
    return this.get().pttKey;
  }
}
