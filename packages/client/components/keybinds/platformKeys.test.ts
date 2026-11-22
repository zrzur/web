import { describe, expect, it } from "vitest";

import {
  type Platform,
  REMAPPABLE,
  defaultCombo,
  defaultTable,
  keyOf,
  matchShortcut,
} from "./keymap";
import { BROWSER_KEEPS, unusable } from "./keymapCompile";
import { checkCombo, systemKeeps } from "./keymapRules";
import { nextIndex } from "./navigate";
import { platformFrom } from "./shortcuts";

const PLATFORMS: Platform[] = ["mac", "windows", "linux"];

/** Chromium and the desktop app in development open their tools on these */
const DEVTOOLS = new Set(["MS:KeyI", "MS:KeyJ", "MS:KeyC", "MA:KeyI"]);

const press = (
  code: string,
  mods: Partial<
    Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "shiftKey" | "altKey">
  > = {},
) => ({
  code,
  key: "",
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe("conflict guard: every default on every system", () => {
  for (const platform of PLATFORMS) {
    const mac = platform === "mac";
    it(`${platform}: no two shortcuts share keys`, () => {
      const seen = new Map<string, string>();
      for (const id of REMAPPABLE) {
        const key = keyOf(defaultCombo(id, platform), mac);
        expect(seen.get(key), `${id} and ${seen.get(key)}: ${key}`).toBe(
          undefined,
        );
        seen.set(key, id);
      }
      expect(defaultTable(platform).byCombo.size).toBe(REMAPPABLE.length);
    });

    it(`${platform}: none is kept by the system or the browser`, () => {
      for (const id of REMAPPABLE) {
        const key = keyOf(defaultCombo(id, platform), mac);
        expect(systemKeeps(platform).has(key), `${id}: ${key}`).toBe(false);
        expect(BROWSER_KEEPS.has(key), `${id}: ${key}`).toBe(false);
      }
    });

    it(`${platform}: none is needed for typing or opens the developer tools`, () => {
      // Shift+Esc types nothing; it is the only default without Ctrl or Alt
      const plain = REMAPPABLE.filter((id) =>
        unusable(defaultCombo(id, platform), platform),
      );
      expect(plain).toEqual(["chat_mark_server_as_read"]);
      for (const id of REMAPPABLE)
        expect(DEVTOOLS.has(keyOf(defaultCombo(id, platform), mac)), id).toBe(
          false,
        );
    });

    it(`${platform}: a default is accepted as it is`, () => {
      const map = defaultTable(platform);
      for (const id of REMAPPABLE)
        expect(
          checkCombo(id, defaultCombo(id, platform), map, platform),
          id,
        ).toEqual({});
    });
  }

  it("Linux never uses Ctrl+Alt+arrows (workspaces) or Ctrl+Shift+U (IBus)", () => {
    for (const id of REMAPPABLE) {
      const key = keyOf(defaultCombo(id, "linux"), false);
      expect(key, id).not.toMatch(/^MS?A:Arrow/);
      expect(key, id).not.toBe("MS:KeyU");
    }
  });

  it("a Mac never uses Control+arrows (Mission Control) or Option+letter", () => {
    for (const id of REMAPPABLE) {
      const c = defaultCombo(id, "mac");
      expect(!!c.ctrl && !c.mod && /^Arrow/.test(c.code), id).toBe(false);
      expect(!!c.alt && !c.mod && !c.ctrl && /^Key/.test(c.code), id).toBe(
        false,
      );
    }
  });

  it("refuses keys each system keeps when a person records them", () => {
    const linux = defaultTable("linux");
    expect(
      checkCombo(
        "toggle_mute",
        { code: "ArrowUp", mod: true, alt: true },
        linux,
        "linux",
      ).blocked,
    ).toBe("system");
    const mac = defaultTable("mac");
    expect(
      checkCombo("toggle_mute", { code: "ArrowUp", ctrl: true }, mac, "mac")
        .blocked,
    ).toBe("system");
    expect(
      checkCombo("toggle_mute", { code: "KeyW", mod: true }, mac, "mac")
        .blocked,
    ).toBe("browser");
    const win = defaultTable("windows");
    expect(
      checkCombo(
        "toggle_mute",
        { code: "KeyI", mod: true, shift: true },
        win,
        "windows",
      ).warn,
    ).toBe("browser");
  });
});

describe("each system's own set", () => {
  it("channels: Alt+arrows, Option+arrows on a Mac", () => {
    for (const platform of PLATFORMS)
      expect(
        matchShortcut(
          defaultTable(platform),
          press("ArrowDown", { altKey: true }),
          platform,
        ),
      ).toBe("navigation_channel_down");
  });

  it("unread channels: Alt+Shift+arrows, Option+Shift+arrows on a Mac", () => {
    for (const platform of PLATFORMS)
      expect(
        matchShortcut(
          defaultTable(platform),
          press("ArrowUp", { altKey: true, shiftKey: true }),
          platform,
        ),
      ).toBe("navigation_unread_up");
  });

  it("servers: Ctrl+Alt on Windows, Command+Option on a Mac, Alt+Page on Linux", () => {
    expect(
      matchShortcut(
        defaultTable("windows"),
        press("ArrowDown", { ctrlKey: true, altKey: true }),
        "windows",
      ),
    ).toBe("navigation_server_down");
    expect(
      matchShortcut(
        defaultTable("mac"),
        press("ArrowDown", { metaKey: true, altKey: true }),
        "mac",
      ),
    ).toBe("navigation_server_down");
    expect(
      matchShortcut(
        defaultTable("linux"),
        press("PageDown", { altKey: true }),
        "linux",
      ),
    ).toBe("navigation_server_down");
    expect(
      matchShortcut(
        defaultTable("linux"),
        press("ArrowDown", { ctrlKey: true, altKey: true }),
        "linux",
      ),
    ).toBe(undefined);
  });

  it("upload: Ctrl+Shift+U, Command+Shift+U, Ctrl+Alt+U on Linux", () => {
    expect(
      matchShortcut(
        defaultTable("windows"),
        press("KeyU", { ctrlKey: true, shiftKey: true }),
        "windows",
      ),
    ).toBe("upload_file");
    expect(
      matchShortcut(
        defaultTable("mac"),
        press("KeyU", { metaKey: true, shiftKey: true }),
        "mac",
      ),
    ).toBe("upload_file");
    expect(
      matchShortcut(
        defaultTable("linux"),
        press("KeyU", { ctrlKey: true, altKey: true }),
        "linux",
      ),
    ).toBe("upload_file");
  });

  it("emoji, search, mentions and leaving a call", () => {
    const win = defaultTable("windows");
    const mac = defaultTable("mac");
    expect(
      matchShortcut(win, press("KeyE", { ctrlKey: true }), "windows"),
    ).toBe("open_emoji_picker");
    expect(matchShortcut(mac, press("KeyE", { metaKey: true }), "mac")).toBe(
      "open_emoji_picker",
    );
    expect(
      matchShortcut(win, press("KeyF", { ctrlKey: true }), "windows"),
    ).toBe("search_channel");
    expect(matchShortcut(mac, press("KeyF", { metaKey: true }), "mac")).toBe(
      "search_channel",
    );
    expect(
      matchShortcut(
        win,
        press("Digit2", { ctrlKey: true, shiftKey: true }),
        "windows",
      ),
    ).toBe("view_mentions");
    expect(
      matchShortcut(
        mac,
        press("KeyI", { metaKey: true, ctrlKey: true }),
        "mac",
      ),
    ).toBe("view_mentions");
    expect(
      matchShortcut(
        win,
        press("KeyH", { ctrlKey: true, shiftKey: true }),
        "windows",
      ),
    ).toBe("leave_call");
    // Ctrl+I stays italic in the message box
    expect(
      matchShortcut(win, press("KeyI", { ctrlKey: true }), "windows"),
    ).toBe(undefined);
  });

  it("mute and deafen: Ctrl+Shift+M/D, Command+Shift+M/D on a Mac", () => {
    expect(
      matchShortcut(
        defaultTable("mac"),
        press("KeyM", { metaKey: true, shiftKey: true }),
        "mac",
      ),
    ).toBe("toggle_mute");
    expect(
      matchShortcut(
        defaultTable("linux"),
        press("KeyD", { ctrlKey: true, shiftKey: true }),
        "linux",
      ),
    ).toBe("toggle_deafen");
  });

  it("matches the key's place, so an Arabic or German layout works", () => {
    // Arabic: the E key types "ث"; German: Y and Z swap places
    expect(
      matchShortcut(
        defaultTable("windows"),
        { ...press("KeyE", { ctrlKey: true }), key: "ث" },
        "windows",
      ),
    ).toBe("open_emoji_picker");
  });
});

describe("platformFrom", () => {
  it("trusts the desktop app first", () => {
    expect(platformFrom({ desktop: "darwin", platform: "Win32" })).toBe("mac");
    expect(platformFrom({ desktop: "win32" })).toBe("windows");
    expect(platformFrom({ desktop: "linux", platform: "MacIntel" })).toBe(
      "linux",
    );
  });

  it("reads the browser's client hints, then navigator.platform", () => {
    expect(platformFrom({ uaPlatform: "macOS" })).toBe("mac");
    expect(platformFrom({ uaPlatform: "Windows" })).toBe("windows");
    expect(platformFrom({ uaPlatform: "Linux" })).toBe("linux");
    expect(platformFrom({ platform: "MacIntel" })).toBe("mac");
    expect(platformFrom({ platform: "Win32" })).toBe("windows");
    expect(platformFrom({ platform: "Linux x86_64" })).toBe("linux");
    expect(platformFrom({ platform: "iPad" })).toBe("mac");
  });

  it("uses the Windows set for anything else", () => {
    expect(platformFrom({})).toBe("windows");
    expect(platformFrom({ uaPlatform: "Chrome OS" })).toBe("windows");
    expect(platformFrom({ uaPlatform: "Android" })).toBe("windows");
  });
});

describe("nextIndex", () => {
  it("steps and wraps around", () => {
    expect(nextIndex(4, 3, 1)).toBe(0);
    expect(nextIndex(4, 0, -1)).toBe(3);
  });

  it("finds the next match and skips the current item", () => {
    const unread = [false, true, false, false, true];
    expect(nextIndex(5, 1, 1, (i) => unread[i])).toBe(4);
    expect(nextIndex(5, 4, 1, (i) => unread[i])).toBe(1);
    expect(nextIndex(5, 2, -1, (i) => unread[i])).toBe(1);
  });

  it("finds nothing when only the current item matches", () => {
    expect(nextIndex(3, 1, 1, (i) => i === 1)).toBe(-1);
    expect(nextIndex(0, -1, 1)).toBe(-1);
  });

  it("starts at an end when the current item is not in the list", () => {
    expect(nextIndex(3, -1, 1)).toBe(0);
    expect(nextIndex(3, -1, -1)).toBe(2);
  });
});
