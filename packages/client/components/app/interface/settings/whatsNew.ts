/** The website's blog languages besides English (zrzur.com/<lang>/blog) */
const BLOG_LANGUAGES = ["ar", "de", "fr", "es", "ru", "zh"];

/**
 * Where "What's New" leads while the changelog service is not running: the
 * blog, in the app's language when the website has it, otherwise in English.
 */
export function whatsNewUrl(lang?: string) {
  const base = (lang || "en").toLowerCase().split(/[-_]/)[0];
  return `https://zrzur.com${BLOG_LANGUAGES.includes(base) ? `/${base}` : ""}/blog`;
}
