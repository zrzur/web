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

// these tests read every source file from disk; on a busy CI runner or next to
// a backend build that can take over 5 s, so the file gets 30 s like docs.test.ts
describe("safe-area insets", { timeout: 30_000 }, () => {
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
    expect(root).toMatch(/bottom:\s*calc\(\s*max\(var\(--z-root-safe-bottom\)/);
    // iOS 26 installed app: the layout box stops short of the screen bottom.
    // iOS draws nothing below that box, so nothing may be placed there: the
    // root only gives up the bottom inset, it never gets a negative offset.
    expect(root).not.toMatch(/--z-screen-bottom/);
    expect(styles).toMatch(/--z-screen-bottom:\s*0px/);
    expect(styles).toMatch(
      /--z-root-safe-bottom:\s*max\(\s*0px,\s*var\(--z-safe-bottom\) - var\(--viewport-deficit, 0px\)\s*\)/,
    );
  });

  it("makes the page as tall as the screen in an installed app (WebKit 301108)", () => {
    // while the page is shorter than the screen, iOS 26 gives an installed
    // app a short viewport and draws nothing fixed below it
    const rule = "min-height: min(100lvh, calc(100% + var(--z-safe-top)));";
    const inMedia =
      styles.match(
        /@media \(display-mode: standalone\)\s*\{\s*html\s*\{[^}]*\}/,
      )?.[0] ?? "";
    expect(inMedia).toContain(rule);
    const marked =
      styles.match(/html\[data-installed\]\s*\{[^}]*\}/)?.[0] ?? "";
    expect(marked).toContain(rule);
    expect(read(join("components", "common", "Device.tsx"))).toContain(
      'document.documentElement.dataset.installed = "";',
    );
  });

  it("reads env(safe-area-inset-*) nowhere else", () => {
    const offenders = [...sources("components"), ...sources("src")]
      .filter((path) => !path.endsWith(join("ui", "styles.css")))
      // the "no connection" page is a page of its own, written by the
      // service worker: the app's stylesheet and variables are not on it
      .filter((path) => path !== join("src", "offlinePage.ts"))
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
        "components/ui/components/features/voice/callCard/VoiceCallCardFloat.tsx",
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
