// Checks that every message in the plugin screens has an Arabic entry in
// components/plugins/i18n.ts. Extracts into a temporary catalog, never the
// shared catalogs:
//
//   node scripts/plugins-i18n-check.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "zplug-i18n-"));
const config = join(process.cwd(), "lingui.plugins-check.config.ts");
writeFileSync(
  config,
  `import { formatter } from "@lingui/format-po";
import { defineConfig } from "@lingui/solid/config";
export default defineConfig({
  sourceLocale: "en",
  locales: ["en"],
  catalogs: [{
    path: ${JSON.stringify(join(out, "{locale}").replace(/\\/g, "/"))},
    include: [
      "components/plugins",
      "components/app/interface/settings/user/plugins",
      "components/app/interface/settings/user/Advanced.tsx",
    ],
  }],
  runtimeConfigModule: { Trans: ["@lingui/solid", "Trans"], useLingui: ["@lingui/solid", "useLingui"] },
  format: formatter({ origins: false }),
});
`,
);
try {
  execFileSync("npx", ["lingui", "extract", "--config", config], {
    stdio: "ignore",
    shell: true,
  });
} finally {
  // leave no config behind
  writeFileSync(config, "");
  execFileSync(process.platform === "win32" ? "cmd" : "rm", process.platform === "win32" ? ["/c", "del", config] : [config]);
}

const po = readFileSync(join(out, "en.po"), "utf8").replace(/\r\n/g, "\n");
const ids = [...po.matchAll(/^msgid ((?:".*"\n?)+)/gm)]
  .map((m) => m[1].split("\n").filter(Boolean).map((l) => JSON.parse(l)).join(""))
  .filter(Boolean);
const source = readFileSync("components/plugins/i18n.ts", "utf8");
// strings the shared Arabic catalog already translates count too
const shared = readFileSync("components/i18n/catalogs/ar/messages.po", "utf8");
const inShared = (id) => shared.includes(`msgid ${JSON.stringify(id)}
msgstr "`) && !shared.includes(`msgid ${JSON.stringify(id)}
msgstr ""`);
const missing = ids.filter(
  (id) => !source.includes(JSON.stringify(id)) && !source.includes(`  ${id}:`) && !inShared(id),
);
console.log(`${ids.length} messages, ${missing.length} without Arabic`);
for (const id of missing) console.log("  -", id);
process.exit(missing.length ? 1 : 0);
