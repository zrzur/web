/**
 * The page the service worker answers with when the app is opened and the
 * network cannot be reached. It is written here, not fetched or cached: no
 * HTML is ever kept on the device, so a release can never be served stale.
 * No script: the page asks again by itself every few seconds, and the link
 * asks at once. The service worker has no message catalog, so the three
 * lines live here in the app's languages.
 */

interface OfflineText {
  title: string;
  body: string;
  retry: string;
  rtl?: boolean;
}

export const OFFLINE_TEXT: Record<string, OfflineText> = {
  en: {
    title: "No internet connection",
    body: "Zrzur opens by itself when the connection is back.",
    retry: "Try again",
  },
  ar: {
    title: "لا يوجد اتصال بالإنترنت",
    body: "سيفتح زرزور تلقائيًا عند عودة الاتصال.",
    retry: "أعد المحاولة",
    rtl: true,
  },
  de: {
    title: "Keine Internetverbindung",
    body: "Zrzur öffnet sich von selbst, sobald die Verbindung zurück ist.",
    retry: "Erneut versuchen",
  },
  fr: {
    title: "Pas de connexion Internet",
    body: "Zrzur s’ouvre tout seul dès que la connexion revient.",
    retry: "Réessayer",
  },
  es: {
    title: "Sin conexión a Internet",
    body: "Zrzur se abre solo cuando vuelve la conexión.",
    retry: "Reintentar",
  },
  ru: {
    title: "Нет подключения к интернету",
    body: "Zrzur откроется сам, когда связь вернётся.",
    retry: "Повторить",
  },
  zh: {
    title: "没有网络连接",
    body: "网络恢复后，Zrzur 会自动打开。",
    retry: "重试",
  },
};

/** Where the worker keeps the app's language (two letters, nothing else) */
export const OFFLINE_CACHE = "zrzur-offline-v1";
export const OFFLINE_LANGUAGE_KEY = "./offline-language";

/** A language code as the app sends it, or nothing if it is not one */
export function offlineLocale(value: unknown): string | undefined {
  return typeof value === "string" &&
    /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(value)
    ? value
    : undefined;
}

/** Seconds between the page's own attempts */
export const OFFLINE_RETRY_SECONDS = 8;

/** The first of the device's languages the page has, else English */
export function offlineLanguage(languages: readonly string[]): string {
  for (const language of languages) {
    const short = language.toLowerCase().split("-")[0];
    if (short in OFFLINE_TEXT) return short;
  }
  return "en";
}

/** The mark (logo B): the path of assets/web/zrzur-mark.svg, unchanged */
const MARK =
  '<svg viewBox="0 0 256 256" width="96" height="96" aria-hidden="true"><path fill="#F0F1F8" fill-rule="evenodd" d="M 84 78 L 172 78 C 181 78 187 81 193 88 L 226 124 C 237 136 237 148 226 159 L 210 175 C 199 186 185 186 175 176 L 166 167 C 162 163 157 161 150 161 L 106 161 C 99 161 94 163 90 167 L 81 176 C 71 186 57 186 46 175 L 30 159 C 19 148 19 136 30 124 L 63 88 C 69 81 75 78 84 78 Z M 68 126 C 70 113 78 104 89 104 C 102 103 112 112 115 125 C 117 132 112 135 107 131 C 101 126 96 122 91 122 C 85 122 80 126 75 131 C 70 135 67 132 68 126 Z M 188 126 C 186 113 178 104 167 104 C 154 103 144 112 141 125 C 139 132 144 135 149 131 C 155 126 160 122 165 122 C 171 122 176 126 181 131 C 186 135 189 132 188 126 Z"/></svg>';

/** The whole page, in the first language of the device that it has */
export function offlinePage(languages: readonly string[]): string {
  const lang = offlineLanguage(languages);
  const text = OFFLINE_TEXT[lang];
  return `<!doctype html>
<html lang="${lang}" dir="${text.rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0D0E16">
<meta http-equiv="refresh" content="${OFFLINE_RETRY_SECONDS}">
<title>Zrzur</title>
<style>
html,body{height:100%;margin:0}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;box-sizing:border-box;padding:max(24px,env(safe-area-inset-top)) 28px max(24px,env(safe-area-inset-bottom));background:#0D0E16;color:#F0F1F8;font:16px/1.6 "IBM Plex Sans Arabic","IBM Plex Sans",system-ui,sans-serif;text-align:center}
h1{margin:8px 0 0;font-size:20px;line-height:1.4;font-weight:700}
p{margin:0;max-width:34ch;font-size:14px;color:#A9ACC4}
a{display:inline-flex;align-items:center;justify-content:center;min-height:48px;margin-top:8px;padding:0 24px;border:1px solid #303348;border-radius:10px;color:#F0F1F8;font-weight:600;text-decoration:none}
a:active{background:#1D1F2D}
a:focus-visible{outline:2px solid #E0195F;outline-offset:2px}
</style>
</head>
<body>
${MARK}
<h1>${text.title}</h1>
<p>${text.body}</p>
<a href="">${text.retry}</a>
</body>
</html>`;
}

/** Headers of that answer: nothing in it may load or run anything */
export const OFFLINE_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "content-security-policy":
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
  "x-content-type-options": "nosniff",
};
