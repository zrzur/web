import { describe, expect, it, vi } from "vitest";

import { applySaved } from "./applySaved";

describe("loading saved settings (review S5)", () => {
  it("keeps cleaned data on this device without sending it to sync", () => {
    const setStore = vi.fn();
    const saveHere = vi.fn();
    const write = vi.fn(); // the path that also touches sync
    applySaved(
      "keybinds",
      { custom: { toggle_mute: { code: "KeyK" } } },
      () => ({ custom: {} }),
      { setStore, saveHere, write },
    );
    expect(setStore).toHaveBeenCalledWith("keybinds", { custom: {} });
    expect(saveHere).toHaveBeenCalledWith("keybinds");
    expect(write).not.toHaveBeenCalled();
  });

  it("stores clean data as it is, without a write", () => {
    const setStore = vi.fn();
    const saveHere = vi.fn();
    const write = vi.fn();
    applySaved("keybinds", { custom: {} }, (d) => d, {
      setStore,
      saveHere,
      write,
    });
    expect(setStore).toHaveBeenCalledWith("keybinds", { custom: {} });
    expect(saveHere).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });
});
