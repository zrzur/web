import meta from "../data/botApi/meta.json";

import { loadOnce } from "./loadOnce";

/**
 * Typed access to the Bot API inventory. The inventory is generated from the
 * backend source, its OpenAPI document and both SDKs by
 * `scripts/bot-api/extract.mjs`; the live doc tests add verification.
 *
 * The app loads it in parts (`scripts/bot-api/split.mjs`): the small
 * `meta` part at once, everything else when a page that shows it opens
 * (`loadParts`, `partsForMarkdown`). Read a part only after it loaded.
 */

export type Status = "supported" | "partial" | "unverified" | "unsupported";

export type VerificationLevel =
  | "live"
  | "integration"
  | "type-checked"
  | "mocked"
  | "untested"
  | "failed";

export interface Schema {
  $ref?: string;
  type?: string;
  format?: string;
  description?: string;
  nullable?: boolean;
  enum?: unknown[];
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  allOf?: Schema[];
  additionalProperties?: Schema | boolean;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  maxItems?: number;
  default?: unknown;
  pattern?: string;
}

export interface Endpoint {
  id: string;
  title: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  description: string;
  tag: string | null;
  section: string;
  status: Status;
  auth: {
    mode: string;
    botAccepted: boolean;
    botRejectedWith: string | null;
    conditions: { condition: string; error: string }[];
    botsOnlyFeatures: string[];
  };
  permissions: string[];
  parameters: {
    name: string;
    in: "path" | "query" | "header";
    required: boolean;
    description: string | null;
    schema: Schema | null;
  }[];
  requestBody: Schema | null;
  response: { status: number; schema: Schema | null } | null;
  errors: { type: string; status: number | null }[];
  rateLimit: {
    bucket: string;
    scope: string | null;
    limit: number;
    windowSeconds: number;
  };
  sdk: { package: string; fn: string; file: string }[];
  events: string[];
  restrictions: string[];
  verification: {
    level: VerificationLevel;
    checked?: string;
    test?: string;
    status?: number;
    request?: unknown;
    response?: unknown;
    error?: unknown;
  };
  source: string;
}

export interface GatewayField {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface GatewayEvent {
  name: string;
  docs: string;
  audience?: "users" | "bots";
  intent?: string;
  fields?: GatewayField[];
  sample?: unknown;
}

export interface ErrorInfo {
  type: string;
  status: number | null;
  audience: "bots" | "accounts";
  cause: string;
  fix: string;
  fields: string[];
}

export interface Inventory {
  generated: { backend: string; openapi: string | null };
  counts: {
    routesDiscovered: number;
    openapiOperations: number;
    inScope: number;
    botAccepted: number;
    byStatus: Record<Status, number>;
  };
  rateLimits: {
    windowSeconds: number;
    defaultLimit: number;
    buckets: Record<string, number>;
    globalPerSecond: number;
  };
  permissions: {
    name: string;
    bit: number;
    value: string;
    description: string;
  }[];
  errorStatus: Record<string, number>;
  errors: ErrorInfo[];
  gateway: {
    events: GatewayEvent[];
    clientMessages: { name: string; docs: string; fields: GatewayField[] }[];
    types: Record<
      string,
      { description: string; fields: GatewayField[]; values: string[] }
    >;
  };
  endpoints: Endpoint[];
  outOfScope: { id: string; tag: string | null; reason: string }[];
  schemas: Record<string, Schema>;
}

/** One line per endpoint, for search and the overview tables */
export interface EndpointSummary extends Pick<
  Endpoint,
  "id" | "title" | "method" | "path" | "section" | "status" | "rateLimit"
> {
  restriction: string | null;
  botRejectedWith: string | null;
}

export const inventory: Inventory & { index: EndpointSummary[] } = {
  ...(meta as unknown as Pick<
    Inventory,
    "generated" | "counts" | "rateLimits" | "permissions" | "errorStatus"
  >),
  index: [],
  endpoints: [],
  gateway: { events: [], clientMessages: [], types: {} },
  errors: [],
  outOfScope: [],
  schemas: {},
};

/** A part of the inventory that loads on its own */
export type Part =
  | "index"
  | "gateway"
  | "errors"
  | "out-of-scope"
  | `section-${string}`;

// meta is imported above; every other part is its own chunk
const partLoaders = import.meta.glob<unknown>(
  ["../data/botApi/*.json", "!../data/botApi/meta.json"],
  { import: "default" },
);

const partOf = (path: string) =>
  path
    .split("/")
    .at(-1)!
    .replace(/\.json$/, "") as Part | "meta";

/** Every part there is (sections included), for the tests */
export const ALL_PARTS = Object.keys(partLoaders)
  .map(partOf)
  .filter((part): part is Part => part !== "meta");

const pending = new Map<string, Promise<void>>();

function apply(part: Part, data: unknown) {
  if (part === "index") inventory.index = data as EndpointSummary[];
  else if (part === "gateway") inventory.gateway = data as Inventory["gateway"];
  else if (part === "errors") inventory.errors = data as ErrorInfo[];
  else if (part === "out-of-scope")
    inventory.outOfScope = data as Inventory["outOfScope"];
  else {
    const section = data as {
      endpoints: Endpoint[];
      schemas: Record<string, Schema>;
    };
    inventory.endpoints.push(...section.endpoints);
    Object.assign(inventory.schemas, section.schemas);
  }
}

/** Load parts of the inventory; each one is fetched once */
export function loadParts(parts: Part[]) {
  return Promise.all(
    parts.map((part) => {
      const load = partLoaders[`../data/botApi/${part}.json`];
      if (!load) return Promise.resolve();
      // a failed part is forgotten, so Try again fetches it anew
      return loadOnce(pending, part, () =>
        load().then((data) => apply(part, data)),
      );
    }),
  ).then(() => undefined);
}

/** The parts the generated blocks of a page show */
export function partsForMarkdown(source: string): Part[] {
  const parts = new Set<Part>();
  for (const [, name, argument] of source.matchAll(
    /^```([a-z-]+)[ \t]*([^\n]*)$/gm,
  )) {
    if (name === "endpoints") parts.add(`section-${argument.trim()}`);
    if (name === "events" || name === "types" || name === "client-messages")
      parts.add("gateway");
    if (name === "errors") parts.add("errors");
    if (name === "unsupported" || name === "ratelimits") parts.add("index");
  }
  return [...parts];
}

/** Anchor id of an endpoint: `post-channels-target-messages` */
export function endpointSlug(endpoint: Pick<Endpoint, "method" | "path">) {
  return `${endpoint.method}-${endpoint.path}`
    .toLowerCase()
    .replace(/[{}@]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Helpers of the bot SDK only: the web app's own SDK (`@zrzur/sdk/solid`)
 * is not for bots, and naming it on bot pages sent authors the wrong way
 */
export const botSdk = (endpoint: Pick<Endpoint, "sdk">) =>
  endpoint.sdk.filter((fn) => fn.package === "@zrzur/sdk/bot");

/** Page that shows the endpoints of a section */
export function pageOfSection(section: string) {
  if (section === "getting-started") return "overview";
  if (section === "members") return "users";
  return section;
}

/** Endpoints shown on a guide page */
export function endpointsFor(section: string) {
  return inventory.endpoints.filter((endpoint) => endpoint.section === section);
}

/** Find an endpoint by `METHOD /path` */
export function findEndpoint(id: string) {
  return inventory.endpoints.find((endpoint) => endpoint.id === id);
}

/** Name of a referenced schema */
export const refName = (ref: string) => ref.split("/").at(-1)!;

/** Resolve `$ref` and single-entry `allOf` wrappers */
export function resolveSchema(
  schema: Schema | null | undefined,
): Schema | null {
  if (!schema) return null;
  if (schema.$ref) return inventory.schemas[refName(schema.$ref)] ?? null;
  if (schema.allOf?.length === 1) {
    const inner = resolveSchema(schema.allOf[0]);
    return inner
      ? {
          ...inner,
          nullable: schema.nullable ?? inner.nullable,
          description: schema.description ?? inner.description,
        }
      : null;
  }
  return schema;
}

/** One-line type of a schema: `string`, `Message[]`, `"Text" | "Voice"` */
export function typeLabel(schema: Schema | null | undefined): string {
  if (!schema) return "none";
  if (schema.$ref) return refName(schema.$ref);
  if (schema.allOf?.length === 1) return typeLabel(schema.allOf[0]);
  if (schema.enum)
    return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  if (schema.oneOf || schema.anyOf) {
    const labels = [...new Set((schema.oneOf ?? schema.anyOf)!.map(typeLabel))];
    return labels.join(" | ");
  }
  if (schema.type === "array") return `${typeLabel(schema.items)}[]`;
  if (schema.type === "integer" && schema.format)
    return `integer (${schema.format})`;
  return schema.type ?? "object";
}

/** Limits of a schema in words: `1–2000 characters` */
export function constraints(schema: Schema | null | undefined) {
  const s = resolveSchema(schema);
  if (!s) return "";
  // only limits that say something: no "0–∞"
  const range = (
    min: number | undefined,
    max: number | undefined,
    unit = "",
  ) =>
    max !== undefined
      ? `${min ?? 0}–${max}${unit}`
      : min
        ? `at least ${min}${unit}`
        : "";
  const parts = [
    range(s.minLength, s.maxLength, " characters"),
    range(s.minimum, s.maximum),
  ];
  if (s.maxItems !== undefined) parts.push(`at most ${s.maxItems} items`);
  return parts.filter(Boolean).join(", ");
}

/** Fields of an object schema, following `$ref` and `allOf` */
export function fieldsOf(schema: Schema | null | undefined) {
  const s = resolveSchema(schema);
  if (!s?.properties) return [];
  return Object.entries(s.properties).map(([name, field]) => ({
    name,
    type: typeLabel(field),
    required: s.required?.includes(name) ?? false,
    nullable: !!(field.nullable || resolveSchema(field)?.nullable),
    description: plainText(
      field.description ?? resolveSchema(field)?.description ?? "",
    ),
    limits: constraints(field),
  }));
}

/** OpenAPI descriptions use Markdown; the reference shows them as plain text */
export function plainText(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\\?`([^`\\]+)\\?`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Human name of a permission flag: `Channel:SendMessage` → `Send Message` */
export function permissionLabel(permission: string) {
  return permission
    .split(":")
    .at(-1)!
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** Placeholder for a path parameter in examples */
function placeholder(name: string) {
  if (name === "emoji") return "%F0%9F%91%8D";
  if (name === "token") return "YOUR_INTERACTION_TOKEN";
  return `{${name}}`;
}

/** `curl` call for an endpoint, with the body from the live example */
export function curlExample(endpoint: Endpoint) {
  const path = endpoint.path.replace(/\{(\w+)\}/g, (_, name: string) =>
    placeholder(name),
  );
  const lines = [`curl -X ${endpoint.method} "https://api.zrzur.com${path}"`];
  if (
    endpoint.auth.mode === "user-or-bot" ||
    endpoint.auth.mode === "user-only"
  )
    lines.push(`  -H "x-bot-token: YOUR_BOT_TOKEN"`);
  const body = endpoint.verification.request;
  if (body !== undefined) {
    lines.push(`  -H "content-type: application/json"`);
    lines.push(`  -d '${JSON.stringify(body)}'`);
  }
  return lines.join(" \\\n");
}

/** Response example from the live run, if any */
export function responseExample(endpoint: Endpoint) {
  const v = endpoint.verification;
  if (v.response !== undefined) return JSON.stringify(v.response, null, 2);
  if (v.error !== undefined) return JSON.stringify(v.error, null, 2);
  return null;
}

/** Everything the search box can find */
export interface SearchEntry {
  kind: "page" | "endpoint" | "event" | "heading";
  label: string;
  detail: string;
  href: string;
}
