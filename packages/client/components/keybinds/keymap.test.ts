import { describe, expect, it } from "vitest";

import {
  type Combo,
  REMAPPABLE,
  ariaKeys,
  compileKeymap,
  defaultCombo,
  matchShortcut,
} from "./keymap";
import {
  checkCombo,
  comboKeys,
  readCombo,
  sameCombo,
  swapCombos,
} from "./keymapRules";

const press = (
  code: string,
  mods: Partial<
    Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "shiftKey" | "altKey">
  > & { key?: string } = {},
) => ({
  code,
  key: mods.key ?? "",
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

const WIN = false;
const MAC = true;

describe("compileKeymap", () => {
  it("finds every default shortcut by its key combination", () => {
    const map = compileKeymap({}, WIN);
    expect(
      matchShortcut(map, press("KeyM", { ctrlKey: true, shiftKey: true }), WIN),
    ).toBe("toggle_mute");
    expect(
      matchShortcut(map, press("KeyD", { ctrlKey: true, shiftKey: true }), WIN),
    ).toBe("toggle_deafen");
    expect(
      matchShortcut(map, press("KeyL", { ctrlKey: true, shiftKey: true }), WIN),
    ).toBe("toggle_streamer");
    expect(
      matchShortcut(
        map,
        press("Digit8", { ctrlKey: true, shiftKey: true, key: "*" }),
        WIN,
      ),
    ).toBe("create_poll");
    expect(matchShortcut(map, press("ArrowUp", { altKey: true }), WIN)).toBe(
      "navigation_channel_up",
    );
    expect(
      matchShortcut(
        map,
        press("ArrowDown", { ctrlKey: true, altKey: true }),
        WIN,
      ),
    ).toBe("navigation_server_down");
    expect(matchShortcut(map, press("Escape", { shiftKey: true }), WIN)).toBe(
      "chat_mark_server_as_read",
    );
  });

  it("is one lookup table: a key nobody uses finds nothing", () => {
    const map = compileKeymap({}, WIN);
    expect(map.byCombo.size).toBe(REMAPPABLE.length);
    expect(matchShortcut(map, press("KeyQ", { ctrlKey: true }), WIN)).toBe(
      undefined,
    );
  });

  it("uses Command on a Mac and Control+Option to move between servers", () => {
    const map = compileKeymap({}, MAC);
    expect(
      matchShortcut(map, press("KeyM", { metaKey: true, shiftKey: true }), MAC),
    ).toBe("toggle_mute");
    expect(
      matchShortcut(map, press("KeyM", { ctrlKey: true, shiftKey: true }), MAC),
    ).toBe(undefined);
    expect(
      matchShortcut(
        map,
        press("ArrowUp", { ctrlKey: true, altKey: true }),
        MAC,
      ),
    ).toBe("navigation_server_up");
  });

  it("never matches the Windows key off a Mac", () => {
    const map = compileKeymap({}, WIN);
    expect(
      matchShortcut(
        map,
        press("KeyM", { ctrlKey: true, metaKey: true, shiftKey: true }),
        WIN,
      ),
    ).toBe(undefined);
  });

  it("takes the person's own combination instead of the default", () => {
    const mine: Combo = { code: "KeyJ", mod: true, shift: true };
    const map = compileKeymap({ toggle_mute: mine }, WIN);
    expect(
      matchShortcut(map, press("KeyJ", { ctrlKey: true, shiftKey: true }), WIN),
    ).toBe("toggle_mute");
    expect(
      matchShortcut(map, press("KeyM", { ctrlKey: true, shiftKey: true }), WIN),
    ).toBe(undefined);
  });

  it("drops unknown ids and broken combos from synced data", () => {
    const map = compileKeymap(
      {
        nope: { code: "KeyA", mod: true },
        toggle_deafen: { code: "" },
      } as never,
      WIN,
    );
    expect(map.byId.toggle_deafen).toEqual(defaultCombo("toggle_deafen", WIN));
  });

  it("reads a Mac's Control as Ctrl on Windows (synced across devices)", () => {
    const map = compileKeymap(
      { toggle_mute: { code: "KeyK", ctrl: true, shift: true } },
      WIN,
    );
    expect(
      matchShortcut(map, press("KeyK", { ctrlKey: true, shiftKey: true }), WIN),
    ).toBe("toggle_mute");
  });
});

describe("non-US keyboard layouts", () => {
  it("matches the physical key on an Arabic layout", () => {
    const map = compileKeymap({}, WIN);
    expect(
      matchShortcut(
        map,
        press("KeyM", { ctrlKey: true, shiftKey: true, key: "ة" }),
        WIN,
      ),
    ).toBe("toggle_mute");
  });

  it("opens the shortcuts screen with Ctrl+/ where / is Shift+7", () => {
    const map = compileKeymap({}, WIN);
    expect(
      matchShortcut(
        map,
        press("Digit7", { ctrlKey: true, shiftKey: true, key: "/" }),
        WIN,
      ),
    ).toBe("open_shortcuts");
  });

  it("a person's own combination wins over the / rule (German Ctrl+Shift+7)", () => {
    // review B1: the custom hit is looked up first
    const map = compileKeymap(
      {
        create_poll: { code: "Digit7", mod: true, shift: true },
        open_shortcuts: { code: "Digit8", mod: true, shift: true },
      },
      WIN,
    );
    expect(
      matchShortcut(
        map,
        press("Digit7", { ctrlKey: true, shiftKey: true, key: "/" }),
        WIN,
      ),
    ).toBe("create_poll");
    expect(
      matchShortcut(
        map,
        press("Digit8", { ctrlKey: true, shiftKey: true, key: "(" }),
        WIN,
      ),
    ).toBe("open_shortcuts");
  });

  it("keeps Ctrl+/ by the character on a miss or a default hit", () => {
    const map = compileKeymap({}, WIN);
    // a default on the same keys never takes a press that types "/"
    expect(
      matchShortcut(
        compileKeymap({}, WIN),
        press("Digit7", { ctrlKey: true, shiftKey: true, key: "/" }),
        WIN,
      ),
    ).toBe("open_shortcuts");
    expect(
      matchShortcut(map, press("Slash", { ctrlKey: true, key: "/" }), WIN),
    ).toBe("open_shortcuts");
  });

  it("does nothing while a text is being composed (IME)", () => {
    const map = compileKeymap({}, WIN);
    expect(
      matchShortcut(
        map,
        {
          ...press("KeyM", { ctrlKey: true, shiftKey: true }),
          isComposing: true,
        },
        WIN,
      ),
    ).toBe(undefined);
  });
});

describe("synced combinations that can't work here (review B2)", () => {
  it("drops keys without Ctrl, Alt or Cmd, except F keys", () => {
    const map = compileKeymap(
      {
        toggle_mute: { code: "KeyK" },
        toggle_deafen: { code: "KeyK", shift: true },
        create_poll: { code: "F8" },
      },
      WIN,
    );
    expect(map.byId.toggle_mute).toEqual(defaultCombo("toggle_mute", WIN));
    expect(map.byId.toggle_deafen).toEqual(defaultCombo("toggle_deafen", WIN));
    expect(map.byId.create_poll).toEqual({ code: "F8" });
  });

  it("drops copy, paste and the other editing keys, AltGr and browser-kept keys", () => {
    for (const combo of [
      { code: "KeyC", mod: true },
      { code: "KeyV", mod: true },
      { code: "KeyA", mod: true },
      { code: "KeyX", mod: true },
      { code: "KeyZ", mod: true },
      { code: "KeyY", mod: true },
      { code: "KeyQ", mod: true, alt: true },
      { code: "KeyW", mod: true },
      { code: "KeyT", mod: true, shift: true },
    ])
      expect(
        compileKeymap({ toggle_mute: combo }, WIN).byId.toggle_mute,
        JSON.stringify(combo),
      ).toEqual(defaultCombo("toggle_mute", WIN));
  });

  it("flags two shortcuts that end up on the same keys here (review S2)", () => {
    // written on a Mac with Control, and with Cmd: the same keys on Windows
    const map = compileKeymap(
      {
        toggle_mute: { code: "KeyJ", ctrl: true, shift: true },
        toggle_deafen: { code: "KeyJ", mod: true, shift: true },
      },
      WIN,
    );
    expect(map.conflicts.get("toggle_mute")).toBe("toggle_deafen");
    expect(map.conflicts.get("toggle_deafen")).toBe("toggle_mute");
    // on a Mac they are two different combinations
    expect(
      compileKeymap(
        {
          toggle_mute: { code: "KeyJ", ctrl: true, shift: true },
          toggle_deafen: { code: "KeyJ", mod: true, shift: true },
        },
        MAC,
      ).conflicts.size,
    ).toBe(0);
  });

  it("flags a synced combination that takes another shortcut's default", () => {
    const map = compileKeymap(
      { toggle_mute: { code: "KeyD", mod: true, shift: true } },
      WIN,
    );
    expect(map.conflicts.get("toggle_mute")).toBe("toggle_deafen");
  });
});

describe("readCombo (recording a new combination)", () => {
  it("waits while only modifiers are held", () => {
    expect(readCombo(press("ShiftLeft", { shiftKey: true }), WIN)).toBe("wait");
    expect(readCombo(press("ControlRight", { ctrlKey: true }), WIN)).toBe(
      "wait",
    );
  });

  it("cancels on a plain Escape", () => {
    expect(readCombo(press("Escape"), WIN)).toBe("cancel");
  });

  it("records the physical key and the modifiers", () => {
    expect(
      readCombo(press("KeyK", { ctrlKey: true, shiftKey: true }), WIN),
    ).toEqual({ code: "KeyK", mod: true, shift: true });
    expect(
      readCombo(press("KeyK", { metaKey: true, ctrlKey: true }), MAC),
    ).toEqual({ code: "KeyK", mod: true, ctrl: true });
  });
});

describe("checkCombo", () => {
  const map = compileKeymap({}, WIN);

  it("finds a clash with another shortcut", () => {
    const result = checkCombo(
      "toggle_mute",
      { code: "KeyD", mod: true, shift: true },
      map,
      WIN,
    );
    expect(result.clash).toBe("toggle_deafen");
    expect(result.blocked).toBe(undefined);
  });

  it("is no clash to pick a shortcut's own combination again", () => {
    expect(
      checkCombo(
        "toggle_mute",
        { code: "KeyM", mod: true, shift: true },
        map,
        WIN,
      ).clash,
    ).toBe(undefined);
  });

  it("refuses keys the browser or the system keeps", () => {
    expect(
      checkCombo("toggle_mute", { code: "KeyW", mod: true }, map, WIN).blocked,
    ).toBe("browser");
    expect(
      checkCombo(
        "toggle_mute",
        { code: "KeyT", mod: true, shift: true },
        map,
        WIN,
      ).blocked,
    ).toBe("browser");
    expect(
      checkCombo("toggle_mute", { code: "F4", alt: true }, map, WIN).blocked,
    ).toBe("system");
    expect(
      checkCombo("toggle_mute", { code: "KeyQ", mod: true }, map, MAC).blocked,
    ).toBe("system");
    expect(
      checkCombo(
        "toggle_mute",
        { code: "Digit4", mod: true, shift: true },
        map,
        MAC,
      ).blocked,
    ).toBe("system");
  });

  it("refuses plain keys that are needed for typing", () => {
    expect(checkCombo("toggle_mute", { code: "KeyK" }, map, WIN).blocked).toBe(
      "typing",
    );
    expect(
      checkCombo("toggle_mute", { code: "KeyK", shift: true }, map, WIN)
        .blocked,
    ).toBe("typing");
    expect(checkCombo("toggle_mute", { code: "Enter" }, map, WIN).blocked).toBe(
      "typing",
    );
    // Ctrl+Alt is AltGr on Windows, which types @, € and { on many layouts
    expect(
      checkCombo(
        "toggle_mute",
        { code: "KeyQ", mod: true, alt: true },
        map,
        WIN,
      ).blocked,
    ).toBe("typing");
    // Option+letter types characters on a Mac
    expect(
      checkCombo("toggle_mute", { code: "KeyK", alt: true }, map, MAC).blocked,
    ).toBe("typing");
  });

  it("refuses copy, paste, cut, select all, undo and redo (review S1)", () => {
    for (const code of ["KeyA", "KeyC", "KeyV", "KeyX", "KeyZ", "KeyY"]) {
      expect(
        checkCombo("toggle_mute", { code, mod: true }, map, WIN).blocked,
        code,
      ).toBe("typing");
      expect(
        checkCombo("toggle_mute", { code, mod: true }, map, MAC).blocked,
        code,
      ).toBe("typing");
    }
  });

  it("refuses the push-to-talk key as a shortcut on its own (review S6)", () => {
    expect(
      checkCombo("toggle_mute", { code: "F8" }, map, WIN, { pttKey: "F8" })
        .blocked,
    ).toBe("ptt");
    // with a modifier it is another combination
    expect(
      checkCombo("toggle_mute", { code: "F8", mod: true }, map, WIN, {
        pttKey: "F8",
      }).blocked,
    ).toBe(undefined);
  });

  it("reports Ctrl+/ for a press that types / (German Ctrl+Shift+7)", () => {
    expect(
      checkCombo(
        "create_poll",
        { code: "Digit7", mod: true, shift: true },
        map,
        WIN,
        { typesSlash: true },
      ).clash,
    ).toBe("open_shortcuts");
  });

  it("warns on Alt+letter on Windows (it opens browser menus)", () => {
    expect(
      checkCombo("toggle_mute", { code: "KeyK", alt: true }, map, WIN).warn,
    ).toBe("browser");
  });

  it("allows function keys alone", () => {
    expect(checkCombo("toggle_mute", { code: "F8" }, map, WIN)).toEqual({});
  });

  it("warns when a combination replaces a browser shortcut", () => {
    expect(
      checkCombo("toggle_mute", { code: "KeyF", mod: true }, map, WIN).warn,
    ).toBe("browser");
    expect(
      checkCombo("toggle_mute", { code: "KeyR", mod: true }, map, WIN).warn,
    ).toBe("browser");
  });

  it("keeps a shortcut's own default without a warning", () => {
    expect(
      checkCombo(
        "chat_mark_server_as_read",
        { code: "Escape", shift: true },
        map,
        WIN,
      ),
    ).toEqual({});
  });
});

describe("swapCombos", () => {
  it("gives the other shortcut this one's old combination", () => {
    const map = compileKeymap({}, WIN);
    const custom = swapCombos(
      {},
      "toggle_mute",
      "toggle_deafen",
      { code: "KeyD", mod: true, shift: true },
      map,
    );
    const next = compileKeymap(custom, WIN);
    expect(
      sameCombo(next.byId.toggle_mute, {
        code: "KeyD",
        mod: true,
        shift: true,
      }),
    ).toBe(true);
    expect(
      sameCombo(next.byId.toggle_deafen, {
        code: "KeyM",
        mod: true,
        shift: true,
      }),
    ).toBe(true);
  });
});

describe("comboKeys", () => {
  it("lists the keys in a fixed order for the key caps", () => {
    expect(comboKeys({ code: "KeyM", mod: true, shift: true })).toEqual([
      "Mod",
      "Shift",
      "M",
    ]);
    expect(comboKeys({ code: "ArrowUp", ctrl: true, alt: true })).toEqual([
      "Ctrl",
      "Alt",
      "↑",
    ]);
    expect(comboKeys({ code: "Escape", shift: true })).toEqual([
      "Shift",
      "Esc",
    ]);
  });
});

describe("ariaKeys", () => {
  it("follows the person's keys for aria-keyshortcuts", () => {
    expect(ariaKeys({ code: "Digit9", mod: true, shift: true }, WIN)).toBe(
      "Control+Shift+9",
    );
    expect(ariaKeys({ code: "KeyJ", mod: true, alt: true }, MAC)).toBe(
      "Meta+Alt+J",
    );
  });
});
