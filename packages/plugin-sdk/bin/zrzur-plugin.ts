#!/usr/bin/env node
/**
 * zrzur-plugin — create, check and package Zrzur plugins.
 *
 *   node bin/zrzur-plugin.ts init <dir> [--template theme|productivity|notifications|accessibility]
 *   node bin/zrzur-plugin.ts validate <dir|manifest.json|package.zplugin.json> [--official]
 *   node bin/zrzur-plugin.ts pack <dir> [--out <file>]
 *
 * Runs on Node 22.6+ (type stripping) with no dependencies and no network.
 * It never publishes anything: upload the package in Zrzur →
 * Settings → Advanced → Plugins → Developer, where it is reviewed.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type Manifest,
  type PluginPackage,
  LIMITS,
  scanPackage,
  sha256Hex,
  validateManifest,
} from "../src/manifest.ts";

const here = dirname(fileURLToPath(import.meta.url));
const [command, target, ...rest] = process.argv.slice(2);
const option = (name: string) => {
  const index = rest.indexOf(`--${name}`);
  return index === -1 ? undefined : rest[index + 1];
};

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/** Read a plugin from a folder, a manifest or a package file */
function load(path: string): { pkg: PluginPackage; root: string } {
  const full = resolve(path ?? ".");
  if (!existsSync(full)) fail(`${full} does not exist`);
  if (statSync(full).isDirectory()) {
    const manifestPath = join(full, "manifest.json");
    if (!existsSync(manifestPath)) fail(`no manifest.json in ${full}`);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
    let code: string | undefined;
    if (manifest.entrypoint?.type === "worker") {
      const file = manifest.entrypoint.file;
      // the validator rejects folders; check again before touching disk
      if (!/^[a-z0-9_-]{1,40}\.js$/.test(file ?? ""))
        fail("entrypoint.file must be a plain file name");
      const codePath = join(full, file);
      if (!existsSync(codePath)) fail(`entrypoint ${file} not found`);
      code = readFileSync(codePath, "utf8");
    }
    return { pkg: { manifest, code }, root: full };
  }
  const parsed = JSON.parse(readFileSync(full, "utf8"));
  return {
    pkg:
      "manifest" in parsed
        ? (parsed as PluginPackage)
        : { manifest: parsed as Manifest },
    root: dirname(full),
  };
}

function report(pkg: PluginPackage) {
  const result = validateManifest(pkg.manifest, {
    code: pkg.code,
    official: process.env.ZRZUR_OFFICIAL === "1" || rest.includes("--official"),
  });
  const findings = scanPackage(JSON.stringify(pkg.manifest, null, 2), pkg.code);
  for (const finding of findings) {
    console.log(
      `${finding.block ? "✗" : "!"} scan ${finding.rule}: ${finding.message} (line ${finding.line})`,
    );
  }
  if (!result.ok) {
    for (const issue of result.issues)
      console.log(`✗ ${issue.path || "(manifest)"}: ${issue.message}`);
    return false;
  }
  if (findings.some((f) => f.block)) return false;
  console.log(
    `✓ ${pkg.manifest.id} ${pkg.manifest.version} is valid (risk: ${result.risk})`,
  );
  console.log(
    `  permissions: ${pkg.manifest.permissions.join(", ") || "none"}`,
  );
  return true;
}

const TEMPLATES: Record<string, (id: string, name: string) => Manifest> = {
  theme: (id, name) => ({
    manifest_version: 1,
    id,
    name,
    version: "0.1.0",
    description: "My Zrzur theme.",
    author: { name: "You" },
    category: "appearance",
    icon: "palette",
    api_version: 1,
    min_app_version: "26.0.0",
    platforms: ["web", "pwa", "desktop"],
    entrypoint: { type: "declarative" },
    permissions: ["theme.colors"],
    contributes: {
      theme: {
        colors: {
          primary: "#4fb38b",
          surface: "#101614",
          "on-surface": "#e4ece8",
        },
      },
    },
  }),
  productivity: (id, name) => ({
    manifest_version: 1,
    id,
    name,
    version: "0.1.0",
    description: "Shortcuts for things I do often.",
    author: { name: "You" },
    category: "productivity",
    api_version: 1,
    min_app_version: "26.0.0",
    platforms: ["web", "pwa", "desktop"],
    entrypoint: { type: "declarative" },
    permissions: ["ui.commands", "keybinds", "composer.insert"],
    contributes: {
      commands: [
        {
          id: "greet",
          title: { en: "Insert a greeting", ar: "إدراج تحية" },
          action: { type: "composer.insert", text: "Hello! 👋" },
        },
      ],
      keybinds: [{ command: "greet", keys: "Alt+Shift+G" }],
    },
  }),
  notifications: (id, name) => ({
    manifest_version: 1,
    id,
    name,
    version: "0.1.0",
    description: "Quiet notifications at night.",
    author: { name: "You" },
    category: "notifications",
    api_version: 1,
    min_app_version: "26.0.0",
    platforms: ["web", "pwa", "desktop"],
    entrypoint: { type: "declarative" },
    permissions: ["notifications.display"],
    contributes: {
      notifications: { quiet_hours: { start: "23:00", end: "07:00" } },
    },
  }),
  accessibility: (id, name) => ({
    manifest_version: 1,
    id,
    name,
    version: "0.1.0",
    description: "Easier reading.",
    author: { name: "You" },
    category: "accessibility",
    api_version: 1,
    min_app_version: "26.0.0",
    platforms: ["web", "pwa", "desktop"],
    entrypoint: { type: "declarative" },
    permissions: ["accessibility.display"],
    contributes: { accessibility: { font_scale: 1.1, underline_links: true } },
  }),
};

switch (command) {
  case "init": {
    if (!target)
      fail(
        "usage: init <dir> [--template theme|productivity|notifications|accessibility]",
      );
    const dir = resolve(target);
    if (existsSync(join(dir, "manifest.json")))
      fail(`${dir} already has a manifest.json`);
    const template =
      TEMPLATES[option("template") ?? "theme"] ?? fail("unknown template");
    const slug =
      basename(dir)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/^-+|-+$/g, "") || "my-plugin";
    const id =
      option("id") ??
      `dev.${process.env.USER?.toLowerCase().replace(/[^a-z0-9]/g, "") || "me"}.${slug}`.replace(
        /\.(\d)/g,
        ".p$1",
      );
    mkdirSync(dir, { recursive: true });
    const manifest = {
      $schema: "https://zrzur.com/schemas/plugin-manifest.v1.json",
      ...template(id, slug),
    };
    writeFileSync(
      join(dir, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
    );
    console.log(`✓ created ${join(dir, "manifest.json")} (${id})`);
    console.log("  next: edit it, then `validate` and `pack`.");
    break;
  }
  case "validate": {
    const { pkg } = load(target);
    process.exit(report(pkg) ? 0 : 1);
    break;
  }
  case "pack": {
    const { pkg, root } = load(target);
    if (pkg.code !== undefined) {
      // integrity covers exactly the code that will be reviewed and run
      pkg.manifest.integrity = { sha256: await sha256Hex(pkg.code) };
    }
    if (!report(pkg)) fail("fix the problems above first");
    const text = JSON.stringify(pkg, null, 2) + "\n";
    if (Buffer.byteLength(text) > LIMITS.manifestBytes + LIMITS.codeBytes * 2)
      fail("package too large");
    const out = resolve(
      option("out") ??
        join(root, `${pkg.manifest.id}-${pkg.manifest.version}.zplugin.json`),
    );
    writeFileSync(out, text);
    console.log(`✓ wrote ${out}`);
    console.log(
      "  upload it in Zrzur → Settings → Advanced → Plugins → Developer.",
    );
    break;
  }
  default:
    console.log(
      readFileSync(join(here, "..", "README.md"), "utf8").split("\n## ")[0],
    );
    console.log("commands: init <dir>, validate <path>, pack <dir>");
}
