#!/usr/bin/env node
// Every name the documentation pages put in `code` must exist in the API:
// an event, a client message, an error type, a permission, a schema or one
// of its fields or enum values, a rate-limit bucket, an intent, a header.
// A name that is nowhere in the OpenAPI snapshot, the gateway schema or the
// inventory is printed with its page, to be fixed or added to the list of
// words that are code but not API names (check-names.allow.json).
//
// Usage (from web/packages/client): node scripts/bot-api/check-names.mjs
// Exit code 1 when a name is unknown.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { inlineCodeOf } from "../../src/interface/developers/docs/markdownTree.ts";

const here = dirname(fileURLToPath(import.meta.url));
const client = resolve(here, "../..");
const json = (path) => JSON.parse(readFileSync(path, "utf8"));

const openapi = json(join(here, "openapi.snapshot.json"));
const gateway = json(join(here, "gateway.schema.snapshot.json"));
const inventory = json(
  join(client, "src/interface/developers/data/botApi.json"),
);
const allow = new Set(json(join(here, "check-names.allow.json")));

/** Every property name, enum value, schema name and `type` constant */
const known = new Set();
const walk = (node) => {
  if (Array.isArray(node)) return node.forEach(walk);
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (key === "properties" && value && typeof value === "object")
      Object.keys(value).forEach((name) => known.add(name));
    if (key === "enum" && Array.isArray(value))
      value.forEach((item) => typeof item === "string" && known.add(item));
    if (
      (key === "schemas" || key === "definitions") &&
      value &&
      typeof value === "object"
    )
      Object.keys(value).forEach((name) => known.add(name));
    walk(value);
  }
};
walk(openapi.components);
walk(gateway.server);
walk(gateway.client);
for (const [path, methods] of Object.entries(openapi.paths)) {
  for (const part of path.matchAll(/\{(\w+)\}/g)) known.add(part[1]);
  for (const operation of Object.values(methods))
    for (const parameter of operation.parameters ?? [])
      known.add(parameter.name);
}
Object.keys(gateway.intents).forEach((name) => known.add(name));
inventory.permissions.forEach((permission) => known.add(permission.name));
inventory.errors.forEach((error) => {
  known.add(error.type);
  error.fields.forEach((field) => known.add(field));
});
Object.keys(inventory.errorStatus).forEach((name) => known.add(name));
Object.keys(inventory.rateLimits.buckets).forEach((name) => known.add(name));
inventory.gateway.events.forEach((event) => known.add(event.name));
inventory.gateway.clientMessages.forEach((message) => known.add(message.name));

/** The names one piece of inline code claims: identifiers, dotted or not */
function namesIn(code) {
  // a call, a path, an address, a command line or a value is not a name
  if (/^(GET|POST|PUT|PATCH|DELETE) \//.test(code)) return [];
  if (/[/:=(<>$ ]|^\d|^[-.@#!]/.test(code) && !/^[\w.[\]]+$/.test(code))
    return [];
  return code
    .split(/[.[\]]+/)
    .filter((part) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(part));
}

const content = join(client, "src/interface/developers/docs/content");
const unknown = new Map();
for (const file of readdirSync(content).filter((name) =>
  name.endsWith(".md"),
)) {
  for (const code of inlineCodeOf(readFileSync(join(content, file), "utf8")))
    for (const name of namesIn(code)) {
      if (known.has(name) || allow.has(name)) continue;
      // only names shaped like API names: CamelCase, snake_case, UPPER_CASE
      if (!/[A-Z]/.test(name) && !name.includes("_")) continue;
      const pages = unknown.get(name) ?? new Set();
      pages.add(file.replace(/\.md$/, ""));
      unknown.set(name, pages);
    }
}

for (const [name, pages] of [...unknown].sort(([a], [b]) => a.localeCompare(b)))
  console.log(`${name}\t${[...pages].join(", ")}`);
console.log(`${unknown.size} unknown names`);
process.exit(unknown.size ? 1 : 0);
