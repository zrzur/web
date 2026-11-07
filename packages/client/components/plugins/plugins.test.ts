import { describe, expect, it } from "vitest";

import type { Manifest } from "../../../plugin-sdk/src/manifest.ts";

import { sanitiseBlocks, zrzurTokens } from "./host";
import {
  type ActivePlugin,
  effectiveSettings,
  inQuietHours,
  messageActions,
  notificationPolicy,
  resolveBinding,
  setPlugins,
  setSafeModeSignal,
} from "./registry";
import { sandboxCsp, workerSource } from "./sandbox";

function plugin(
  overrides: Omit<Partial<ActivePlugin>, "manifest"> & {
    manifest: Partial<Manifest>;
  },
): ActivePlugin {
  return {
    id: "dev.test.plugin",
    granted: [],
    status: "running",
    source: "installed",
    official: false,
    settings: {},
    themeOn: true,
    accessibilityOn: true,
    workerCommands: [],
    workerMessageActions: [],
    metrics: { calls: 0, errors: 0 },
    ...overrides,
    manifest: {
      manifest_version: 1,
      id: "dev.test.plugin",
      name: "Test",
      version: "1.0.0",
      description: "x",
      author: { name: "x" },
      category: "notifications",
      api_version: 1,
      min_app_version: "26.0.0",
      platforms: ["web"],
      entrypoint: { type: "declarative" },
      permissions: [],
      ...overrides.manifest,
    } as Manifest,
  };
}

describe("quiet hours", () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 26, h, m);
  it("handles ranges inside a day and past midnight", () => {
    expect(inQuietHours("09:00", "17:00", at(12))).toBe(true);
    expect(inQuietHours("09:00", "17:00", at(18))).toBe(false);
    expect(inQuietHours("22:00", "07:00", at(23, 30))).toBe(true);
    expect(inQuietHours("22:00", "07:00", at(6, 59))).toBe(true);
    expect(inQuietHours("22:00", "07:00", at(7))).toBe(false);
    expect(inQuietHours("10:00", "10:00", at(10))).toBe(false);
  });
});

describe("notification policy", () => {
  const quiet = plugin({
    granted: ["notifications.display", "storage.settings"],
    settings: { hide: true },
    manifest: {
      permissions: ["notifications.display", "storage.settings"],
      contributes: {
        settings: [
          { key: "hide", type: "boolean", title: "Hide", default: false },
        ],
        notifications: {
          quiet_hours: { start: "22:00", end: "07:00" },
          hide_previews: "$setting:hide",
        },
      },
    },
  });

  it("applies rules only from running plugins with the permission", () => {
    setPlugins({ [quiet.id]: quiet });
    const night = notificationPolicy(new Date(2026, 9, 26, 23));
    expect(night).toMatchObject({
      suppress: true,
      hidePreview: true,
      by: [quiet.id],
    });
    const day = notificationPolicy(new Date(2026, 9, 26, 12));
    expect(day).toMatchObject({ suppress: false, hidePreview: true });

    // revoked permission: no effect
    setPlugins(quiet.id, "granted", []);
    expect(notificationPolicy(new Date(2026, 9, 26, 23)).suppress).toBe(false);
    setPlugins(quiet.id, "granted", [
      "notifications.display",
      "storage.settings",
    ]);

    // stopped plugin: no effect
    setPlugins(quiet.id, "status", "stopped");
    expect(notificationPolicy(new Date(2026, 9, 26, 23)).suppress).toBe(false);
    setPlugins(quiet.id, "status", "running");

    // Safe Mode: no effect
    setSafeModeSignal(true);
    expect(notificationPolicy(new Date(2026, 9, 26, 23)).suppress).toBe(false);
    setSafeModeSignal(false);
    setPlugins(quiet.id, undefined!);
  });

  it("resolves settings bindings and falls back to defaults", () => {
    expect(resolveBinding(quiet, "$setting:hide")).toBe(true);
    expect(resolveBinding({ ...quiet, settings: {} }, "$setting:hide")).toBe(
      false,
    );
    expect(resolveBinding(quiet, "$setting:missing")).toBeUndefined();
    expect(resolveBinding(quiet, "#ffffff")).toBe("#ffffff");
  });

  it("gives worker code every declared setting, defaults included", () => {
    const values = effectiveSettings({
      ...quiet,
      settings: { hide: true, junk: 1 },
    });
    expect(values.hide).toBe(true);
    expect("junk" in values).toBe(false);
    // nothing saved yet: code still sees the defaults
    const defaults = effectiveSettings({ ...quiet, settings: {} });
    expect(defaults.hide).toBe(false);
  });
});

describe("message actions", () => {
  it("only lists running plugins whose worker registered the handler", () => {
    const p = plugin({
      granted: ["context.message.selected"],
      workerMessageActions: [],
      manifest: {
        permissions: ["context.message.selected"],
        entrypoint: { type: "worker", file: "main.js" },
        contributes: {
          message_actions: [
            {
              id: "count",
              title: { en: "Count", ar: "عدّ" },
              handler: "count",
            },
          ],
        },
      },
    });
    setPlugins({ [p.id]: p });
    expect(messageActions("en")).toEqual([]);
    setPlugins(p.id, "workerMessageActions", ["count"]);
    expect(messageActions("ar")).toEqual([
      { pluginId: p.id, pluginName: "Test", actionId: "count", title: "عدّ" },
    ]);
    setPlugins(p.id, "granted", []);
    expect(messageActions("en")).toEqual([]);
    setPlugins(p.id, undefined!);
  });
});

describe("panel blocks from workers", () => {
  it("accepts only structured blocks with bounded text", () => {
    expect(
      sanitiseBlocks([{ type: "text", text: "hi" }, { type: "divider" }]),
    ).toEqual([{ type: "text", text: "hi" }, { type: "divider" }]);
    expect(
      sanitiseBlocks([{ type: "html", html: "<img src=x onerror=alert(1)>" }]),
    ).toBeNull();
    expect(
      sanitiseBlocks([{ type: "button", label: "x", handler: "../../eval" }]),
    ).toBeNull();
    expect(
      sanitiseBlocks(Array.from({ length: 41 }, () => ({ type: "divider" }))),
    ).toBeNull();
    expect(sanitiseBlocks("nope")).toBeNull();
    const long = sanitiseBlocks([{ type: "text", text: "x".repeat(10_000) }]);
    expect((long![0] as { text: string }).text.length).toBe(600);
  });
});

describe("sandbox source", () => {
  it("has no network, eval or same-origin escape hatches", () => {
    const csp = sandboxCsp("abc");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("unsafe-inline");
    const source = workerSource("zrzur.log('hi')");
    // plugin code is declared, not executed, until init
    expect(source.indexOf("function __plugin(zrzur)")).toBeGreaterThan(
      source.indexOf("scope.onmessage"),
    );
    expect(source).toContain('"fetch", "XMLHttpRequest", "WebSocket"');
  });
});

describe("theme plugins reach the app's own colours", () => {
  it("maps theme colours onto --z tokens and never warning colours", () => {
    const tokens = Object.fromEntries(
      zrzurTokens({
        primary: "#7aa2ff",
        surface: "#0b1020",
        "on-surface": "#e6e9f5",
      }),
    );
    expect(tokens["--z-accent"]).toBe("#7aa2ff");
    expect(tokens["--z-accent-fill"]).toBe("#7aa2ff");
    expect(tokens["--z-bg-chat"]).toBe("#0b1020");
    expect(tokens["--z-fg-primary"]).toBe("#e6e9f5");
    expect(tokens["--z-accent-muted"]).toContain("#7aa2ff");
    expect(
      Object.keys(tokens).some((t) => /danger|warning|status/.test(t)),
    ).toBe(false);
    expect(zrzurTokens({})).toEqual([]);
  });
});
