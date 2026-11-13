#!/usr/bin/env node
// The documentation pages as plain HTML, for the standalone documentation
// site (developers.zrzur.com): search engines, link previews and readers
// without JavaScript get the words of the page; the app replaces them when
// it starts. Written from the same Markdown, generated reference and
// examples the app shows, so the text exists once.
//
// Usage (from web/packages/client, after `vite build`):
//   node scripts/bot-api/prerender-docs.mjs [out dir, default dist/docs-pages]
//
// Writes <out>/<language>/<page>.html (the body of the page) and
// <out>/index.json (pages in order, and per language each page's title,
// description and sections). packages/public-pages serves them (SITE=docs).

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  headingId,
  headingText,
  parseMarkdown,
  textOf,
} from "../../src/interface/developers/docs/markdownTree.ts";
import {
  DOCS_LANGUAGES,
  PAGE_ORDER,
  withEnglishCode,
} from "../../src/interface/developers/docs/pageOrder.ts";

const here = dirname(fileURLToPath(import.meta.url));
const client = resolve(here, "../..");
const docs = join(client, "src/interface/developers/docs");
const data = join(client, "src/interface/developers/data");

const read = (path) => readFileSync(path, "utf8");
const json = (path) => JSON.parse(read(path));

/* ------------------------------------------------------------------ */
/* The generated reference                                             */
/* ------------------------------------------------------------------ */

const meta = json(join(data, "botApi/meta.json"));
const index = json(join(data, "botApi/index.json"));
const gateway = json(join(data, "botApi/gateway.json"));
const errors = json(join(data, "botApi/errors.json"));
const sections = Object.fromEntries(
  readdirSync(join(data, "botApi"))
    .filter((file) => file.startsWith("section-"))
    .map((file) => [
      file.replace(/^section-|\.json$/g, ""),
      json(join(data, "botApi", file)).endpoints,
    ]),
);
const reference = {
  en: {},
  ar: json(join(data, "reference.ar.json")),
  de: json(join(data, "reference.de.json")),
};

/** Words of the plain pages that are not in the Markdown */
const WORDS = {
  en: {
    site: "Zrzur Developers",
    about:
      "Build bots for Zrzur: guides, tutorials and the full Bot API reference.",
    contents: "Contents",
    intent: "Intent",
    permissions: "Permissions",
    rateLimit: "Rate limit",
    notForBots: "Not available to bots.",
    cause: "Cause",
    fix: "Fix",
  },
  de: {
    site: "Zrzur Developers",
    about:
      "Baue Bots für Zrzur: Anleitungen, Tutorials und die vollständige Referenz der Bot-API.",
    contents: "Inhalt",
    intent: "Intent",
    permissions: "Berechtigungen",
    rateLimit: "Ratenlimit",
    notForBots: "Für Bots nicht verfügbar.",
    cause: "Ursache",
    fix: "Lösung",
  },
  ar: {
    site: "مطوّرو زرزور",
    about: "ابنِ بوتات لزرزور: أدلة ودروس والمرجع الكامل لواجهة برمجة البوتات.",
    contents: "المحتويات",
    intent: "النية",
    permissions: "الصلاحيات",
    rateLimit: "حد المعدل",
    notForBots: "غير متاح للبوتات.",
    cause: "السبب",
    fix: "الحل",
  },
};

/* ------------------------------------------------------------------ */
/* HTML                                                                */
/* ------------------------------------------------------------------ */

export const esc = (text) =>
  String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Addresses are written as in the app; the site has them at its root */
export function siteHref(href) {
  if (href === "/developers/docs" || href.startsWith("/developers/docs/"))
    return href.slice("/developers/docs".length) || "/";
  if (href.startsWith("/developers/docs#"))
    return `/${href.slice("/developers/docs".length)}`;
  return href;
}

const endpointSlug = (endpoint) =>
  `${endpoint.method}-${endpoint.path}`
    .toLowerCase()
    .replace(/[{}@]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const pageOfSection = (section) =>
  section === "getting-started"
    ? "overview"
    : section === "members"
      ? "users"
      : section;

/** `code` in a line of reference text stays code */
const inline = (text) =>
  String(text)
    .split(/(`[^`]+`)/)
    .map((part) =>
      part.startsWith("`")
        ? `<code dir="ltr">${esc(part.slice(1, -1))}</code>`
        : esc(part),
    )
    .join("");

const table = (head, rows) =>
  `<table><thead><tr>${head.map((cell) => `<th scope="col">${esc(cell)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;

const code = (text) => `<code dir="ltr">${esc(text)}</code>`;

/** A generated block, in plain words */
function directive(name, argument, language) {
  const words = WORDS[language];
  const texts = reference[language];
  if (name === "example") {
    const source = read(join(here, "examples", argument));
    return `<pre dir="ltr"><code>${esc(source)}</code></pre>`;
  }
  if (name === "endpoints")
    return (sections[argument] ?? [])
      .map((endpoint) => {
        const lines = [
          `<h3 id="${endpointSlug(endpoint)}">${code(endpoint.id)}</h3>`,
          `<p><strong>${esc(endpoint.title)}.</strong> ${inline(endpoint.description ?? "")}</p>`,
        ];
        if (endpoint.status === "unsupported")
          lines.push(`<p>${esc(words.notForBots)}</p>`);
        const facts = [];
        if (endpoint.permissions?.length)
          facts.push(
            `${esc(words.permissions)}: ${endpoint.permissions.map(code).join(", ")}`,
          );
        if (endpoint.rateLimit)
          facts.push(
            `${esc(words.rateLimit)}: ${code(endpoint.rateLimit.bucket)}, ${endpoint.rateLimit.limit} / ${endpoint.rateLimit.windowSeconds} s`,
          );
        if (facts.length) lines.push(`<p>${facts.join(" · ")}</p>`);
        return lines.join("");
      })
      .join("");
  if (name === "events")
    return gateway.events
      .filter((event) => event.audience !== "users")
      .map(
        (event) =>
          `<h3 id="${event.name.toLowerCase()}">${code(event.name)}</h3><p>${inline(texts.events?.[event.name] ?? event.docs)}</p><p>${esc(words.intent)}: ${code(event.intent)}${
            event.fields?.length
              ? ` · ${event.fields.map((field) => code(field.name)).join(", ")}`
              : ""
          }</p>`,
      )
      .join("");
  if (name === "types")
    return Object.entries(gateway.types)
      .map(
        ([type, info]) =>
          `<h3 id="type-${type.toLowerCase()}">${code(type)}</h3><p>${inline(info.description ?? "")}</p>${
            info.fields?.length
              ? `<p>${info.fields.map((field) => code(field.name)).join(", ")}</p>`
              : ""
          }`,
      )
      .join("");
  if (name === "client-messages")
    return table(
      ["Message", "Fields", ""],
      gateway.clientMessages.map((message) => [
        code(message.name),
        code(message.fields.map((field) => field.name).join(", ")),
        inline(texts.clientMessages?.[message.name] ?? message.docs),
      ]),
    );
  if (name === "permissions")
    return table(
      ["Permission", "Bit", "Value", ""],
      [...meta.permissions]
        .sort((a, b) => a.bit - b.bit)
        .map((permission) => [
          code(permission.name),
          String(permission.bit),
          code(permission.value),
          esc(texts.permissions?.[permission.name] ?? permission.description),
        ]),
    );
  if (name === "errors") {
    const audience = argument || "bots";
    return table(
      ["Type", "HTTP", words.cause, words.fix],
      errors
        .filter((error) => error.audience === audience)
        .map((error) => {
          const [cause, fix] = texts.errors?.[error.type] ?? [
            error.cause,
            error.fix,
          ];
          return [
            code(error.type),
            error.status === null ? "" : String(error.status),
            inline(cause),
            inline(fix),
          ];
        }),
    );
  }
  if (name === "ratelimits") {
    const where = new Map();
    for (const endpoint of index) {
      const set = where.get(endpoint.rateLimit.bucket) ?? new Set();
      set.add(
        `/${endpoint.path.split("/")[1] ?? ""}${endpoint.rateLimit.scope ? ` (${endpoint.rateLimit.scope})` : ""}`,
      );
      where.set(endpoint.rateLimit.bucket, set);
    }
    return table(
      ["Bucket", `/ ${meta.rateLimits.windowSeconds} s`, ""],
      [...where.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([bucket, paths]) => [
          code(bucket),
          String(
            meta.rateLimits.buckets[bucket] ?? meta.rateLimits.defaultLimit,
          ),
          code([...paths].join(", ")),
        ]),
    );
  }
  if (name === "unsupported")
    return table(
      ["Endpoint", ""],
      index
        .filter((endpoint) => endpoint.status === "unsupported")
        .map((endpoint) => [
          `<a href="/${pageOfSection(endpoint.section)}#${endpointSlug(endpoint)}">${code(endpoint.id)}</a>`,
          esc(endpoint.restriction ?? endpoint.botRejectedWith ?? ""),
        ]),
    );
  if (name === "coverage")
    return table(
      ["Status", "Endpoints"],
      Object.entries(meta.counts.byStatus).map(([status, count]) => [
        code(status),
        String(count),
      ]),
    );
  return undefined;
}

const DIRECTIVES = new Set([
  "endpoints",
  "events",
  "types",
  "client-messages",
  "permissions",
  "errors",
  "ratelimits",
  "unsupported",
  "coverage",
  "example",
]);

/** A Markdown tree as HTML: the same elements the app renders */
function html(node, language) {
  const inner = () =>
    (node.children ?? []).map((child) => html(child, language)).join("");
  switch (node.type) {
    case "root":
      return inner();
    case "heading": {
      const tag = `h${Math.min(node.depth, 4)}`;
      return `<${tag} id="${esc(headingId(node))}">${inner()}</${tag}>`;
    }
    case "paragraph":
      return `<p>${inner()}</p>`;
    case "text":
      return esc(headingText(node.value));
    case "strong":
      return `<strong>${inner()}</strong>`;
    case "emphasis":
      return `<em>${inner()}</em>`;
    case "delete":
      return `<del>${inner()}</del>`;
    case "inlineCode":
      return code(node.value);
    case "break":
      return "<br>";
    case "thematicBreak":
      return "<hr>";
    case "blockquote":
      return `<aside>${inner()}</aside>`;
    case "list":
      return node.ordered ? `<ol>${inner()}</ol>` : `<ul>${inner()}</ul>`;
    case "listItem": {
      const only =
        node.children.length === 1 && node.children[0].type === "paragraph"
          ? node.children[0].children
          : node.children;
      return `<li>${only.map((child) => html(child, language)).join("")}</li>`;
    }
    case "link": {
      const external = /^https?:\/\//.test(node.url);
      return `<a href="${esc(siteHref(node.url))}"${external ? ' rel="noopener"' : ""}>${inner()}</a>`;
    }
    case "table": {
      const [head, ...rows] = node.children;
      const cells = (row, tag) =>
        row.children
          .map(
            (cell) =>
              `<${tag}${tag === "th" ? ' scope="col"' : ""}>${cell.children.map((child) => html(child, language)).join("")}</${tag}>`,
          )
          .join("");
      return `<table><thead><tr>${head ? cells(head, "th") : ""}</tr></thead><tbody>${rows.map((row) => `<tr>${cells(row, "td")}</tr>`).join("")}</tbody></table>`;
    }
    case "code": {
      const name = node.lang ?? "";
      if (DIRECTIVES.has(name)) {
        const generated = directive(name, (node.meta ?? "").trim(), language);
        if (generated !== undefined) return generated;
      }
      return `<pre dir="ltr"><code>${esc(node.value)}</code></pre>`;
    }
    case "html":
      return code(node.value);
    default:
      return inner();
  }
}

/** The first paragraph in plain words, cut at a word for the description */
export function describe(tree) {
  const first = tree.children.find((node) => node.type === "paragraph");
  const text = first ? textOf(first).replace(/\s+/g, " ").trim() : "";
  if (text.length <= 160) return text;
  const cut = text.slice(0, 157);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 100))}…`;
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

function source(id, language) {
  const english = read(join(docs, "content", `${id}.md`));
  if (language === "en") return english;
  return withEnglishCode(
    read(join(docs, "content", language, `${id}.md`)),
    english,
  );
}

export function build() {
  const pages = PAGE_ORDER.flatMap(([group, ids]) =>
    ids.map((id) => ({ id, group })),
  );
  const text = {};
  const bodies = {};
  for (const language of DOCS_LANGUAGES) {
    text[language] = {};
    bodies[language] = {};
    for (const { id } of pages) {
      const tree = parseMarkdown(source(id, language));
      const title = tree.children.find(
        (node) => node.type === "heading" && node.depth === 1,
      );
      if (!title) throw new Error(`${language}/${id}: no title`);
      const description = describe(tree);
      if (!description)
        throw new Error(`${language}/${id}: no first paragraph`);
      text[language][id] = {
        title: headingText(textOf(title)),
        description,
        sections: tree.children
          .filter((node) => node.type === "heading" && node.depth === 2)
          .map((node) => ({
            id: headingId(node),
            text: headingText(textOf(node)),
          })),
      };
      bodies[language][id] = html(tree, language);
    }
  }
  return {
    index: {
      generated: meta.generated,
      languages: [...DOCS_LANGUAGES],
      words: Object.fromEntries(
        DOCS_LANGUAGES.map((language) => [
          language,
          {
            site: WORDS[language].site,
            about: WORDS[language].about,
            contents: WORDS[language].contents,
          },
        ]),
      ),
      pages,
      text,
    },
    bodies,
  };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const out = resolve(process.argv[2] ?? join(client, "dist/docs-pages"));
  const { index: built, bodies } = build();
  for (const [language, pages] of Object.entries(bodies)) {
    mkdirSync(join(out, language), { recursive: true });
    for (const [id, body] of Object.entries(pages))
      writeFileSync(join(out, language, `${id}.html`), body);
  }
  writeFileSync(join(out, "index.json"), JSON.stringify(built));
  console.log(
    `docs pages: ${built.pages.length} pages x ${built.languages.length} languages -> ${out}`,
  );
}
