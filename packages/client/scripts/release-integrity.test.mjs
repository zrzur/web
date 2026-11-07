// Run with: node --test scripts/release-integrity.test.mjs
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildDefine, readReleaseInfo, sourceUrl } from "./release-info.mjs";
import {
  packageDirOfModule,
  readExtraNotice,
  readPackageNotice,
  renderNotices,
} from "./third-party-notices.mjs";

function repo(version = "26.0.0-dev") {
  const dir = mkdtempSync(join(tmpdir(), "zrzur-rel-"));
  writeFileSync(join(dir, "RELEASE.json"), JSON.stringify({ version }));
  return dir;
}

test("release info reads version and env commit/tag", () => {
  const dir = repo();
  const info = readReleaseInfo({
    dir,
    env: { ZRZUR_GIT_COMMIT: "ABCDEF1234", ZRZUR_GIT_TAG: "v26.0.0" },
  });
  assert.deepEqual(info, {
    version: "26.0.0-dev",
    commit: "abcdef1234",
    tag: "v26.0.0",
  });
});

test("docker placeholders are ignored, unknown stays empty", () => {
  const dir = repo();
  const info = readReleaseInfo({
    dir,
    env: { ZRZUR_GIT_COMMIT: "__COMMIT__" },
  });
  assert.equal(info.commit, ""); // no git repo in the temp dir
  assert.equal(info.tag, "");
});

test("source url prefers the tag, then the commit, then the repo root", () => {
  assert.equal(
    sourceUrl({ tag: "v1.0.0", commit: "abc" }, "web"),
    "https://github.com/zrzur/web/tree/v1.0.0",
  );
  assert.equal(
    sourceUrl({ tag: "", commit: "abc123" }, "website"),
    "https://github.com/zrzur/website/tree/abc123",
  );
  assert.equal(
    sourceUrl({ tag: "", commit: "" }, "desktop"),
    "https://github.com/zrzur/desktop",
  );
  const def = JSON.parse(buildDefine({ version: "1", commit: "abc", tag: "" }, "web"));
  assert.equal(def.sourceUrl, "https://github.com/zrzur/web/tree/abc");
});

test("package dir is found in pnpm and npm layouts", () => {
  assert.equal(
    packageDirOfModule("/r/node_modules/.pnpm/a@1/node_modules/@s/p/dist/i.js?x"),
    "/r/node_modules/.pnpm/a@1/node_modules/@s/p",
  );
  assert.equal(
    packageDirOfModule(String.raw`C:\r\node_modules\solid-js\dist\a.js`),
    "C:/r/node_modules/solid-js",
  );
  assert.equal(packageDirOfModule("/r/src/app.ts"), null);
});

test("notices contain licence text of packages and extra folders", () => {
  const root = mkdtempSync(join(tmpdir(), "zrzur-np-"));
  const pkg = join(root, "node_modules", "@fontsource", "x");
  mkdirSync(pkg, { recursive: true });
  writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "@fontsource/x", version: "5.0.0", license: "OFL-1.1" }));
  writeFileSync(join(pkg, "LICENSE"), "SIL OPEN FONT LICENSE Version 1.1");
  const extra = join(root, "twemoji");
  mkdirSync(extra);
  writeFileSync(join(extra, "LICENSE-GRAPHICS"), "CC-BY 4.0 graphics");
  writeFileSync(join(extra, "other.svg"), "<svg/>");

  const text = renderNotices({
    productName: "Zrzur web",
    entries: [
      readPackageNotice(pkg),
      readExtraNotice({ name: "Twemoji", dir: extra, license: "CC-BY-4.0" }),
    ],
  });
  assert.match(text, /@fontsource\/x 5\.0\.0/);
  assert.match(text, /OFL-1\.1/);
  assert.match(text, /SIL OPEN FONT LICENSE/);
  assert.match(text, /Twemoji/);
  const named = readExtraNotice({
    name: "Named",
    dir: extra,
    license: "X",
    files: ["other.svg", "missing.txt"],
  });
  assert.deepEqual(named.texts.map((t) => t.file), ["other.svg"]);
  assert.match(text, /CC-BY 4\.0 graphics/);
  assert.doesNotMatch(text, /<svg/);
});

import { fallbackLicenceTexts, findInstalled, thirdPartyNotices } from "./third-party-notices.mjs";
import { createHash } from "node:crypto";
import { readFileSync as read } from "node:fs";

test("a package without a licence file gets the standard text by SPDX id", () => {
  const mit = fallbackLicenceTexts({ name: "x", license: "MIT", author: "Ann <a@b.c>" });
  assert.match(mit[0].text, /Copyright \(c\) Ann\b/);
  assert.match(mit[0].text, /Permission is hereby granted/);
  const both = fallbackLicenceTexts({ name: "y", license: "(Apache-2.0 AND BSD-3-Clause)" });
  assert.equal(both.length, 2);
  assert.deepEqual(fallbackLicenceTexts({ name: "z", license: "UNKNOWN" }), []);
});

test("named components are found in pnpm stores and missing ones fail the build", () => {
  const root = mkdtempSync(join(tmpdir(), "zrzur-store-"));
  for (const v of ["1.0.0", "2.0.0"]) {
    const d = join(root, "node_modules", ".pnpm", `@s+wb@${v}`, "node_modules", "@s", "wb");
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "package.json"), JSON.stringify({ name: "@s/wb", version: v, license: "MIT" }));
    writeFileSync(join(d, "LICENSE"), `MIT ${v}`);
  }
  assert.equal(findInstalled(root, "@s/wb").length, 2);
  assert.equal(findInstalled(root, "nope").length, 0);

  const emitted = [];
  const errors = [];
  const ctx = {
    getModuleIds: () => [],
    warn() {},
    error: (m) => errors.push(m),
    emitFile: (f) => emitted.push(f),
  };
  const livekit = join(root, "livekit");
  mkdirSync(livekit);
  writeFileSync(join(livekit, "package.json"), JSON.stringify({ name: "solid-livekit-components", version: "1", license: "Apache-2.0" }));
  writeFileSync(join(livekit, "LICENSE"), "Apache License Version 2.0 text");
  const plugin = thirdPartyNotices({
    productName: "T",
    root,
    packages: [
      { name: "solid-livekit-components", dir: livekit },
      { name: "@s/wb" },
      { name: "not-installed" },
    ],
    extras: [{ name: "Empty extra", dir: root, license: "MIT" }],
  });
  plugin.generateBundle.call(ctx, {}, {});
  assert.equal(errors.length, 2);
  assert.match(errors[0], /not-installed/);
  assert.match(errors[1], /Empty extra/);
  const text = emitted[0].source;
  assert.match(text, /solid-livekit-components 1/);
  assert.match(text, /Apache License Version 2\.0 text/);
  assert.match(text, /@s\/wb 1\.0\.0/);
  assert.match(text, /@s\/wb 2\.0\.0/);
});

test("the copied shared scripts match their recorded hashes", () => {
  const recorded = Object.fromEntries(
    read(new URL("./shared-scripts.sha256", import.meta.url), "utf8")
      .trim().split(/\r?\n/).map((l) => l.split(/\s+/).reverse()),
  );
  for (const [file, hash] of Object.entries(recorded)) {
    const text = read(new URL(`./${file}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
    assert.equal(createHash("sha256").update(text).digest("hex"), hash, `${file} changed: update every copy and shared-scripts.sha256`);
  }
});
