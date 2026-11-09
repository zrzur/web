/**
 * Pages of the Bot API documentation. `content/<id>.md` is English;
 * `content/ar/<id>.md` and `content/de/<id>.md` are the translations and keep
 * the same anchors, code and generated blocks (docs.test.ts checks this).
 *
 * Every file is its own chunk, loaded when a page in that language opens:
 * a reader downloads the page they read, not the whole site in three
 * languages.
 */

import { loadOnce } from "./loadOnce";

const loaders = import.meta.glob<string>("./content/**/*.md", {
  query: "?raw",
  import: "default",
});

export type PageGroup = "start" | "guides" | "tutorials" | "resources";

export interface PageInfo {
  id: string;
  group: PageGroup;
  /** Markdown page; Getting started is a component instead */
  hasSource: boolean;
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
  ["resources", ["raw-http", "sdk", "coverage", "changelog"]],
];

const pathOf = (id: string, locale?: string) =>
  locale ? `./content/${locale}/${id}.md` : `./content/${id}.md`;

const cache = new Map<string, Promise<string | undefined>>();

/** One Markdown file, fetched once (a failed fetch is tried again) */
function file(path: string): Promise<string | undefined> {
  const load = loaders[path];
  if (!load) return Promise.resolve(undefined);
  return loadOnce(cache, path, load);
}

const FENCE = /^```[^\n]*\n[\s\S]*?^```$/gm;

/**
 * Translations never copy code: a line `@@3` stands for the fourth fenced
 * block of the English page, so examples cannot drift between languages.
 */
export function withEnglishCode(
  translated: string | undefined,
  english?: string,
) {
  const blocks = english?.match(FENCE) ?? [];
  return translated?.replace(
    /^@@(\d+)$/gm,
    (_, index: string) => blocks[Number(index)] ?? "",
  );
}

/** The two languages with translated pages; English for every other */
export const docsLocale = (language: string) =>
  (/^(ar|de)/.exec(language)?.[1] as "ar" | "de" | undefined) ?? undefined;

/** A translated page, with the code of the English page */
export async function loadTranslated(id: string, locale: "ar" | "de") {
  const [translated, english] = await Promise.all([
    file(pathOf(id, locale)),
    file(pathOf(id)),
  ]);
  return withEnglishCode(translated, english);
}

/** Text of a page in a language; English when there is no translation */
export async function loadSource(id: string, language: string) {
  const locale = docsLocale(language);
  return (
    (locale ? await loadTranslated(id, locale) : undefined) ??
    (await file(pathOf(id)))
  );
}

export const PAGES: PageInfo[] = PAGE_ORDER.flatMap(([group, ids]) =>
  ids.map((id) => ({ id, group, hasSource: pathOf(id) in loaders })),
);

export const DEFAULT_PAGE = "overview";

export const pageById = (id: string | undefined) =>
  PAGES.find((page) => page.id === id);

/** Every English Markdown file in content/, for the tests */
export const markdownFiles = () =>
  Object.keys(loaders)
    .filter((path) => path.split("/").length === 3)
    .map((path) => path.split("/").at(-1)!.replace(/\.md$/, ""));
