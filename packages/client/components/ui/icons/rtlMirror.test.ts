import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../../..");

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "dist", "styled-system", "catalogs"].includes(name))
      continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) yield path;
  }
}

/**
 * Icons that point a direction (chevrons, back and forward arrows, reply,
 * send, sign-out) are mirrored for right-to-left in ONE place: the rule in
 * `components/ui/styles.css`. A second flip written next to a component turns
 * the icon back, so in Arabic "back" pointed forward and Reply and Forward
 * looked the same. Flips that stay are for things that are not such icons.
 */
const NOT_DIRECTION_ICONS: Record<string, string> = {
  "src/interface/channels/ChannelHeader.tsx": "the › text separator",
  "components/app/interface/discover/Hero.tsx": "the flock drawing",
  "components/ui/components/design/Sky.tsx": "the flock drawing",
  "components/app/interface/safety/styles.ts": "a bare svg, not an Icon",
  "components/app/interface/settings/user/profile/CommunityParts.tsx":
    "drifting feathers",
  "components/app/interface/settings/user/profile/StyleEditors.tsx":
    "a bare svg, not an Icon",
  "components/app/interface/settings/user/subscriptions/PlusPage.tsx":
    "the feather fan",
  "components/modal/modals/PromoteServer.tsx": "the feather fan",
  "components/modal/modals/SuperchargeServer.tsx": "the feather fan",
};

const FLIP = /(_rtl|dir\(rtl\)|dir=.?rtl).*(scaleX\(-1\)|scale: "-1 1")/;

describe("right-to-left icons", () => {
  it("mirrors direction icons in styles.css and nowhere else", () => {
    const offenders: string[] = [];
    for (const dir of ["src", "components"]) {
      for (const file of sources(join(root, dir))) {
        const path = relative(root, file).replace(/\\/g, "/");
        if (NOT_DIRECTION_ICONS[path]) continue;
        if (
          readFileSync(file, "utf8")
            .split("\n")
            .some((line) => FLIP.test(line))
        )
          offenders.push(path);
      }
    }
    expect(offenders).toEqual([]);
  }, 30_000);

  it("keeps the one rule that does the mirroring", () => {
    const css = readFileSync(join(root, "components/ui/styles.css"), "utf8");
    const rule = css.slice(css.indexOf('[dir="rtl"]\n  .z-icon:is('));
    for (const name of [
      "caret-left",
      "caret-right",
      "arrow-left",
      "arrow-right",
      "arrow-bend-up-left",
      "arrow-bend-up-right",
      "paper-plane-tilt",
      "sign-out",
    ])
      expect(rule).toContain(`[data-icon="${name}"]`);
    expect(rule).toMatch(/scale:\s*-1 1/);
  });
});
