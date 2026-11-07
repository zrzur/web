// Prints/writes scripts/shared-scripts.sha256 for the scripts that are copied
// into web, website and desktop. After changing one, copy it to the other two
// repos and run: node scripts/hash-shared.mjs > scripts/shared-scripts.sha256
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
for (const f of ["release-info.mjs", "third-party-notices.mjs"]) {
  const text = readFileSync(new URL(`./${f}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
  console.log(`${createHash("sha256").update(text).digest("hex")}  ${f}`);
}
