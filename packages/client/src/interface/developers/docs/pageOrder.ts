/**
 * The pages of the documentation, in the order the contents list shows
 * them. No imports: the app (pages.ts) and the build step that writes the
 * plain HTML of every page (scripts/bot-api/prerender-docs.mjs) share it.
 */

export type PageGroup = "start" | "guides" | "tutorials" | "resources";

export const PAGE_ORDER: [PageGroup, string[]][] = [
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

export const DEFAULT_PAGE = "overview";

/** The languages the pages are written in; any other reads English */
export const DOCS_LANGUAGES = ["en", "de", "ar"] as const;

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
