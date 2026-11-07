import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

// DIST must be set before the server module is loaded
const root = mkdtempSync(join(tmpdir(), "pp-"));
const dist = join(root, "dist");
mkdirSync(join(dist, "assets"), { recursive: true });
mkdirSync(join(root, "dist-secret"));
writeFileSync(join(dist, "index.html"), "<html></html>");
writeFileSync(join(dist, "assets", "a.js"), "1");
writeFileSync(join(root, "dist-secret", "x.txt"), "secret");
process.env.DIST = dist;

const { staticFile, countsLine } = await import("../src/server.mjs");

test("serves files inside the build", () => {
  assert.ok(staticFile("/assets/a.js"));
  assert.equal(staticFile("/assets/missing.js"), null);
});

test("never leaves the build folder", () => {
  assert.equal(staticFile("/../dist-secret/x.txt"), null);
  assert.equal(staticFile("/..%2Fdist-secret%2Fx.txt"), null);
  assert.equal(staticFile("/..%2fdist-secret/x.txt"), null);
  assert.equal(staticFile("/assets%5C..%5Ca.js"), null);
  assert.equal(staticFile("/%2e%2e/dist-secret/x.txt"), null);
  assert.equal(staticFile("/assets/%00.js"), null);
  assert.equal(staticFile("/%E0%A4%A"), null);
});

test("online count is optional", () => {
  assert.doesNotMatch(countsLine({ member_count: 120, language: "en" }), /online/);
  assert.doesNotMatch(
    countsLine({ member_count: 120, online_count: null, language: "en" }),
    /online/,
  );
  assert.match(
    countsLine({ member_count: 120, online_count: 40, language: "en" }),
    /online/,
  );
});

test("page policy lists the public API and media origins", async () => {
  const { contentSecurityPolicy } = await import("../src/server.mjs");
  process.env.PUBLIC_API_URL = "https://api.example.test";
  process.env.PUBLIC_MEDIA_URL = "https://cdn.example.test";
  process.env.API_URL = "http://api:14702";
  const policy = contentSecurityPolicy();
  assert.match(policy, /connect-src 'self' https:\/\/api\.example\.test wss:\/\/ws\.example\.test https:\/\/cdn\.example\.test/);
  assert.match(policy, /img-src 'self' data: blob: https:\/\/cdn\.example\.test/);
  assert.doesNotMatch(policy, /http:\/\/api:/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.doesNotMatch(policy, /script-src[^;]*unsafe-inline/);
});
