#!/usr/bin/env node
// Split the Bot API inventory (src/interface/developers/data/botApi.json)
// into the parts the docs pages load on their own, so a page only fetches
// what it shows:
//
//   botApi/meta.json              versions, counts, rate limits, permissions
//   botApi/index.json             one line per endpoint (search, tables)
//   botApi/gateway.json           events, client messages, types
//   botApi/errors.json            every error with cause and fix
//   botApi/out-of-scope.json      routes outside the bot reference
//   botApi/section-<name>.json    full endpoints of one reference section,
//                                 with the schemas they reference
//
// botApi.json stays the source (tools and tests read it); these files are
// derived from it. extract.mjs runs this after writing botApi.json, and
// docs.test.ts fails when the parts and botApi.json disagree.
//
// Usage (from web/packages/client): node scripts/bot-api/split.mjs [--check]

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(here, "../../src/interface/developers/data");
const SOURCE = join(DATA, "botApi.json");
const OUT = join(DATA, "botApi");

const refName = (ref) => ref.split("/").at(-1);

/** Every schema an endpoint uses, following references */
function schemaClosure(roots, schemas) {
  const found = new Set();
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node.$ref === "string") {
      const name = refName(node.$ref);
      if (!found.has(name) && schemas[name]) {
        found.add(name);
        visit(schemas[name]);
      }
    }
    for (const value of Object.values(node)) visit(value);
  };
  roots.forEach(visit);
  return found;
}

/** The parts, by file name */
export function splitInventory(inventory) {
  const parts = {};
  parts["meta.json"] = {
    generated: inventory.generated,
    counts: inventory.counts,
    rateLimits: inventory.rateLimits,
    permissions: inventory.permissions,
    errorStatus: inventory.errorStatus,
    rateLimitHeaders: inventory.rateLimitHeaders,
    problems: inventory.problems,
  };
  parts["index.json"] = inventory.endpoints.map((e) => ({
    id: e.id,
    title: e.title,
    method: e.method,
    path: e.path,
    section: e.section,
    status: e.status,
    rateLimit: e.rateLimit,
    restriction: e.restrictions[0] ?? null,
    botRejectedWith: e.auth.botRejectedWith,
  }));
  parts["gateway.json"] = inventory.gateway;
  parts["errors.json"] = inventory.errors;
  parts["out-of-scope.json"] = inventory.outOfScope;

  const sections = [...new Set(inventory.endpoints.map((e) => e.section))];
  for (const section of sections) {
    const endpoints = inventory.endpoints.filter((e) => e.section === section);
    const names = schemaClosure(
      endpoints.map((e) => [e.requestBody, e.response, e.parameters]),
      inventory.schemas,
    );
    parts[`section-${section}.json`] = {
      endpoints,
      schemas: Object.fromEntries(
        [...names].sort().map((name) => [name, inventory.schemas[name]]),
      ),
    };
  }
  return parts;
}

const serialise = (value) => JSON.stringify(value) + "\n";

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const parts = splitInventory(JSON.parse(readFileSync(SOURCE, "utf8")));
  if (process.argv.includes("--check")) {
    const stale = Object.entries(parts).filter(([name, value]) => {
      try {
        return readFileSync(join(OUT, name), "utf8") !== serialise(value);
      } catch {
        return true;
      }
    });
    const extra = readdirSync(OUT).filter((name) => !(name in parts));
    if (stale.length || extra.length) {
      console.error(
        `botApi parts are out of date (${[...stale.map(([n]) => n), ...extra].join(", ")}): run node scripts/bot-api/split.mjs`,
      );
      process.exit(1);
    }
    console.log("botApi parts are up to date");
  } else {
    mkdirSync(OUT, { recursive: true });
    for (const [name, value] of Object.entries(parts))
      writeFileSync(join(OUT, name), serialise(value));
    console.log(`wrote ${Object.keys(parts).length} parts to ${OUT}`);
  }
}
