// The web container's server: /build.json (version and commit of what runs)
// may be read by any site, for zrzur.com/source; nothing else gets that header.
// Run: node --test docker/server.test.js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtempSync, writeFileSync } = require("node:fs");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

function freePort() {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.once("error", fail);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });
}

test("build.json is served to any origin; other files are not", async () => {
  const root = mkdtempSync(join(tmpdir(), "zrzur-web-"));
  const build = {
    product: "Zrzur",
    component: "web",
    version: "26.1.0-beta.3",
    commit: "a".repeat(40),
  };
  writeFileSync(join(root, "index.html"), "<!doctype html><title>x</title>");
  writeFileSync(join(root, "build.json"), JSON.stringify(build));
  writeFileSync(join(root, "manifest.json"), "{}");
  const port = await freePort();
  const server = spawn(process.execPath, [join(__dirname, "server.js"), root], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      VITE_API_URL: "http://127.0.0.1:9/",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await new Promise((done, fail) => {
      server.stdout.on(
        "data",
        (chunk) => String(chunk).includes("Serving") && done(),
      );
      server.once("exit", (code) => fail(new Error(`server exited ${code}`)));
    });
    const res = await fetch(`http://127.0.0.1:${port}/build.json`, {
      headers: { origin: "https://zrzur.com" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
    assert.equal(res.headers.get("cache-control"), "no-cache");
    assert.deepEqual(await res.json(), build);
    const other = await fetch(`http://127.0.0.1:${port}/manifest.json`);
    assert.equal(other.status, 200);
    assert.equal(other.headers.get("access-control-allow-origin"), null);
  } finally {
    server.kill();
  }
});
