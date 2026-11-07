import { describe, expect, it, vi } from "vitest";

import { Theme } from "./Theme";

vi.stubGlobal("matchMedia", () => ({
  matches: false,
  addEventListener: () => undefined,
}));

const store = new Theme({} as never);

describe("interface font", () => {
  it("is IBM Plex until someone picks another", () => {
    expect(store.default().interfaceFont).toBe("IBM Plex Sans Variable");
    expect(store.clean({}).interfaceFont).toBe("IBM Plex Sans Variable");
    expect(store.clean({}).monospaceFont).toBe("IBM Plex Mono");
  });

  it("keeps a saved font on an untouched theme", () => {
    for (const interfaceFont of ["Inter", "Open Sans"] as const) {
      const saved = { ...store.default(), interfaceFont };
      expect(store.clean(saved).interfaceFont).toBe(interfaceFont);
    }
    const saved = { ...store.default(), monospaceFont: "Fira Code" as const };
    expect(store.clean(saved).monospaceFont).toBe("Fira Code");
  });
});
