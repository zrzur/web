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
import {
  type PageGroup,
  DEFAULT_PAGE,
  PAGE_ORDER,
  withEnglishCode,
} from "./pageOrder";

export { type PageGroup, DEFAULT_PAGE, withEnglishCode };

const loaders = import.meta.glob<string>("./content/**/*.md", {
  query: "?raw",
  import: "default",
});

export interface PageInfo {
  id: string;
  group: PageGroup;
  /** the page has a Markdown file (every page does; kept for the tests) */
  hasSource: boolean;
}

const pathOf = (id: string, locale?: string) =>
  locale ? `./content/${locale}/${id}.md` : `./content/${id}.md`;

const cache = new Map<string, Promise<string | undefined>>();

/** One Markdown file, fetched once (a failed fetch is tried again) */
function file(path: string): Promise<string | undefined> {
  const load = loaders[path];
  if (!load) return Promise.resolve(undefined);
  return loadOnce(cache, path, load);
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

export const pageById = (id: string | undefined) =>
  PAGES.find((page) => page.id === id);

/** Every English Markdown file in content/, for the tests */
export const markdownFiles = () =>
  Object.keys(loaders)
    .filter((path) => path.split("/").length === 3)
    .map((path) => path.split("/").at(-1)!.replace(/\.md$/, ""));
