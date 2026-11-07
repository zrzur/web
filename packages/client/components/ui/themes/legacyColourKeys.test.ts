import { expect, it } from "vitest";

import { LEGACY_COLOUR_KEYS } from "./legacyColourKeys";
import { legacyThemeUnsetShim } from "./legacyThemeGeneratorCode";

it("lists every colour of the old generator", () => {
  expect([...LEGACY_COLOUR_KEYS]).toEqual(
    Object.keys(legacyThemeUnsetShim().colours),
  );
});
