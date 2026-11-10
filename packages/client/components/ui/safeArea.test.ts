import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Safe areas of the installed app (notch, status bar, home bar). The rule:
 * the four --z-safe-* variables come from env() in one place, #root takes
 * all four, nothing laid out inside #root adds them again, and every other
 * surface reads the variables (never env() directly), so a test can set
 * them to see a phone with a notch.
 */
const CLIENT = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(join(CLIENT, path), "utf8");
const styles = read("components/ui/styles.css");

function sources(dir: string, out: string[] = []) {
  for (const name of readdirSync(join(CLIENT, dir))) {
    const path = join(dir, name);
    if (statSync(join(CLIENT, path)).isDirectory()) sources(path, out);
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name))
      out.push(path);
  }
  return out;
}

describe("safe-area insets", () => {
  it("index.html lets the page reach under the notch (viewport-fit=cover)", () => {
    const html = read("index.html");
    expect(html).toMatch(/name="viewport"[^>]*viewport-fit=cover/);
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain(
      'name="apple-mobile-web-app-status-bar-style" content="black-translucent"',
    );
  });

  it("defines the four variables from env(), with 0 outside an installed app", () => {
    for (const side of ["top", "right", "bottom", "left"])
      expect(styles).toContain(
        `--z-safe-${side}: env(safe-area-inset-${side}, 0px);`,
      );
  });

  it("offsets #root by all four variables", () => {
    const root = styles.match(/#root\s*\{[^}]*\}/)?.[0] ?? "";
    expect(root).toMatch(/top:\s*calc\(var\(--z-safe-top\)/);
    expect(root).toMatch(/left:\s*var\(--z-safe-left\)/);
    expect(root).toMatch(/right:\s*var\(--z-safe-right\)/);
    expect(root).toMatch(/bottom:\s*max\(var\(--z-safe-bottom\)/);
  });

  it("reads env(safe-area-inset-*) nowhere else", () => {
    const offenders = [...sources("components"), ...sources("src")]
      .filter((path) => !path.endsWith(join("ui", "styles.css")))
      .filter((path) => /env\(\s*safe-area-inset/.test(read(path)))
      .map((path) => relative(CLIENT, join(CLIENT, path)));
    expect(offenders).toEqual([]);
  });

  it("does not add the insets twice inside #root (tab bar, sidebar, call dock)", () => {
    for (const path of [
      "src/interface/navigation/PhoneTabs.tsx",
      "src/interface/Sidebar.tsx",
      "src/interface/channels/voice/VoiceChannel.tsx",
    ])
      expect(read(path), path).not.toMatch(/--z-safe-|safe-area-inset/);
  });

  it("keeps full-screen surfaces outside #root clear of the notch", () => {
    // settings, the image viewer, the full-screen call and phone sheets
    expect(read("components/modal/modals/Settings.tsx")).toContain(
      "var(--z-safe-top)",
    );
    expect(read("components/modal/modals/ImageViewer.tsx")).toContain(
      'paddingTop: "var(--z-safe-top)"',
    );
    expect(
      read(
        "components/ui/components/features/voice/callCard/VoiceCallCard.tsx",
      ),
    ).toContain('paddingTop: "var(--z-safe-top)"');
    const dialog = read("components/ui/components/design/Dialog.tsx");
    expect(dialog.match(/100dvh - \d+px - var\(--z-safe-top\)/g)?.length).toBe(
      2,
    );
  });

  it("gives phone screens room above the first row, and desktop none", () => {
    expect(styles).toMatch(
      /@media \(max-width: 600px\)\s*\{\s*:root\s*\{\s*--z-phone-top-gap: 8px;/,
    );
    for (const path of [
      "components/ui/components/layout/Header.tsx",
      "src/interface/navigation/channels/HomeSidebar.tsx",
    ])
      expect(read(path), path).toContain(
        'paddingTop: "var(--z-phone-top-gap, 0px)"',
      );
  });
});
