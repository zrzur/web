import { useLingui } from "@lingui/solid/macro";

import type { IconName } from "@revolt/ui/icons/Icon";

import type { DiscoverKind } from "./api";

/** Must match DISCOVER_SERVER_CATEGORIES / DISCOVER_BOT_CATEGORIES in the API */
export const CATEGORIES: Record<
  DiscoverKind,
  { id: string; icon: IconName }[]
> = {
  servers: [
    { id: "gaming", icon: "game-controller" },
    { id: "community", icon: "users-three" },
    { id: "education", icon: "books" },
    { id: "technology", icon: "cpu" },
    { id: "art", icon: "paint-brush" },
    { id: "music", icon: "music-note" },
    { id: "entertainment", icon: "confetti" },
    { id: "anime", icon: "sparkle" },
    { id: "sports", icon: "medal" },
    { id: "science", icon: "flask" },
    { id: "languages", icon: "translate" },
    { id: "other", icon: "squares-four" },
  ],
  bots: [
    { id: "moderation", icon: "shield-check" },
    { id: "utility", icon: "wrench" },
    { id: "fun", icon: "smiley" },
    { id: "music", icon: "music-note" },
    { id: "games", icon: "game-controller" },
    { id: "social", icon: "chats-circle" },
    { id: "other", icon: "squares-four" },
  ],
};

/** Languages offered for listings (ISO 639-1); names come from Intl */
export const LANGUAGES = [
  "ar",
  "en",
  "fr",
  "de",
  "es",
  "tr",
  "fa",
  "ku",
  "ur",
  "ru",
  "pt",
  "it",
  "nl",
  "id",
  "hi",
  "zh",
  "ja",
  "ko",
];

export const MAX_TAGS = 5;

export function categoryIcon(kind: DiscoverKind, id?: string): IconName {
  return CATEGORIES[kind].find((c) => c.id === id)?.icon ?? "squares-four";
}

/**
 * Localised names for categories and languages
 */
export function useDiscoverLabels() {
  const { t, i18n } = useLingui();

  const names: Record<string, () => string> = {
    gaming: () => t`Gaming`,
    community: () => t`Community`,
    education: () => t`Education`,
    technology: () => t`Technology`,
    art: () => t`Art & Creativity`,
    music: () => t`Music`,
    entertainment: () => t`Entertainment`,
    anime: () => t`Anime & Manga`,
    sports: () => t`Sports`,
    science: () => t`Science`,
    languages: () => t`Languages`,
    moderation: () => t`Moderation`,
    utility: () => t`Utility`,
    fun: () => t`Fun`,
    games: () => t`Games`,
    social: () => t`Social`,
    other: () => t`Other`,
  };

  return {
    category: (id?: string) => (id && names[id] ? names[id]() : ""),
    language: (code?: string) => {
      if (!code) return "";
      try {
        return (
          new Intl.DisplayNames([i18n().locale || "en"], {
            type: "language",
          }).of(code) ?? code
        );
      } catch {
        return code;
      }
    },
  };
}
