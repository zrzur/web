// Static server for the built web client (replaces `sirv` without cache
// headers, which made every visit re-download the whole app).
//
// - /assets/* (hashed names): cached for a week. Not "immutable": inject.js
//   writes runtime URLs into these files after the build, so the same name
//   can change when the deployment's URLs change.
// - emoji, badges, decorations and other static art: cached for 30 days.
// - index.html and anything else: always revalidated, so updates roll out.
// - ETags on everything, so revalidation is a cheap 304.
// - Text files (JS, CSS, HTML, SVG, JSON) are gzipped once and kept in memory.
// - Unknown paths fall back to index.html (single-page app), CORS open as
//   before (`sirv --cors`).
const { createServer } = require("node:http");
const { createHash } = require("node:crypto");
const { readFileSync, statSync, existsSync } = require("node:fs");
const { join, extname, resolve, sep } = require("node:path");
const { gzipSync } = require("node:zlib");

const ROOT = resolve(process.argv[2] || "dist_injected");
const PORT = Number(process.env.PORT || 5000);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
};

const COMPRESSIBLE = /\.(html|js|mjs|css|json|webmanifest|svg|txt|map)$/i;

const LONG_LIVED = /^\/(emoji|badges|decorations|brand|assets_fallback|third-party|sounds)\//;

/** Cache-Control for a request path */
function cacheControl(path) {
  if (path.startsWith("/assets/")) return "public, max-age=604800";
  if (LONG_LIVED.test(path)) return "public, max-age=2592000";
  return "no-cache";
}

// Files don't change while the container runs (inject.js ran before us),
// so keep each file's bytes and ETag after the first read.
const cache = new Map();
function load(file) {
  let entry = cache.get(file);
  if (!entry) {
    const body = readFileSync(file);
    const etag = `"${createHash("sha1").update(body).digest("base64url").slice(0, 22)}"`;
    const gzip =
      COMPRESSIBLE.test(file) && !file.endsWith(".map") && body.length > 1024
        ? gzipSync(body, { level: 9 })
        : null;
    entry = { body, etag, gzip: gzip && gzip.length < body.length ? gzip : null };
    // keep everything in memory except source maps (big, rarely asked for)
    if (!file.endsWith(".map")) cache.set(file, entry);
  }
  return entry;
}

function resolveFile(path) {
  const file = join(ROOT, path);
  if (file !== ROOT && !file.startsWith(ROOT + sep)) return null;
  try {
    if (existsSync(file) && statSync(file).isFile()) return file;
  } catch {
    return null;
  }
  return null;
}

createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD" });
    return res.end();
  }

  let path;
  try {
    path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }

  let file = resolveFile(path);
  let servedPath = path;
  if (!file) {
    // a missing asset is a real 404; anything else is a client-side route
    if (/\.[a-z0-9]+$/i.test(path) && !path.endsWith(".html")) {
      res.writeHead(404, { "access-control-allow-origin": "*" });
      return res.end();
    }
    file = join(ROOT, "index.html");
    servedPath = "/index.html";
  }

  const { body, etag, gzip } = load(file);
  const headers = {
    "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
    "cache-control": cacheControl(servedPath),
    etag,
    "access-control-allow-origin": "*",
    "x-content-type-options": "nosniff",
    // no other site may frame the app (clickjacking, e.g. the OAuth
    // "Authorize" page); the app's own plugin iframes are unaffected
    "content-security-policy": "frame-ancestors 'none'",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    vary: "accept-encoding",
  };

  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }

  const zipped = gzip && /\bgzip\b/.test(req.headers["accept-encoding"] ?? "");
  const payload = zipped ? gzip : body;
  if (zipped) headers["content-encoding"] = "gzip";
  headers["content-length"] = payload.length;
  res.writeHead(200, headers);
  res.end(req.method === "HEAD" ? undefined : payload);
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Serving ${ROOT} on port ${PORT}`);
});
