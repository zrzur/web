import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import { sandboxDocument } from "./sandbox";

const require = createRequire(import.meta.url);
const { PLUGIN_SANDBOX_SCRIPT, contentSecurityPolicy } =
  require("../../../../docker/csp.js") as {
    PLUGIN_SANDBOX_SCRIPT: string;
    contentSecurityPolicy: (env: Record<string, string>) => string;
  };

/** The inline boot script of the sandbox document, as the browser hashes it */
function bootScript(nonce: string) {
  const html = sandboxDocument(nonce);
  const match = /<script nonce="[^"]*">([\s\S]*?)<\/script>/.exec(html);
  if (!match) throw new Error("no boot script in the sandbox document");
  return match[1];
}

describe("plugin sandbox under the app's page policy", () => {
  it("the web server's policy carries the hash of the boot script", () => {
    const hash = createHash("sha256")
      .update(bootScript("abc"))
      .digest("base64");
    expect(PLUGIN_SANDBOX_SCRIPT).toBe(`'sha256-${hash}'`);
  });

  it("the hash does not depend on the nonce", () => {
    expect(bootScript("one")).toBe(bootScript("two"));
  });

  it("is in script-src of the policy the server sends", () => {
    const policy = contentSecurityPolicy({
      VITE_API_URL: "https://api.zrzur.com",
    });
    const script = /script-src ([^;]*)/.exec(policy)?.[1] ?? "";
    expect(script.split(" ")).toContain(PLUGIN_SANDBOX_SCRIPT);
  });
});
