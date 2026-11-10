import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../../../..");

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "dist", "styled-system", "catalogs"].includes(name))
      continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.tsx$/.test(name) && !/\.test\./.test(name)) yield path;
  }
}

/**
 * The browser's own colour, date and time boxes look different on every
 * system and ignore the theme (and read dates in the wrong order in
 * Arabic). Only the design-system folder may wrap one, behind its own look:
 * ColourWell, ColourPicker, DateTimeField.
 */
const DESIGN_SYSTEM = "components/ui/components/design/";

/** Known places still waiting for a design-system control, with why */
const WAITING: Record<string, string> = {
  // a hidden input opened by its own swatch button: never seen
  "components/app/interface/settings/user/appearance/AppearanceMenu.tsx":
    "hidden",
  // staff-only tool, an optional expiry day
  "components/app/interface/settings/user/badges/BadgeAdmin.tsx": "staff",
  // plugin settings: plugins are off on every server for now
  "components/app/interface/settings/user/plugins/PluginDetail.tsx":
    "plugins off",
};

describe("native inputs", () => {
  it("keeps colour, date and time boxes inside the design system", () => {
    const offenders: string[] = [];
    for (const dir of ["src", "components"]) {
      for (const file of sources(join(root, dir))) {
        const path = relative(root, file).replace(/\\/g, "/");
        if (path.startsWith(DESIGN_SYSTEM) || WAITING[path]) continue;
        if (
          /type=["'](color|date|time|datetime-local|month|week)["']/.test(
            readFileSync(file, "utf8"),
          )
        )
          offenders.push(path);
      }
    }
    expect(offenders).toEqual([]);
  }, 30_000);
});
