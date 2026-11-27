#!/usr/bin/env node
// The Bot API as its own OpenAPI document: only the routes a bot can call
// (the reference's "for bots" routes: allowed for a bot token and not
// marked unsupported), the types they use, and the bot token as the one way
// to sign in. Developers generate a client from it in any language; the full
// document (GET /openapi.json) also has the app's own routes. A static file
// in public/, served as it is:
//
//   public/developers/bot-api.openapi.json
//     →  https://app.zrzur.com/developers/bot-api.openapi.json
//
// Usage (from web/packages/client): node scripts/bot-api/bot-openapi.mjs [--check]
// docs.test.ts fails when the committed file is not what this script makes.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SPEC = join(here, "openapi.snapshot.json");
const INVENTORY = resolve(
  here,
  "../../src/interface/developers/data/botApi.json",
);
export const OUT = resolve(
  here,
  "../../public/developers/bot-api.openapi.json",
);

const METHODS = ["get", "put", "post", "delete", "patch"];
const BOT = "BotToken";

/** Ids (`METHOD /path`) of the routes a bot can use */
export function botRouteIds(inventory) {
  return new Set(
    inventory.endpoints
      .filter(
        (e) => e.inScope && e.auth?.botAccepted && e.status !== "unsupported",
      )
      .map((e) => e.id),
  );
}

/** Every `#/components/schemas/X` a value points to */
function refsOf(node, into) {
  if (Array.isArray(node)) for (const v of node) refsOf(v, into);
  else if (node && typeof node === "object")
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref" && typeof value === "string") {
        const name = value.match(/^#\/components\/schemas\/(.+)$/)?.[1];
        if (name) into.add(name);
      } else refsOf(value, into);
    }
  return into;
}

/** The bot's document, made from the whole one and the reference's list */
export function botDocument(spec, inventory) {
  const ids = botRouteIds(inventory);
  const paths = {};
  for (const [path, item] of Object.entries(spec.paths)) {
    const kept = {};
    for (const [key, value] of Object.entries(item)) {
      if (!METHODS.includes(key)) {
        // parameters shared by the path's operations
        if (key === "parameters") kept[key] = value;
        continue;
      }
      if (!ids.has(`${key.toUpperCase()} ${path}`)) continue;
      const operation = { ...value };
      // a bot signs in with its token; routes with their own token (an
      // interaction, a webhook) keep having none
      if (operation.security) {
        const bot = operation.security.filter((requirement) =>
          Object.keys(requirement).every((name) => name === BOT),
        );
        operation.security = bot.length ? bot : [{ [BOT]: [] }];
      }
      kept[key] = operation;
    }
    if (Object.keys(kept).some((key) => METHODS.includes(key)))
      paths[path] = kept;
  }

  // the types the routes use, and the types those use
  const all = spec.components.schemas;
  const needed = refsOf(paths, new Set());
  for (const queue = [...needed]; queue.length; ) {
    const name = queue.pop();
    for (const next of refsOf(all[name], new Set()))
      if (!needed.has(next)) {
        needed.add(next);
        queue.push(next);
      }
  }
  const schemas = Object.fromEntries(
    Object.keys(all)
      .filter((name) => needed.has(name))
      .map((name) => [name, all[name]]),
  );

  const usedTags = new Set(
    Object.values(paths).flatMap((item) =>
      METHODS.flatMap((m) => item[m]?.tags ?? []),
    ),
  );

  return {
    openapi: spec.openapi,
    info: {
      ...spec.info,
      title: "Zrzur Bot API",
      description:
        "The routes a bot can use, with the bot token (x-bot-token). Made from the Zrzur API; the gateway's events are in GET /gateway/schema. Documentation: https://app.zrzur.com/developers/docs",
    },
    servers: spec.servers,
    externalDocs: spec.externalDocs,
    tags: (spec.tags ?? []).filter((tag) => usedTags.has(tag.name)),
    paths,
    components: {
      schemas,
      securitySchemes: { [BOT]: spec.components.securitySchemes[BOT] },
    },
  };
}

export const botDocumentText = (spec, inventory) =>
  `${JSON.stringify(botDocument(spec, inventory), null, 2)}\n`;

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const text = botDocumentText(
    JSON.parse(readFileSync(SPEC, "utf8")),
    JSON.parse(readFileSync(INVENTORY, "utf8")),
  );
  if (process.argv.includes("--check")) {
    let current = "";
    try {
      current = readFileSync(OUT, "utf8");
    } catch {
      // missing counts as out of date
    }
    if (current !== text) {
      console.error(
        "bot-api.openapi.json is out of date: run node scripts/bot-api/bot-openapi.mjs",
      );
      process.exit(1);
    }
    console.log("bot-api.openapi.json is up to date");
  } else {
    mkdirSync(join(OUT, ".."), { recursive: true });
    writeFileSync(OUT, text);
    const doc = JSON.parse(text);
    console.log(
      `wrote ${OUT}: ${Object.keys(doc.paths).length} paths, ${Object.keys(doc.components.schemas).length} types`,
    );
  }
}
