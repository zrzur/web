import { describe, expect, it } from "vitest";

import { localizedNames } from "./commands";

describe("localizedNames", () => {
  it("lists every language the command is named in", () => {
    expect(
      localizedNames({
        _id: "1",
        name: "hello",
        name_localizations: { ar: "مرحبا", de: "hallo" },
      }),
    ).toBe("ar: مرحبا · de: hallo");
  });

  it("is empty without localisations", () => {
    expect(localizedNames({ _id: "1", name: "hello" })).toBe("");
  });
});
