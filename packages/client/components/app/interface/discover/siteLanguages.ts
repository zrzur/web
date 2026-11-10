/**
 * The languages of the public sites (Discover, Designs): the website's
 * seven, in the order and by the names its own menu shows (no flags).
 * No imports, so unit tests and the server-side head can share the rules.
 */
export const SITE_LANGUAGES = [
  { id: "en", name: "English" },
  { id: "de", name: "Deutsch" },
  { id: "ar", name: "العربية" },
  { id: "fr", name: "Français" },
  { id: "es", name: "Español" },
  { id: "ru", name: "Русский" },
  { id: "zh-Hans", name: "简体中文" },
] as const;

export type SiteLanguage = (typeof SITE_LANGUAGES)[number]["id"];

const ENGLISH = SITE_LANGUAGES[0];

/** The site language for the app's locale, English for any other */
export function siteLanguage(locale: string | undefined) {
  return SITE_LANGUAGES.find((language) => language.id === locale) ?? ENGLISH;
}

/** The website uses `zh` where the app says `zh-Hans` */
const ALIASES: Record<string, SiteLanguage> = { zh: "zh-Hans" };

/** The `?hl=` language a shared link asks for, if it is one we offer */
export function linkLanguage(search: string): SiteLanguage | undefined {
  const value = new URLSearchParams(search).get("hl") ?? "";
  return (
    SITE_LANGUAGES.find((language) => language.id === value)?.id ??
    ALIASES[value]
  );
}

/** The website's folder for a language ("" for English and unknown ones) */
export function reportPrefix(locale: string | undefined) {
  if (!locale || locale === "en") return "";
  if (locale === "zh-Hans") return "/zh";
  return SITE_LANGUAGES.some((language) => language.id === locale)
    ? `/${locale}`
    : "";
}
