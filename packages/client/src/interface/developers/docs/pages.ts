/**
 * Pages of the Bot API documentation. `content/<id>.md` is English;
 * `content/ar/<id>.md` and `content/de/<id>.md` are the translations and keep
 * the same anchors, code and generated blocks (docs.test.ts checks this).
 */

const sources = import.meta.glob("./content/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export type PageGroup = "start" | "guides" | "tutorials" | "resources";

export interface PageInfo {
  id: string;
  group: PageGroup;
  /** Markdown source; Getting started is a component instead */
  source?: string;
}

const PAGE_ORDER: [PageGroup, string[]][] = [
  ["start", ["overview", "getting-started", "applications"]],
  [
    "guides",
    [
      "authentication",
      "gateway",
      "events",
      "commands",
      "interactions",
      "components",
      "http-interactions",
      "messages",
      "channels",
      "servers",
      "users",
      "roles",
      "moderation",
      "files",
      "voice",
      "oauth2",
      "errors",
      "rate-limits",
      "security",
      "production",
    ],
  ],
  [
    "tutorials",
    [
      "tutorial-full-bot",
      "tutorial-hello",
      "tutorial-commands",
      "tutorial-events",
      "tutorial-moderation",
      "tutorial-welcome",
      "tutorial-games",
      "tutorial-multi-server",
      "tutorial-upload",
      "tutorial-voice",
      "tutorial-deploy",
    ],
  ],
  ["resources", ["raw-http", "sdk", "coverage"]],
];

const markdown = (id: string, locale?: string) =>
  sources[locale ? `./content/${locale}/${id}.md` : `./content/${id}.md`];

const FENCE = /^```[^\n]*\n[\s\S]*?^```$/gm;

/**
 * Translations never copy code: a line `@@3` stands for the fourth fenced
 * block of the English page, so examples cannot drift between languages.
 */
function withEnglishCode(translated: string | undefined, english?: string) {
  const blocks = english?.match(FENCE) ?? [];
  return translated?.replace(
    /^@@(\d+)$/gm,
    (_, index: string) => blocks[Number(index)] ?? "",
  );
}

/** A translated page, with the code of the English page */
export const translatedSource = (id: string, locale: "ar" | "de") =>
  withEnglishCode(markdown(id, locale), markdown(id));

/** Text of a page in a language; English when there is no translation */
export const sourceFor = (page: PageInfo, language: string) =>
  (/^(ar|de)/.test(language)
    ? translatedSource(page.id, language.slice(0, 2) as "ar" | "de")
    : undefined) ?? page.source;

export const PAGES: PageInfo[] = PAGE_ORDER.flatMap(([group, ids]) =>
  ids.map((id) => ({ id, group, source: markdown(id) })),
);

export const DEFAULT_PAGE = "overview";

export const pageById = (id: string | undefined) =>
  PAGES.find((page) => page.id === id);

/** Every English Markdown file in content/, for the tests */
export const markdownFiles = () =>
  Object.keys(sources)
    .filter((path) => path.split("/").length === 3)
    .map((path) => path.split("/").at(-1)!.replace(/\.md$/, ""));
