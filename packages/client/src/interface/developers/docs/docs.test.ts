import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  DIRECTIVES,
  exampleFiles,
  exampleSource,
  loadExample,
} from "./examples";
import {
  ALL_PARTS,
  botSdk,
  endpointSlug,
  inventory,
  loadParts,
  pageOfSection,
  partsForMarkdown,
} from "./inventory";
import {
  anchorsOf,
  codeBlocksOf,
  headingsOf,
  inlineCodeOf,
  linksOf,
} from "./markdownTree";
import {
  PAGES as PAGE_LIST,
  loadSource,
  loadTranslated,
  markdownFiles,
} from "./pages";

const here = dirname(fileURLToPath(import.meta.url));

// The app loads pages, inventory parts and examples one by one; the tests
// load everything first and check it all
await loadParts(ALL_PARTS);
await Promise.all(exampleFiles().map(loadExample));
const PAGES = await Promise.all(
  PAGE_LIST.map(async (page) => ({
    ...page,
    source: page.hasSource ? await loadSource(page.id, "en") : undefined,
  })),
);
const TRANSLATED: Record<"ar" | "de", Record<string, string | undefined>> = {
  ar: {},
  de: {},
};
for (const locale of ["ar", "de"] as const)
  for (const page of PAGES)
    TRANSLATED[locale][page.id] = await loadTranslated(page.id, locale);
const translatedSource = (id: string, locale: "ar" | "de") =>
  TRANSLATED[locale][id];

describe("Inventory parts", () => {
  it("are exactly what split.mjs makes of botApi.json", async () => {
    const { splitInventory } = (await import(
      // @ts-expect-error -- a plain Node script without types
      "../../../../scripts/bot-api/split.mjs"
    )) as { splitInventory: (inventory: unknown) => Record<string, unknown> };
    const parts = splitInventory(
      JSON.parse(
        readFileSync(join(here, "../data/botApi.json"), "utf8"),
      ) as unknown,
    );
    const files = readdirSync(join(here, "../data/botApi")).sort();
    expect(files).toEqual(Object.keys(parts).sort());
    for (const [name, value] of Object.entries(parts))
      expect(
        readFileSync(join(here, "../data/botApi", name), "utf8"),
        `${name} is stale: run node scripts/bot-api/split.mjs`,
      ).toBe(JSON.stringify(value) + "\n");
  });

  it("has shell examples that run when pasted (no literal \\n, no lost \\)", () => {
    const shells = PAGES.flatMap((page) =>
      [
        page.source,
        translatedSource(page.id, "ar"),
        translatedSource(page.id, "de"),
      ].flatMap((source) =>
        codeBlocksOf(source ?? "")
          .filter((block) => ["bash", "sh", "shell"].includes(block.lang))
          .map((block) => ({ page: page.id, code: block.value })),
      ),
    );
    expect(shells.length).toBeGreaterThan(10);
    for (const { page, code } of shells) {
      expect(code, `${page}: literal \\n`).not.toMatch(/\\n/);
      // a continuation lost on the way leaves "   -H" inside one line
      expect(code, `${page}: lost line break`).not.toMatch(/\S {3,}-[A-Za-z]/);
    }
  });

  it("publishes the changelog as an RSS feed, up to date", async () => {
    const { feedFrom } = (await import(
      // @ts-expect-error -- a plain Node script without types
      "../../../../scripts/bot-api/changelog-feed.mjs"
    )) as { feedFrom: (markdown: string) => string };
    const page = PAGES.find((p) => p.id === "changelog")!.source!;
    const feed = readFileSync(
      join(here, "../../../../public/developers/api-changelog.xml"),
      "utf8",
    );
    expect(feed, "run node scripts/bot-api/changelog-feed.mjs").toBe(
      feedFrom(page),
    );
    expect(feed).toContain("#v26-0-0</link>");
    expect(feed).not.toContain("#upcoming");
    expect(linksOf(page)).toContain("/developers/api-changelog.xml");
  });

  it("a page loads only the parts its blocks show", () => {
    expect(partsForMarkdown("# Hi\n\nText only.")).toEqual([]);
    expect(
      partsForMarkdown(
        "```endpoints channels\n\n```\n\n```events\n\n```\n\n```json\n{}\n```",
      ).sort(),
    ).toEqual(["gateway", "section-channels"]);
    expect(partsForMarkdown("```errors bots\n\n```")).toEqual(["errors"]);
    expect(partsForMarkdown("```ratelimits\n\n```")).toEqual(["index"]);
  });
});
const verification = JSON.parse(
  readFileSync(
    join(here, "../../../../scripts/bot-api/verification.json"),
    "utf8",
  ),
) as Record<string, { level: string; expected?: boolean }>;

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const STATUSES = ["supported", "partial", "unverified", "unsupported"];
const LEVELS = [
  "live",
  "integration",
  "type-checked",
  "mocked",
  "untested",
  "failed",
];
const AUTH_MODES = [
  "user-or-bot",
  "user-only",
  "session-only",
  "interaction-token",
  "webhook-token",
  "public",
  "public-user-only",
];

/** `/channels/{target}/messages` and `/channels/${id}/messages` → `/channels/{}/messages` */
const shape = (path: string) =>
  path
    .split("?")[0]
    .replace(/\$\{[^}]*\}/g, "{}")
    .replace(/\{[^}]*\}/g, "{}")
    .replace(/\/$/, "") || "/";

const known = new Set([
  "GET /gateway/schema",
  "GET /openapi.json",
  ...inventory.endpoints.map((e) => `${e.method} ${shape(e.path)}`),
  ...inventory.outOfScope.map(
    (e) => `${e.id.split(" ")[0]} ${shape(e.id.split(" ")[1])}`,
  ),
]);

const markdownPages = PAGES.filter((page) => page.source);
const ID_OF_GETTING_STARTED = [
  "getting-started",
  "create-an-application",
  "copy-the-token",
  "install-the-bot",
  "get-the-sdk",
  "first-bot",
  "run-it",
  "gateway",
  "deploy",
  "next-steps",
];

/** Anchors a page offers: its headings and the endpoints it lists */
function anchorsOfPage(id: string) {
  const page = PAGES.find((p) => p.id === id);
  if (!page) return null;
  if (!page.source) return new Set(ID_OF_GETTING_STARTED);
  const anchors = new Set(anchorsOf(page.source));
  for (const block of codeBlocksOf(page.source))
    if (block.lang === "endpoints")
      for (const endpoint of inventory.endpoints.filter(
        (e) => e.section === block.meta.trim(),
      ))
        anchors.add(endpointSlug(endpoint));
  return anchors;
}

describe("Bot API inventory", () => {
  it("has endpoints and was generated from a backend revision", () => {
    expect(inventory.endpoints.length).toBeGreaterThan(50);
    expect(inventory.generated.backend).toMatch(/^[0-9a-f]{8}$/);
  });

  it("documents all 17 reference fields of every endpoint", () => {
    for (const e of inventory.endpoints) {
      const where = e.id;
      expect(e.title, where).toBeTruthy();
      expect(METHODS, where).toContain(e.method);
      expect(e.path.startsWith("/"), where).toBe(true);
      expect(typeof e.description, where).toBe("string");
      expect(STATUSES, where).toContain(e.status);
      expect(LEVELS, where).toContain(e.verification.level);
      expect(AUTH_MODES, where).toContain(e.auth.mode);
      expect(Array.isArray(e.permissions), where).toBe(true);
      expect(Array.isArray(e.parameters), where).toBe(true);
      expect(
        e.requestBody === null || typeof e.requestBody === "object",
        where,
      ).toBe(true);
      expect(
        e.response === null || typeof e.response?.status === "number",
        where,
      ).toBe(true);
      expect(Array.isArray(e.errors), where).toBe(true);
      expect(
        e.rateLimit.bucket &&
          e.rateLimit.limit > 0 &&
          e.rateLimit.windowSeconds > 0,
        where,
      ).toBeTruthy();
      expect(Array.isArray(e.sdk), where).toBe(true);
      expect(Array.isArray(e.events), where).toBe(true);
      expect(Array.isArray(e.restrictions), where).toBe(true);
      expect(e.source.startsWith("backend/"), where).toBe(true);
      expect(e.id, where).toBe(`${e.method} ${e.path}`);
    }
  });

  it("matches path parameters to the path exactly", () => {
    for (const e of inventory.endpoints) {
      const inPath = [...e.path.matchAll(/\{(\w+)\}/g)]
        .map(([, name]) => name)
        .sort();
      const documented = e.parameters
        .filter((p) => p.in === "path")
        .map((p) => p.name)
        .sort();
      // GET / and openapi-only routes have no parameters to compare
      if (documented.length || inPath.length)
        expect(documented, e.id).toEqual(inPath);
    }
  });

  it("explains authentication for every endpoint bots cannot use", () => {
    for (const e of inventory.endpoints.filter(
      (e) => !e.auth.botAccepted || e.status === "unsupported",
    )) {
      expect(e.status, e.id).toBe("unsupported");
      expect(
        e.restrictions.length > 0 ||
          !!e.auth.botRejectedWith ||
          e.auth.mode !== "user-or-bot",
        e.id,
      ).toBe(true);
    }
  });

  it("never shows an Unverified badge over a passed live check", () => {
    // the badge and the status line under it say the same (docs gap 5)
    for (const e of inventory.endpoints)
      if (e.verification.level === "live")
        expect(e.status, e.id).not.toBe("unverified");
  });

  it("names only the bot SDK on bot pages", () => {
    // docs gap 13: the web app's SDK is not for bots
    const both = inventory.endpoints.find((e) =>
      e.sdk.some((fn) => fn.package === "@zrzur/sdk/solid"),
    )!;
    expect(both).toBeTruthy();
    expect(botSdk(both).every((fn) => fn.package === "@zrzur/sdk/bot")).toBe(
      true,
    );
    const reference = readFileSync(join(here, "EndpointReference.tsx"), "utf8");
    expect(reference).not.toMatch(/each=\{e\(\)\.sdk\}/);
  });

  it("only names gateway events that exist", () => {
    const events = new Set(inventory.gateway.events.map((e) => e.name));
    for (const e of inventory.endpoints)
      for (const event of e.events)
        expect(events.has(event), `${e.id}: ${event}`).toBe(true);
  });

  it("has a verification entry for every recorded check that still exists", () => {
    const ids = new Set(inventory.endpoints.map((e) => e.id));
    for (const key of Object.keys(verification)) {
      if (/^(GET|POST|PUT|PATCH|DELETE) \//.test(key))
        expect(ids.has(key), `stale verification: ${key}`).toBe(true);
    }
  });
});

// these parse every page in three languages and scan the source tree:
// under a full parallel run they need more than the 5 s default
describe("Documentation pages", { timeout: 30_000 }, () => {
  it("has no empty pages and no orphan Markdown files", () => {
    for (const page of PAGES)
      expect(
        page.source !== undefined || page.id === "getting-started",
        page.id,
      ).toBe(true);
    for (const page of markdownPages)
      expect(page.source!.trim().length, page.id).toBeGreaterThan(200);
    const listed = new Set(PAGES.map((p) => p.id));
    for (const file of markdownFiles())
      expect(listed.has(file), `content/${file}.md is not in PAGES`).toBe(true);
  });

  it("gives every page a translated title", () => {
    const portal = readFileSync(join(here, "DocsPortal.tsx"), "utf8");
    for (const page of PAGES)
      expect(
        portal.includes(`"${page.id}": t\``) ||
          portal.includes(`${page.id}: t\``),
        page.id,
      ).toBe(true);
  });

  it("documents every endpoint on a page", () => {
    const listed = new Set<string>();
    for (const page of markdownPages)
      for (const block of codeBlocksOf(page.source!))
        if (block.lang === "endpoints") listed.add(block.meta.trim());
    for (const e of inventory.endpoints) {
      expect(
        listed.has(e.section),
        `${e.id} (section ${e.section}) is on no page`,
      ).toBe(true);
      expect(
        PAGES.some((p) => p.id === pageOfSection(e.section)),
        e.id,
      ).toBe(true);
    }
  });

  it("uses only known directives, with valid arguments", () => {
    for (const page of markdownPages)
      for (const block of codeBlocksOf(page.source!)) {
        if (!(DIRECTIVES as readonly string[]).includes(block.lang)) continue;
        if (block.lang === "example")
          expect(
            exampleSource(block.meta.trim()),
            `${page.id}: ${block.meta}`,
          ).toBeTruthy();
        if (block.lang === "endpoints")
          expect(
            inventory.endpoints.some((e) => e.section === block.meta.trim()),
            `${page.id}: ${block.meta}`,
          ).toBe(true);
      }
  });

  it("has no broken internal links or anchors", () => {
    for (const page of markdownPages)
      for (const link of linksOf(page.source!)) {
        if (/^https:\/\//.test(link)) continue;
        expect(link.startsWith("/developers"), `${page.id}: ${link}`).toBe(
          true,
        );
        if (link === "/developers") continue;
        // a static file served from public/ (the changelog feed)
        if (/.xml$/.test(link)) {
          expect(
            readdirSync(join(here, "../../../../public/developers")),
            `${page.id}: ${link}`,
          ).toContain(link.split("/").at(-1));
          continue;
        }
        const [path, anchor] = link.split("#");
        const id = path.replace(/^\/developers\/docs\/?/, "") || "overview";
        const anchors = anchorsOfPage(id);
        expect(anchors, `${page.id}: ${link} (no such page)`).not.toBeNull();
        if (anchor)
          expect(
            anchors!.has(anchor),
            `${page.id}: ${link} (no such anchor)`,
          ).toBe(true);
      }
  });

  it("links only to Zrzur or GitHub, never to Stoat or Revolt", () => {
    for (const page of markdownPages)
      for (const link of linksOf(page.source!).filter((l) =>
        /^https?:/.test(l),
      ))
        expect(
          /^https:\/\/(github\.com\/zrzur|[a-z.]*zrzur\.cc)/.test(link),
          `${page.id}: ${link}`,
        ).toBe(true);
    const all =
      PAGES.map((p) => p.source ?? "").join("\n") +
      exampleFiles().map(exampleSource).join("\n");
    expect(all).not.toMatch(
      /stoat\.chat|revolt\.chat|stoatusercontent|revoltusercontent|rvlt\.gg|stt\.gg/,
    );
  });

  it("only mentions routes that exist, with the right method", () => {
    const mention = /\b(GET|POST|PUT|PATCH|DELETE) (\/[^\s`'"<>)]*)/g;
    for (const page of markdownPages) {
      const texts = [
        ...inlineCodeOf(page.source!),
        ...codeBlocksOf(page.source!).map((b) => b.value),
      ];
      for (const text of texts)
        for (const [, method, path] of text.matchAll(mention))
          expect(
            known.has(`${method} ${shape(path)}`),
            `${page.id}: ${method} ${path}`,
          ).toBe(true);
    }
  });
});

describe("Links from the app into the docs", { timeout: 30_000 }, () => {
  const root = join(here, "../../../..");
  const sources = ["src", "components"].flatMap((folder) =>
    (readdirSync(join(root, folder), { recursive: true }) as string[])
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\./.test(file))
      .map((file) => join(root, folder, file)),
  );

  it("point at pages and anchors that exist", () => {
    const links = sources.flatMap((file) =>
      [
        ...readFileSync(file, "utf8").matchAll(
          /["'`](\/developers\/docs\/[a-z0-9-]+(?:#[a-z0-9-]+)?)["'`]/g,
        ),
      ].map(([, link]) => link),
    );
    // the portal's three help links (the first steps are a Markdown page now)
    expect(links.length).toBeGreaterThan(2);
    for (const link of links) {
      const [path, anchor] = link.split("#");
      const anchors = anchorsOfPage(path.split("/").at(-1)!);
      expect(anchors, `${link}: no such page`).not.toBeNull();
      if (anchor) expect(anchors!.has(anchor), `${link}: no anchor`).toBe(true);
    }
  });
});

describe("Reference data", () => {
  it("gives every error a cause and a fix", () => {
    expect(inventory.errors.map((e) => e.type).sort()).toEqual(
      Object.keys(inventory.errorStatus).sort(),
    );
    for (const error of inventory.errors) {
      expect(error.cause, error.type).toBeTruthy();
      expect(error.fix, error.type).toBeTruthy();
    }
  });

  it("explains every event a bot can get", () => {
    for (const event of inventory.gateway.events.filter(
      (e) => e.audience !== "users",
    )) {
      expect(event.docs, event.name).toBeTruthy();
      expect(event.intent, event.name).toBeTruthy();
    }
  });

  it("explains everything a client can send", () => {
    for (const message of inventory.gateway.clientMessages)
      expect(message.docs, message.name).toBeTruthy();
  });

  it("never names Revolt or Stoat in what a page shows", () => {
    // `file` is the path of an SDK source and is not rendered
    const shown = JSON.stringify(inventory, (key, value: unknown) =>
      key === "file" ? undefined : value,
    );
    const pages = PAGES.flatMap((page) => [
      page.source ?? "",
      translatedSource(page.id, "ar") ?? "",
      translatedSource(page.id, "de") ?? "",
    ]).join("\n");
    expect(shown.match(/.{0,40}(revolt|stoat).{0,40}/i)).toBeNull();
    expect(pages.match(/.{0,40}(revolt|stoat).{0,40}/i)).toBeNull();
  });

  it("holds no secret in its samples", () => {
    const text = JSON.stringify(inventory.gateway.events.map((e) => e.sample));
    expect(text).not.toMatch(/"token":"(?!YOUR_TOKEN_HERE)/);
  });
});

describe.each(["ar", "de"] as const)("Translation %s", (locale) => {
  const reference = JSON.parse(
    readFileSync(join(here, `../data/reference.${locale}.json`), "utf8"),
  ) as {
    events: Record<string, string>;
    clientMessages: Record<string, string>;
    permissions: Record<string, string>;
    errors: Record<string, [string, string]>;
  };
  const pages = markdownPages.map((page) => ({
    page,
    text: translatedSource(page.id, locale),
  }));

  it("has every page", () => {
    for (const { page, text } of pages) expect(text, page.id).toBeTruthy();
  });

  it("keeps the anchors, links and code of the English page", () => {
    const codes = (source: string) =>
      codeBlocksOf(source).map((block) => `${block.lang} ${block.meta}`);
    for (const { page, text } of pages) {
      if (!text) continue;
      // the h1 is the page itself, nothing links to its anchor
      expect(anchorsOf(text).slice(1), page.id).toEqual(
        anchorsOf(page.source!).slice(1),
      );
      expect(codes(text), page.id).toEqual(codes(page.source!));
      expect(linksOf(text).sort(), page.id).toEqual(
        linksOf(page.source!).sort(),
      );
    }
  });

  it("has a text for every event, permission and error", () => {
    for (const event of inventory.gateway.events.filter(
      (e) => e.audience !== "users",
    ))
      expect(reference.events[event.name], event.name).toBeTruthy();
    for (const message of inventory.gateway.clientMessages)
      expect(reference.clientMessages[message.name], message.name).toBeTruthy();
    for (const permission of inventory.permissions)
      expect(
        reference.permissions[permission.name],
        permission.name,
      ).toBeTruthy();
    for (const error of inventory.errors)
      expect(reference.errors[error.type], error.type).toHaveLength(2);
  });

  it("lists every section in search", () => {
    for (const { text } of pages)
      if (text)
        for (const heading of headingsOf(text))
          expect(heading.text).not.toMatch(/\{#/);
  });
});

describe("Tutorial examples", () => {
  it("are all used by a tutorial page", () => {
    const used = new Set(
      markdownPages.flatMap((p) =>
        codeBlocksOf(p.source!)
          .filter((b) => b.lang === "example")
          .map((b) => b.meta.trim()),
      ),
    );
    for (const file of exampleFiles()) expect(used.has(file), file).toBe(true);
  });

  it("only call routes that exist, with the right method", () => {
    const calls =
      /(?:rest|request)\(\s*"(GET|POST|PUT|PATCH|DELETE)",\s*`([^`]*)`/g;
    for (const file of exampleFiles())
      for (const [, method, path] of exampleSource(file)!.matchAll(calls))
        expect(
          known.has(`${method} ${shape(path)}`),
          `${file}: ${method} ${path}`,
        ).toBe(true);
  });

  it("never contain a token", () => {
    for (const file of exampleFiles()) {
      const source = exampleSource(file)!;
      expect(source, file).not.toMatch(/token:\s*["'][A-Za-z0-9_-]{20,}["']/);
      expect(source, file).toMatch(
        /process\.env\.ZRZUR_BOT_TOKEN|ZRZUR_BOT_TOKEN: token/,
      );
    }
  });

  it("passed the last live run", () => {
    for (const file of exampleFiles())
      expect(verification[`TUTORIAL ${file}`]?.level, file).toBe("live");
  });
});
