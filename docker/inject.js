// Runtime configuration for the built client.
//
// The image is built once with placeholder values ("__VITE_API_URL__" and so
// on) and each container writes its own URLs in at start. Writing new bytes
// into a file whose name stays the same is what kept browsers, the service
// worker and Cloudflare on old copies (for example an old WebSocket address).
// So after injecting, every file Vite emitted at the top of assets/ moves to
// assets/<release>/, where <release> is a fingerprint of the build and the
// injected values, and every reference to those files is rewritten:
//
// - same build and same URLs: same folder, caches stay valid;
// - any URL changes: new folder, so every cached copy is simply never asked
//   for again, and serviceWorker.js changes too, so browsers install the new
//   service worker by themselves.
//
// Files in sub-folders of assets/ (web/, sounds/, ...) keep their stable
// addresses: the web manifest and old caches ask for them by name.
const {
  cpSync,
  rmSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  renameSync,
  statSync,
} = require("node:fs");
const { join, extname } = require("node:path");
const { createHash } = require("node:crypto");

// Map of placeholder to the environment variable that replaces it.
// At build time, Vite replaces import.meta.env.VITE_X with the literal string
// value; the image is built with placeholders so they appear in the output.
const PLACEHOLDERS = {
  __VITE_HOST__: "VITE_HOST",
  __VITE_API_URL__: "VITE_API_URL",
  __VITE_WS_URL__: "VITE_DEV_WS_URL",
  __VITE_MEDIA_URL__: "VITE_DEV_MEDIA_URL",
  __VITE_PROXY_URL__: "VITE_DEV_PROXY_URL",
  __VITE_GIFBOX_URL__: "VITE_DEV_GIFBOX_URL",
  __VITE_RNNOISE_WORKLET_CDN_URL__: "VITE_RNNOISE_WORKLET_CDN_URL",
  __VITE_INVITE_ORIGIN__: "VITE_INVITE_ORIGIN",
  __VITE_DISCOVER_URL__: "VITE_DISCOVER_URL",
  __VITE_DESIGNS_HOST__: "VITE_DESIGNS_HOST",
  __VITE_DOCS_URL__: "VITE_DOCS_URL",
  __VITE_RELEASE_CHANNEL__: "VITE_RELEASE_CHANNEL",
};

/**
 * Written in when the container leaves a variable unset, where "unset" must
 * not read as a local build: a local build without VITE_RELEASE_CHANNEL is a
 * beta, a container without it is a stable release.
 */
const DEFAULTS = {
  VITE_RELEASE_CHANNEL: "stable",
};

/** Text files that may hold placeholders or references to emitted files */
const TEXT = new Set([".js", ".mjs", ".css", ".html", ".json", ".webmanifest"]);

/** The release folder name: the build (its index.html) plus the injected values */
function releaseId(buildDir, env) {
  const hash = createHash("sha256");
  hash.update(readFileSync(join(buildDir, "index.html")));
  for (const name of Object.values(PLACEHOLDERS).sort())
    hash.update(`\n${name}=${env[name] || DEFAULTS[name] || ""}`);
  return hash.digest("hex").slice(0, 12);
}

/** Every file below dir, as paths relative to it with "/" separators */
function listFiles(dir) {
  return readdirSync(dir, { recursive: true })
    .map((file) => String(file).split("\\").join("/"))
    .filter((file) => statSync(join(dir, file)).isFile());
}

function inject({ buildDir = "dist", outDir = "dist_injected", env = process.env, log = console.log } = {}) {
  rmSync(outDir, { recursive: true, force: true });
  cpSync(buildDir, outDir, { recursive: true });

  const release = releaseId(buildDir, env);
  const assets = join(outDir, "assets");

  // the files Vite emitted: directly in assets/, never in its sub-folders
  const emitted = new Set(
    readdirSync(assets).filter((name) => statSync(join(assets, name)).isFile()),
  );

  // assets/<emitted name> or /assets/<emitted name>; a name followed by "/"
  // is a sub-folder (assets/web/...) and is left alone
  const reference = /assets\/([A-Za-z0-9_.~-]+)(?![A-Za-z0-9_.~/-])/g;

  let injected = 0;
  for (const file of listFiles(outDir)) {
    if (!TEXT.has(extname(file).toLowerCase())) continue;
    const path = join(outDir, file);
    const before = readFileSync(path, "utf-8");
    let data = before;

    for (const [placeholder, name] of Object.entries(PLACEHOLDERS)) {
      if (!data.includes(placeholder)) continue;
      const value = env[name] || DEFAULTS[name];
      data = value
        ? data.replaceAll(placeholder, value)
        : data.replaceAll(`"${placeholder}"`, "void 0");
      injected += 1;
    }

    data = data.replace(reference, (match, name) =>
      emitted.has(name) ? `assets/${release}/${name}` : match,
    );

    if (data !== before) writeFileSync(path, data);
  }

  mkdirSync(join(assets, release));
  for (const name of emitted) renameSync(join(assets, name), join(assets, release, name));

  log(`Release ${release}: ${emitted.size} files in assets/${release}/, ${injected} placeholder groups injected.`);
  return { release, moved: emitted.size };
}

module.exports = { inject, releaseId, PLACEHOLDERS, DEFAULTS };

if (require.main === module) inject();
