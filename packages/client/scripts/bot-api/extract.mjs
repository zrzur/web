#!/usr/bin/env node
// Build the Bot API inventory for the Developer Portal docs from the real
// code: backend routes (delta), the rate-limit table, the error status map,
// the gateway (bonfire) events, both SDKs and the API's OpenAPI document.
//
// Usage (from web/packages/client):
//   node scripts/bot-api/extract.mjs [--backend ../../../backend] [--ref HEAD]
//     [--openapi http://127.0.0.1:31702/openapi.json | file.json] [--check]
//
// Backend files are read with `git show <ref>:<path>`, so uncommitted work in
// the backend checkout never leaks into the docs. `--check` regenerates the
// inventory and fails when the committed file is out of date.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const clientRoot = resolve(here, "../..");
const webRoot = resolve(clientRoot, "../..");
const OUT = join(clientRoot, "src/interface/developers/data/botApi.json");

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((arg, i, all) =>
      arg.startsWith("--")
        ? [
            arg.slice(2),
            all[i + 1]?.startsWith("--") || all[i + 1] === undefined
              ? true
              : all[i + 1],
          ]
        : null,
    )
    .filter(Boolean),
);

const backend = resolve(clientRoot, args.backend ?? "../../../backend");
const ref = args.ref ?? "HEAD";
const openapiSource = args.openapi ?? join(here, "openapi.snapshot.json");

const git = (...a) =>
  execFileSync("git", ["-c", "safe.directory=*", "-C", backend, ...a], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
const show = (path) => git("show", `${ref}:${path}`);
const exists = (path, files) => files.has(path);

/* ------------------------------------------------------------------ */
/* Backend: routes                                                     */
/* ------------------------------------------------------------------ */

const ROUTES = "crates/delta/src/routes";
const files = new Set(
  git("ls-tree", "-r", "--name-only", ref, ROUTES).split("\n").filter(Boolean),
);
const revision = git("rev-parse", "--short=8", ref).trim();

/** Strip comments (keeps doc comments as their own lines) */
const stripLineComments = (src) => src.replace(/^\s*\/\/(?!\/).*$/gm, "");

/** Index of the `}` matching the `{` at `open`, skipping strings */
function matchBrace(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"') {
      for (i++; i < src.length && src[i] !== '"'; i++) if (src[i] === "\\") i++;
      continue;
    }
    if (c === "r" && src[i + 1] === "#" && src[i + 2] === '"') {
      const end = src.indexOf('"#', i + 3);
      i = end === -1 ? src.length : end + 1;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      i = src.indexOf("\n", i);
      if (i === -1) return src.length;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i;
  }
  return src.length;
}

/** Module path ["channels","message_send"] → file path */
function moduleFile(modPath) {
  const base = `${ROUTES}/${modPath.join("/")}`;
  if (exists(`${base}.rs`, files)) return `${base}.rs`;
  if (exists(`${base}/mod.rs`, files)) return `${base}/mod.rs`;
  return null;
}

/** Parse every route function in a file */
const fnCache = new Map();
function routeFunctions(file) {
  if (fnCache.has(file)) return fnCache.get(file);
  const src = show(file);
  const out = new Map();
  const re =
    /((?:[ \t]*\/\/\/.*\n)*)[ \t]*#\[openapi\(([^)]*)\)\]\s*((?:#\[[^\]]*\]\s*)*?)#\[(get|post|put|patch|delete)\(\s*"([^"]*)"([^\]]*)\]\s*((?:#\[[^\]]*\]\s*)*)pub\s+async\s+fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const [, docs, openapiAttr, , method, path, , , name] = m;
    // parameters: up to the matching `)`
    let depth = 1;
    let i = re.lastIndex;
    for (; i < src.length && depth; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
    }
    const params = src.slice(re.lastIndex, i - 1);
    const open = src.indexOf("{", i);
    const close = matchBrace(src, open);
    const body = src.slice(open, close + 1);
    out.set(name, {
      file,
      line: src.slice(0, m.index + docs.length).split("\n").length,
      docs: docs
        .split("\n")
        .map((l) => l.replace(/^\s*\/\/\/ ?/, ""))
        .filter((l) => l !== undefined)
        .join("\n")
        .trim(),
      openapi: openapiAttr,
      method: method.toUpperCase(),
      path,
      name,
      params,
      body: stripLineComments(body),
    });
  }
  fnCache.set(file, out);
  return out;
}

/** Read `openapi_get_routes_spec![...]` of a module's routes function */
function routeList(modPath, fnName) {
  const file = moduleFile(modPath);
  if (!file) return [];
  const src = show(file);
  const at = src.search(new RegExp(`pub fn ${fnName}\\s*\\(`));
  if (at === -1) return [];
  const macro = src.indexOf("openapi_get_routes_spec!", at);
  const open = src.indexOf("[", macro);
  const close = src.indexOf("]", open);
  return src
    .slice(open + 1, close)
    .replace(/\/\/.*$/gm, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split("::");
      const fn = parts.pop();
      const path = [...modPath];
      for (const p of parts) {
        if (p === "super") path.pop();
        else if (p === "self") continue;
        else path.push(p);
      }
      return { modPath: path, fn };
    });
}

// Top-level mounts: "/prefix" => module::fn()
const mountSrc = show(`${ROUTES}/mod.rs`);
const mountBlock = mountSrc.slice(
  mountSrc.indexOf("mount_endpoints_and_merged_docs!"),
  mountSrc.indexOf("}", mountSrc.indexOf("mount_endpoints_and_merged_docs!")),
);
const mounts = [...mountBlock.matchAll(/"(\/[^"]*)"\s*=>\s*([\w:]+)\(\)/g)].map(
  ([, prefix, call]) => {
    const parts = call.split("::");
    return { prefix, modPath: parts.slice(0, -1), fn: parts.at(-1) };
  },
);

const routes = [];
for (const mount of mounts) {
  for (const entry of routeList(mount.modPath, mount.fn)) {
    const file = moduleFile(entry.modPath);
    const fn = file && routeFunctions(file).get(entry.fn);
    if (!fn) {
      routes.push({
        unresolved: `${entry.modPath.join("::")}::${entry.fn}`,
        prefix: mount.prefix,
      });
      continue;
    }
    const routePath = fn.path.split("?")[0];
    // Rocket serves `/prefix` + `/` as `/prefix`
    const full =
      (mount.prefix.replace(/\/$/, "") + routePath)
        .replace(/<([^>.]+)(\.\.)?>/g, "{$1}")
        .replace(/(.)\/$/, "$1") || "/";
    const query = [
      ...(fn.path.split("?")[1] ?? "").matchAll(/<(\w+)(\.\.)?>/g),
    ].map(([, q, rest]) => ({
      name: q,
      spread: !!rest,
    }));
    routes.push({ ...fn, fullPath: full, query });
  }
}

/* ------------------------------------------------------------------ */
/* Classification                                                      */
/* ------------------------------------------------------------------ */

/** Who may call a route, from the guards in its signature and early checks */
function classifyAuth(fn) {
  const p = fn.params;
  const user = /:\s*User\b/.test(p);
  const optionalUser = /Option<\s*User\s*>/.test(p);
  const sessionOnly =
    /:\s*(Session|Account|ValidatedTicket|UnvalidatedTicket)\b/.test(p);
  const webhookToken =
    /\{token\}/.test(fn.fullPath) && /webhooks/.test(fn.fullPath);
  const interactionToken =
    /^\/interactions\/\{interaction_id\}\/\{token\}/.test(fn.fullPath);
  const body = fn.body;

  const rejectBot = body.match(
    /if\s+user\.bot\.is_some\(\)\s*(?:\|\|[^{]*)?\{\s*return\s+Err\(\s*create_error!\(\s*(\w+)/,
  );
  const conditionalBot = [
    ...body.matchAll(
      /if\s+user\.bot\.is_some\(\)\s*&&\s*([^{]+)\{\s*return\s+Err\(\s*create_error!\(\s*(\w+)/g,
    ),
  ].map(([, condition, error]) => ({ condition: condition.trim(), error }));
  const botsOnly = [
    ...body.matchAll(
      /if\s+user\.bot\.is_none\(\)\s*\{\s*return\s+Err\(\s*create_error!\(\s*(\w+)/g,
    ),
  ].map(([, error]) => error);
  // admin-only routes refuse everyone who is not privileged up front
  const privileged =
    /if\s+(?:user\.bot\.is_some\(\)\s*\|\|\s*)?!user\.privileged\s*\{\s*return\s+Err/.test(
      body,
    ) || /require_admin|assert_admin|AdminUser|is_staff/.test(body + p);
  const privilegedFields = !privileged && /!user\.privileged/.test(body);

  let mode;
  if (interactionToken) mode = "interaction-token";
  else if (webhookToken && !user) mode = "webhook-token";
  // bots have no account or session, so those guards always refuse them
  else if (sessionOnly) mode = "session-only";
  else if (user) mode = rejectBot ? "user-only" : "user-or-bot";
  else if (optionalUser) mode = rejectBot ? "public-user-only" : "public";
  else mode = "public";

  return {
    mode,
    botAccepted: [
      "user-or-bot",
      "interaction-token",
      "webhook-token",
      "public",
    ].includes(mode),
    botRejectedWith: rejectBot?.[1],
    conditionalBot,
    botsOnly,
    privileged,
    privilegedFields,
  };
}

/** Permissions named in the route body */
const permissionsOf = (body) => [
  ...new Set(
    [...body.matchAll(/\b(Channel|Server|User)Permission::(\w+)/g)].map(
      ([, scope, perm]) => `${scope}:${perm}`,
    ),
  ),
];

/** Errors the route raises itself, plus the ones implied by its lookups */
function errorsOf(fn, auth) {
  const set = new Set(
    [...fn.body.matchAll(/create_error!\(\s*(\w+)/g)].map(([, e]) => e),
  );
  if (/\.as_channel\(/.test(fn.body)) set.add("UnknownChannel");
  if (/\.as_server\(/.test(fn.body)) set.add("UnknownServer");
  if (/\.as_message\w*\(/.test(fn.body)) set.add("UnknownMessage");
  if (/\.as_user\(/.test(fn.body)) set.add("UnknownUser");
  if (/\.as_member\(|fetch_member\(/.test(fn.body)) set.add("NotFound");
  if (/throw_if_lacking|throw_permission/.test(fn.body))
    set.add("MissingPermission");
  if (/\.validate\(\)/.test(fn.body)) set.add("FailedValidation");
  if (auth.mode !== "public") set.add("InvalidSession");
  return [...set].sort();
}

// error → HTTP status
const STATUS = {
  Ok: 200,
  BadRequest: 400,
  Unauthorized: 401,
  PaymentRequired: 402,
  Forbidden: 403,
  NotFound: 404,
  MethodNotAllowed: 405,
  NotAcceptable: 406,
  Conflict: 409,
  Gone: 410,
  PayloadTooLarge: 413,
  UnsupportedMediaType: 415,
  UnprocessableEntity: 422,
  Locked: 423,
  FailedDependency: 424,
  PreconditionFailed: 412,
  TooManyRequests: 429,
  UnavailableForLegalReasons: 451,
  InternalServerError: 500,
  NotImplemented: 501,
  BadGateway: 502,
  ServiceUnavailable: 503,
  GatewayTimeout: 504,
};
const errorStatus = {};
for (const [, name, status] of show(
  "crates/core/result/src/rocket.rs",
).matchAll(/ErrorType::(\w+)(?:\s*\{[^}]*\})?\s*=>\s*Status::(\w+)/g)) {
  errorStatus[name] = STATUS[status] ?? status;
}

/* ------------------------------------------------------------------ */
/* Rate limits (mirror of crates/delta/src/util/ratelimits.rs)         */
/* ------------------------------------------------------------------ */

const rlSrc = show("crates/delta/src/util/ratelimits.rs");
const bucketLimits = Object.fromEntries(
  [
    ...rlSrc
      .slice(rlSrc.indexOf("fn resolve_bucket_limit"))
      .matchAll(/"(\w+)"\s*=>\s*(\d+)/g),
  ].map(([, b, n]) => [b, +n]),
);
const defaultLimit = +(
  rlSrc
    .slice(rlSrc.indexOf("fn resolve_bucket_limit"))
    .match(/_\s*=>\s*(\d+)/)?.[1] ?? 20
);
const windowSeconds = +(
  show("crates/core/ratelimits/src/ratelimiter.rs").match(
    /Duration::from_secs\((\d+)\)/,
  )?.[1] ?? 10
);

function bucketOf(method, path) {
  const [segment, resource, extra] = path.split("/").filter(Boolean);
  switch (segment) {
    case "users":
      if (method === "PATCH") return ["user_edit", "per user"];
      return extra === "default_avatar"
        ? ["default_avatar", null]
        : ["users", null];
    case "bots":
      return ["bots", null];
    case "interactions":
      if (resource === "autocomplete")
        return ["interactions_autocomplete", null];
      if (resource) return ["interaction_callbacks", "per interaction"];
      return ["interactions", null];
    case "channels":
      if (resource && method === "POST" && extra === "messages")
        return ["messaging", "per channel"];
      return resource ? ["channels", "per channel"] : ["any_dlta", null];
    case "servers":
      return resource ? ["servers", "per server"] : ["any_dlta", null];
    case "auth":
      return [method === "DELETE" ? "auth_delete" : "auth", null];
    case "discover":
      return ["discover", null];
    default:
      return ["any_dlta", null];
  }
}
// drift guard: every bucket used above must still exist in the Rust table
for (const b of [
  "user_edit",
  "users",
  "default_avatar",
  "bots",
  "interactions_autocomplete",
  "interaction_callbacks",
  "interactions",
  "messaging",
  "channels",
  "servers",
  "auth",
  "auth_delete",
  "discover",
  "any_dlta",
]) {
  if (!rlSrc.includes(`"${b}"`))
    throw new Error(`rate-limit bucket ${b} no longer exists in ratelimits.rs`);
}

/* ------------------------------------------------------------------ */
/* Gateway                                                             */
/* ------------------------------------------------------------------ */

function enumVariants(src, enumName) {
  const at = src.indexOf(`pub enum ${enumName}`);
  const body = src.slice(
    src.indexOf("{", at),
    matchBrace(src, src.indexOf("{", at)) + 1,
  );
  const out = [];
  // variants are the identifiers indented by exactly four spaces
  for (const [, docs, name] of body.matchAll(
    /((?:\n {4}\/\/\/.*)*)\n {4}([A-Z]\w*)\b/g,
  )) {
    out.push({
      name,
      docs: docs
        .split("\n")
        .map((l) => l.replace(/^\s*\/\/\/ ?/, ""))
        .join(" ")
        .trim(),
    });
  }
  return out;
}
const clientEvents = enumVariants(
  show("crates/core/database/src/events/client.rs"),
  "EventV1",
);
const serverMessages = enumVariants(
  show("crates/core/database/src/events/server.rs"),
  "ClientMessage",
);

/** Permission bits with their doc comments */
const permissions = [
  ...show("crates/core/permissions/src/models/channel.rs").matchAll(
    /\/\/\/ (.+)\n\s+(\w+) = 1 << (\d+),/g,
  ),
].map(([, description, name, bit]) => ({
  name,
  bit: +bit,
  value: (1n << BigInt(bit)).toString(),
  description,
}));

/** Events published directly by a route body */
const eventsOf = (body) => [
  ...new Set([...body.matchAll(/EventV1::(\w+)/g)].map(([, e]) => e)),
];

/* ------------------------------------------------------------------ */
/* SDKs                                                                */
/* ------------------------------------------------------------------ */

function walk(dir, ext) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, ext));
    else if (name.endsWith(ext) && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

/** Normalise `/channels/${id}/messages?${q}` → `/channels/{}/messages` */
const shape = (path) =>
  path
    .split("?")[0]
    .replace(/\$\{[^}]*\}/g, "{}")
    .replace(/\{[^}]*\}/g, "{}")
    .replace(/\/$/, "") || "/";

function sdkCalls(root, pattern, pkg, base = webRoot) {
  const calls = [];
  for (const file of walk(root, ".ts")) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(pattern)) {
      const method = m.groups.method.toUpperCase();
      const path = m.groups.tpl ?? m.groups.str;
      const before = src.slice(0, m.index);
      const fnMatch = [
        ...before.matchAll(
          /^\s{2}(?:async\s+|static\s+|get\s+|readonly\s+)*(#?\w+)\s*(?:<[^>]*>)?\s*\(/gm,
        ),
      ].at(-1);
      const cls = [
        ...before.matchAll(/export\s+(?:abstract\s+)?class\s+(\w+)/g),
      ].at(-1)?.[1];
      calls.push({
        package: pkg,
        method,
        shape: shape(path),
        fn: `${cls ? `${cls}.` : ""}${fnMatch?.[1] ?? "?"}`,
        file: relative(base, file).replaceAll("\\", "/"),
      });
    }
  }
  return calls;
}

// both entry points of @zrzur/sdk (the submodule packages/stoat.js)
const sdk = [
  ...sdkCalls(
    join(webRoot, "packages/stoat.js/src/bot"),
    /rest\s*\.(?<method>get|post|put|patch|delete)\(\s*(?:`(?<tpl>\/[^`]*)`|["'](?<str>\/[^"']*)["'])/g,
    "@zrzur/sdk/bot",
  ),
  ...sdkCalls(
    join(webRoot, "packages/stoat.js/src/bot"),
    /rest\s*\.req\(\s*"(?<method>get|post|put|patch|delete)",\s*(?:`(?<tpl>\/[^`]*)`|["'](?<str>\/[^"']*)["'])/g,
    "@zrzur/sdk/bot",
  ),
  ...sdkCalls(
    join(webRoot, "packages/stoat.js/src/solid"),
    /api\s*\.(?<method>get|post|put|patch|delete)\(\s*(?:`(?<tpl>\/[^`]*)`|["'](?<str>\/[^"']*)["'])/g,
    "@zrzur/sdk/solid",
  ),
];

/* ------------------------------------------------------------------ */
/* OpenAPI                                                             */
/* ------------------------------------------------------------------ */

async function loadOpenApi() {
  if (/^https?:\/\//.test(openapiSource)) {
    const url = new URL(openapiSource);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
      throw new Error(
        "refusing to read the OpenAPI document from a non-loopback host",
      );
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OpenAPI fetch failed: ${res.status}`);
    return res.json();
  }
  return JSON.parse(readFileSync(openapiSource, "utf8"));
}

const openapi = await loadOpenApi();
const opKey = (method, path) => `${method} ${path.replace(/\/$/, "") || "/"}`;
const operations = new Map();
for (const [path, item] of Object.entries(openapi.paths)) {
  for (const [method, op] of Object.entries(item)) {
    if (["get", "post", "put", "patch", "delete"].includes(method))
      operations.set(opKey(method.toUpperCase(), path), {
        ...op,
        path,
        method: method.toUpperCase(),
      });
  }
}

/* ------------------------------------------------------------------ */
/* Scope                                                               */
/* ------------------------------------------------------------------ */

// Areas a third-party bot can use. Everything else (accounts, sessions, MFA,
// billing, store, plugins, community gallery, safety, admin) is out of scope.
const SECTION_BY_TAG = {
  Core: "getting-started",
  "User Information": "users",
  "Direct Messaging": "users",
  Relationships: "users",
  "Channel Information": "channels",
  "Channel Invites": "channels",
  "Channel Permissions": "roles",
  Groups: "channels",
  Messaging: "messages",
  Interactions: "interactions",
  "Application Commands": "interactions",
  Voice: "voice",
  "Server Information": "servers",
  "Server Members": "members",
  "Server Permissions": "roles",
  "Server Customisation": "servers",
  Emojis: "servers",
  Invites: "servers",
  Webhooks: "channels",
  "Audit Logs": "moderation",
  Bots: "authentication",
  Threads: "channels",
  OAuth2: "oauth2",
};
// Bans, timeouts, kicks and bulk delete live under Moderation
const MODERATION = [
  /^PUT \/servers\/\{\w+\}\/bans\//,
  /^DELETE \/servers\/\{\w+\}\/bans\//,
  /^GET \/servers\/\{\w+\}\/bans$/,
  /^DELETE \/servers\/\{\w+\}\/members\//,
  /^DELETE \/channels\/\{\w+\}\/messages\/bulk$/,
];

/* ------------------------------------------------------------------ */
/* Curated facts that the code scan cannot see                         */
/* ------------------------------------------------------------------ */

const curated = JSON.parse(readFileSync(join(here, "curated.json"), "utf8"));
const errorGuide = JSON.parse(readFileSync(join(here, "errors.json"), "utf8"));
const eventGuide = JSON.parse(
  readFileSync(join(here, "events-guide.json"), "utf8"),
);
const eventSamples = JSON.parse(
  readFileSync(join(here, "event-samples.json"), "utf8"),
);
const gatewaySchema = JSON.parse(
  readFileSync(
    join(webRoot, "packages/stoat.js/api/gateway.schema.json"),
    "utf8",
  ),
);

/** One-line type of a gateway schema node */
function gatewayType(node) {
  if (!node) return "any";
  if (node.$ref) return node.$ref.split("/").at(-1);
  const options = node.anyOf ?? node.oneOf ?? node.allOf;
  if (options)
    return options
      .filter((o) => o.type !== "null")
      .map(gatewayType)
      .join(" | ");
  if (node.enum) return node.enum.map((v) => JSON.stringify(v)).join(" | ");
  const types = [node.type].flat().filter((t) => t !== "null");
  if (types[0] === "array") return `${gatewayType(node.items)}[]`;
  if (types[0] === "object" && node.additionalProperties)
    return `map of ${gatewayType(node.additionalProperties)}`;
  return types.join(" | ") || "object";
}

const gatewayFields = (node) =>
  Object.entries(node.properties ?? {})
    .filter(([name]) => name !== "type")
    .map(([name, field]) => ({
      name,
      type: gatewayType(field),
      required: node.required?.includes(name) ?? false,
      description: field.description ?? "",
    }));

const nameOf = (branch) => branch.properties?.type?.enum?.[0];
const gatewayBranches = Object.fromEntries(
  gatewaySchema.server.oneOf.map((branch) => [nameOf(branch), branch]),
);
const clientBranches = Object.fromEntries(
  gatewaySchema.client.oneOf.map((branch) => [nameOf(branch), branch]),
);

/** Types that gateway payloads use, in compact form */
function gatewayTypes() {
  const definitions = gatewaySchema.server.definitions;
  const seen = {};
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (typeof node.$ref === "string") {
      const name = node.$ref.split("/").at(-1);
      if (seen[name] || !definitions[name] || name === "EventV1") return;
      const d = definitions[name];
      const variants = d.oneOf ?? d.anyOf;
      seen[name] = {
        description: d.description ?? "",
        fields: gatewayFields(d),
        values: d.enum
          ? d.enum
          : variants
            ? variants.map((v) => nameOf(v) ?? v.enum?.[0] ?? gatewayType(v))
            : [],
      };
      visit(d);
      return;
    }
    for (const value of Object.values(node)) visit(value);
  };
  for (const name of Object.keys(gatewayBranches))
    if (!curated.gateway?.[name]?.audience?.includes("users"))
      visit(gatewayBranches[name]);
  delete seen.Error;
  return seen;
}
const verification = (() => {
  try {
    return JSON.parse(readFileSync(join(here, "verification.json"), "utf8"));
  } catch {
    return {};
  }
})();

/* ------------------------------------------------------------------ */
/* Assemble                                                            */
/* ------------------------------------------------------------------ */

const endpoints = [];
const problems = [];
const seen = new Set();

for (const route of routes) {
  if (route.unresolved) {
    problems.push(
      `route ${route.unresolved} (mounted at ${route.prefix}) not found in source`,
    );
    continue;
  }
  const key = opKey(route.method, route.fullPath);
  if (seen.has(key)) continue;
  seen.add(key);
  const op = operations.get(key);
  const auth = classifyAuth(route);
  const section = MODERATION.some((re) => re.test(key))
    ? "moderation"
    : op
      ? (SECTION_BY_TAG[op.tags?.[0]] ?? null)
      : null;
  const inScope = !!section && !auth.privileged && auth.mode !== "session-only";
  const cur = curated.endpoints[key] ?? {};
  const [bucket, bucketScope] = bucketOf(route.method, route.fullPath);
  // errors raised in helpers the scan cannot follow come from curated.json
  const errors = [...new Set([...errorsOf(route, auth), ...(cur.errors ?? [])])]
    .sort()
    .map((type) => ({ type, status: errorStatus[type] ?? null }));
  const sdkFns = sdk
    .filter(
      (c) => c.method === route.method && c.shape === shape(route.fullPath),
    )
    .map(({ package: p, fn, file }) => ({ package: p, fn, file }));
  const events = [...new Set([...eventsOf(route.body), ...(cur.events ?? [])])];
  const verified = verification[key];

  let status;
  if (!auth.botAccepted) status = "unsupported";
  else if (cur.status) status = cur.status;
  else if (auth.conditionalBot.length || auth.botsOnly.length || cur.partial)
    status = "partial";
  else if (verified?.level === "live" && verified.expected && verified.schemaOk)
    status = "supported";
  else if (verified?.level === "live" && verified.expected) status = "partial";
  else status = "unverified";
  const verifiedProblems =
    verified?.problems?.map(
      (p) => `Live check found a difference from the OpenAPI schema: ${p}.`,
    ) ?? [];

  const parameters = (op?.parameters ?? []).map((p) => ({
    name: p.name,
    in: p.in,
    required: !!p.required,
    description: p.description ?? null,
    schema: p.schema ?? null,
  }));

  endpoints.push({
    id: key,
    title: op?.summary ?? route.name,
    method: route.method,
    path: route.fullPath,
    description: op?.description ?? route.docs.replace(/^# .*\n?/, "").trim(),
    tag: op?.tags?.[0] ?? null,
    section,
    inScope,
    status,
    auth: {
      mode: auth.mode,
      botAccepted: auth.botAccepted,
      botRejectedWith: auth.botRejectedWith ?? null,
      conditions: auth.conditionalBot,
      botsOnlyFeatures: auth.botsOnly,
    },
    privileged: auth.privileged,
    permissions: [
      ...new Set([...permissionsOf(route.body), ...(cur.permissions ?? [])]),
    ],
    parameters,
    requestBody: op?.requestBody?.content?.["application/json"]?.schema ?? null,
    response: (() => {
      const ok = Object.entries(op?.responses ?? {}).find(([code]) =>
        code.startsWith("2"),
      );
      return ok
        ? {
            status: +ok[0],
            schema: ok[1].content?.["application/json"]?.schema ?? null,
          }
        : null;
    })(),
    errors,
    rateLimit: {
      bucket,
      scope: bucketScope,
      limit: bucketLimits[bucket] ?? defaultLimit,
      windowSeconds,
    },
    sdk: sdkFns,
    events,
    restrictions: [
      ...auth.conditionalBot.map(
        (c) => `Bots get ${c.error} when ${c.condition}.`,
      ),
      ...auth.botsOnly.map(
        (e) => `Part of this request is for bots only; users get ${e}.`,
      ),
      ...(auth.privilegedFields
        ? ["Some fields can only be changed by platform staff."]
        : []),
      ...(cur.restrictions ?? []),
      ...verifiedProblems,
    ],
    example: cur.example ?? null,
    verification: verified ?? { level: "untested" },
    source: `backend/${route.file}:${route.line}`,
  });
  if (!op)
    problems.push(`${key} (${route.file}) is not in the OpenAPI document`);
}

for (const [key, op] of operations) {
  if (seen.has(key)) continue;
  problems.push(
    `${key} is in the OpenAPI document but no route was found in source`,
  );
  // routes mounted outside the route modules (GET /) are still documented
  if (op.tags?.[0] !== "Core") continue;
  const verified = verification[key];
  endpoints.push({
    id: key,
    title: op.summary ?? key,
    method: op.method,
    path: op.path,
    description: op.description ?? "",
    tag: "Core",
    section: "getting-started",
    inScope: true,
    status:
      verified?.level === "live" && verified.expected
        ? "supported"
        : "unverified",
    auth: {
      mode: "public",
      botAccepted: true,
      botRejectedWith: null,
      conditions: [],
      botsOnlyFeatures: [],
    },
    privileged: false,
    permissions: [],
    parameters: [],
    requestBody: null,
    response: {
      status: 200,
      schema:
        op.responses?.["200"]?.content?.["application/json"]?.schema ?? null,
    },
    errors: [],
    rateLimit: {
      bucket: "any_dlta",
      scope: null,
      limit: bucketLimits.any_dlta ?? defaultLimit,
      windowSeconds,
    },
    sdk: sdk
      .filter((c) => c.method === op.method && c.shape === shape(op.path))
      .map(({ package: p, fn, file }) => ({ package: p, fn, file })),
    events: [],
    restrictions: [],
    example: null,
    verification: verified ?? { level: "untested" },
    source: "backend/crates/delta/src/routes/root.rs",
  });
}

// schemas reachable from in-scope endpoints
const schemas = {};
const visit = (node) => {
  if (!node || typeof node !== "object") return;
  if (typeof node.$ref === "string") {
    const name = node.$ref.split("/").at(-1);
    if (!schemas[name] && openapi.components?.schemas?.[name]) {
      schemas[name] = openapi.components.schemas[name];
      visit(schemas[name]);
    }
  }
  for (const value of Object.values(node)) visit(value);
};
for (const e of endpoints.filter((e) => e.inScope))
  visit([e.parameters, e.requestBody, e.response]);

const inventory = {
  generated: {
    backend: revision,
    openapi: openapi.info?.version ?? null,
    note: "Generated by scripts/bot-api/extract.mjs. Do not edit by hand; edit curated.json or the backend.",
  },
  counts: {
    routesDiscovered: endpoints.length,
    openapiOperations: operations.size,
    inScope: endpoints.filter((e) => e.inScope).length,
    botAccepted: endpoints.filter((e) => e.inScope && e.auth.botAccepted)
      .length,
    byStatus: Object.fromEntries(
      ["supported", "partial", "unverified", "unsupported"].map((s) => [
        s,
        endpoints.filter((e) => e.inScope && e.status === s).length,
      ]),
    ),
  },
  rateLimits: {
    windowSeconds,
    defaultLimit,
    buckets: bucketLimits,
    globalPerSecond: Number(
      show("crates/core/ratelimits/src/ratelimiter.rs").match(
        /BOT_GLOBAL_LIMIT: u32 = (\d+)/,
      )[1],
    ),
  },
  permissions,
  errorStatus,
  gateway: {
    events: clientEvents.map((e) => ({
      ...e,
      ...(curated.gateway?.[e.name] ?? {}),
      ...(eventGuide.events[e.name] ?? {}),
      fields: gatewayBranches[e.name]
        ? gatewayFields(gatewayBranches[e.name])
        : [],
      sample: eventSamples[e.name] ?? null,
    })),
    clientMessages: serverMessages.map((m) => ({
      ...m,
      docs: eventGuide.clientMessages[m.name] ?? m.docs,
      fields: gatewayFields(clientBranches[m.name] ?? {}),
    })),
    types: gatewayTypes(),
  },
  errors: Object.entries({ ...errorGuide.bots, ...errorGuide.accounts }).map(
    ([type, [cause, fix]]) => ({
      type,
      status: errorStatus[type] ?? null,
      audience: errorGuide.bots[type] ? "bots" : "accounts",
      cause,
      fix,
      fields: Object.keys(
        (gatewaySchema.server.definitions.Error.oneOf ?? []).find(
          (o) => nameOf(o) === type,
        )?.properties ?? {},
      ).filter((name) => name !== "type"),
    }),
  ),
  rateLimitHeaders: eventSamples.__headers ?? null,
  endpoints: endpoints
    .filter((e) => e.inScope)
    .sort(
      (a, b) =>
        a.section.localeCompare(b.section) ||
        a.path.localeCompare(b.path) ||
        a.method.localeCompare(b.method),
    ),
  outOfScope: endpoints
    .filter((e) => !e.inScope)
    .map((e) => ({
      id: e.id,
      tag: e.tag,
      reason: e.privileged
        ? "admin"
        : e.auth.mode === "session-only"
          ? "session-only"
          : "not a bot feature",
    }))
    .sort((a, b) => a.id.localeCompare(b.id)),
  schemas,
  problems,
};

/** Upstream names stay in the code; these pages are public */
const publicName = (text) =>
  text
    .replace(/\s*https:\/\/docs\.rs\/revolt-\S+/g, "")
    .replace(/Revolt(Config|Features)/g, "Server$1")
    .replace(/\bRevolt\b/g, "Zrzur");

function publicText(value, key = "") {
  if (typeof value === "string")
    return key === "file" ? value : publicName(value); // `file` is not shown
  if (Array.isArray(value)) return value.map((v) => publicText(v, key));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [publicName(k), publicText(v, k)]),
    );
  return value;
}

const json = JSON.stringify(publicText(inventory), null, 1) + "\n";
if (args.check) {
  const current = readFileSync(OUT, "utf8");
  if (current !== json) {
    console.error(
      "botApi.json is out of date: run node scripts/bot-api/extract.mjs",
    );
    process.exit(1);
  }
  console.log("botApi.json is up to date");
} else {
  writeFileSync(OUT, json);
  console.log(
    `routes ${inventory.counts.routesDiscovered}, openapi ${inventory.counts.openapiOperations}, in scope ${inventory.counts.inScope}, bot accepted ${inventory.counts.botAccepted}`,
    inventory.counts.byStatus,
    `problems ${problems.length}`,
  );
}
