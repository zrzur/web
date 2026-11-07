import { describe, expect, it } from "vitest";

import { updateDurationLocale, useDurationFormat } from "./durations";
import { Language } from "./Languages";

describe("duration format", () => {
  it("follows the active language", () => {
    const duration = useDurationFormat();
    updateDurationLocale(Language.GERMAN);
    expect(duration({ minutes: 10 })).toContain("Minuten");
    updateDurationLocale(Language.ARABIC);
    expect(duration({ minutes: 10 })).not.toContain("minutes");
    updateDurationLocale(Language.ENGLISH);
    expect(duration({ minutes: 10 })).toContain("minutes");
  });

  it("falls back to English for a tag Intl does not accept", () => {
    const duration = useDurationFormat();
    updateDurationLocale("not a locale!" as Language);
    expect(duration({ minutes: 1 })).toContain("minute");
  });
});
