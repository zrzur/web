import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  compareVersions,
  contrast,
  localise,
  riskOf,
  scanPackage,
  sha256Hex,
  validateManifest,
} from "../src/manifest.ts";

const base = () => ({
  manifest_version: 1,
  id: "dev.example.midnight",
  name: "Midnight",
  version: "1.0.0",
  description: "A deep blue theme",
  author: { name: "Example" },
  category: "appearance",
  api_version: 1,
  min_app_version: "26.0.0",
  platforms: ["web", "desktop"],
  entrypoint: { type: "declarative" },
  permissions: ["theme.colors", "ui.commands"],
  contributes: {
    theme: {
      colors: {
        primary: "#7aa2ff",
        surface: "#0b1020",
        "on-surface": "#e6e9f5",
      },
    },
    commands: [
      {
        id: "toggle",
        title: { en: "Toggle", ar: "تبديل" },
        action: { type: "theme.toggle" },
      },
    ],
  },
});

/** base() loosened so tests can bend it into invalid shapes */
type Base = ReturnType<typeof base>;
type Draft = Omit<Base, "contributes" | "entrypoint"> & {
  [key: string]: unknown;
  entrypoint: { type: string; file?: string };
  contributes: Omit<Base["contributes"], "theme"> & {
    [key: string]: unknown;
    theme: { [key: string]: unknown; colors: Record<string, string> };
  };
};
const draft = () => base() as Draft;

const issues = (m: unknown, options = {}) => {
  const r = validateManifest(m, options);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};

test("accepts a valid theme", () => {
  const r = validateManifest(base());
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.risk, "low");
});

test("every example is valid as an official plugin", () => {
  const dir = join(import.meta.dirname, "..", "examples");
  for (const name of readdirSync(dir).filter((n) => n !== "dist")) {
    const manifest = JSON.parse(
      readFileSync(join(dir, name, "manifest.json"), "utf8"),
    );
    const code =
      manifest.entrypoint.type === "worker"
        ? readFileSync(join(dir, name, "main.js"), "utf8")
        : undefined;
    if (code) manifest.integrity = { sha256: "0".repeat(64) };
    const found = issues(manifest, { official: true });
    assert.deepEqual(found, [], `${name}: ${found.join("; ")}`);
  }
});

test("forbidden, unknown and unsupported permissions", () => {
  const m = base();
  m.permissions = [
    "theme.colors",
    "ui.commands",
    "auth.token",
    "telepathy",
    "network.fetch",
    "bots.token",
  ];
  const found = issues(m).join("\n");
  assert.match(found, /auth\.token` can never be granted/);
  assert.match(found, /bots\.token` can never be granted/);
  assert.match(found, /unknown permission `telepathy`/);
  assert.match(found, /not supported/);
});

test("unknown fields, dependencies and raw CSS are rejected", () => {
  const m = draft();
  m.dependencies = { "left-pad": "*" };
  m.contributes.theme.css = "body{display:none}";
  const found = issues(m).join("\n");
  assert.match(found, /dependencies/);
  assert.match(found, /contributes\.theme\.css: unknown field/);
});

test("warning colours and unreadable contrast", () => {
  const m = base();
  (m.contributes.theme.colors as Record<string, string>) = {
    error: "#000000",
    surface: "#101010",
    "on-surface": "#151515",
  };
  const found = issues(m).join("\n");
  assert.match(found, /warning and error colours/);
  assert.match(found, /contrast/);
});

test("path traversal and bad ids", () => {
  const m = draft();
  m.id = "../../etc/passwd";
  m.entrypoint = { type: "worker", file: "../main.js" };
  const found = issues(m, { code: "1" }).join("\n");
  assert.match(found, /^id:/m);
  assert.match(found, /entrypoint\.file/);
});

test("official prefix is reserved", () => {
  const m = base();
  m.id = "zrzur.fake";
  assert.notDeepEqual(issues(m), []);
  assert.deepEqual(issues(m, { official: true }), []);
});

test("declarative plugins can't carry code; workers need integrity", () => {
  assert.match(
    issues(base(), { code: "alert(1)" }).join(),
    /declarative plugins can't include code/,
  );
  const m = draft();
  m.entrypoint = { type: "worker", file: "main.js" };
  assert.match(issues(m, { code: "1" }).join(), /integrity/);
  assert.equal(riskOf(m as unknown as Parameters<typeof riskOf>[0]), "high");
});

test("unsupported versions", () => {
  const m = draft();
  m.api_version = 2;
  m.manifest_version = 3;
  m.version = "1.0";
  assert.equal(issues(m).length, 3);
});

test("contributions need their permissions", () => {
  const m = draft();
  m.permissions = ["ui.commands"];
  m.contributes.keybinds = [{ command: "toggle", keys: "Ctrl+Shift+I" }];
  const found = issues(m).join("\n");
  assert.match(found, /theme\.colors/);
  assert.match(found, /keybinds/);
  assert.match(found, /used by the browser or Zrzur/);
});

test("setting bindings must exist and have the right type", () => {
  const m = draft();
  m.permissions.push("storage.settings");
  m.contributes.settings = [
    {
      key: "level",
      type: "number",
      title: "Level",
      default: 1,
      min: 0,
      max: 3,
    },
  ];
  m.contributes.theme.colors.primary = "$setting:level";
  assert.match(issues(m).join(), /must be a color/);
  m.contributes.theme.colors.primary = "$setting:nope";
  assert.match(issues(m).join(), /no setting called/);
});

test("bidi override and control characters are refused", () => {
  const m = base();
  m.name = "Safe‮elif";
  assert.match(issues(m).join(), /direction-override/);
});

test("oversized manifests are refused", () => {
  const m = draft();
  const strings = Object.fromEntries(
    Array.from({ length: 200 }, (_, i) => [`k${i}`, "x".repeat(300)]),
  );
  m.locales = { en: { strings }, ar: { strings } };
  assert.match(issues(m).join(), /larger than/);
});

test("prototype pollution keys are just unknown fields", () => {
  const m = JSON.parse(
    JSON.stringify(base()).replace(
      '"contributes":{',
      '"contributes":{"__proto__":{"polluted":true},',
    ),
  );
  assert.match(issues(m).join(), /__proto__: unknown field/);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test("scanner blocks secrets and flags risky code", () => {
  const findings = scanPackage(
    "{}",
    "const t = 'x-session-token';\nfetch('https://evil')\neval('1')",
  );
  assert.ok(findings.some((f) => f.block && f.rule === "session-header"));
  assert.ok(
    findings.some((f) => !f.block && f.rule === "network" && f.line === 2),
  );
  assert.ok(findings.some((f) => f.rule === "eval"));
});

test("helpers", async () => {
  assert.equal(compareVersions("1.2.0", "1.10.0"), -1);
  assert.equal(compareVersions("1.0.0-beta", "1.0.0"), -1);
  assert.ok(contrast("#000000", "#ffffff") > 20);
  assert.equal(localise({ en: "Hi", ar: "مرحبا" }, "ar-SY"), "مرحبا");
  assert.equal(localise({ en: "Hi", ar: "مرحبا" }, "fr"), "Hi");
  assert.equal(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("every plugin in official/ is valid", () => {
  const dir = join(import.meta.dirname, "..", "official");
  for (const name of readdirSync(dir)) {
    const manifest = JSON.parse(
      readFileSync(join(dir, name, "manifest.json"), "utf8"),
    );
    if (manifest.entrypoint.type === "worker")
      manifest.integrity = { sha256: "0".repeat(64) };
    const official = manifest.id.startsWith("zrzur.");
    const found = issues(manifest, { official });
    assert.deepEqual(found, [], `${name}: ${found.join("; ")}`);
  }
});

test("editing and browser shortcuts stay with the user", () => {
  for (const keys of ["Ctrl+Shift+Z", "Ctrl+Shift+V", "Ctrl+Shift+U", "Ctrl+Shift+K"]) {
    const m = draft();
    m.permissions = [...m.permissions, "ui.commands", "keybinds"];
    m.contributes.commands = [
      { id: "toggle", title: "Toggle", action: { type: "theme.toggle" } },
    ];
    m.contributes.keybinds = [{ command: "toggle", keys }];
    assert.match(issues(m).join("\n"), /used by the browser or Zrzur/, keys);
  }
});

test("third parties can't look official", () => {
  for (const name of ["Zrzur Security", "ZR-ZUR tools", "أدوات زرزور", "Official Themes", "الثيمات الرسمية", "Offizielle Farben"]) {
    const m = { ...base(), name };
    assert.ok(issues(m).some((i) => i.includes("reserved for official plugins")), name);
    assert.deepEqual(issues(m, { official: true }), [], name);
  }
  assert.ok(issues({ ...base(), author: { name: "Zarzour Team" } }).some((i) => i.startsWith("author.name")));
  assert.ok(issues({ ...base(), locales: { ar: { name: "زرزور" } } }).some((i) => i.startsWith("locales.ar.name")));
  assert.deepEqual(issues({ ...base(), name: "Night Owl for chats" }), []);
});
