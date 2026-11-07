/**
 * What search engines and link previews see for a public page: title,
 * description, canonical address, the same page in ar / en / de, the
 * preview image and structured data. Pure functions, no network.
 */

export const LANGUAGES = ["ar", "en", "de"];

export const TOPICS = {
  gaming: { ar: "ألعاب", en: "Gaming", de: "Gaming" },
  community: { ar: "مجتمعات", en: "Community", de: "Community" },
  education: { ar: "تعليم", en: "Education", de: "Bildung" },
  technology: { ar: "تقنية", en: "Technology", de: "Technik" },
  art: { ar: "فن", en: "Art", de: "Kunst" },
  music: { ar: "موسيقى", en: "Music", de: "Musik" },
  entertainment: { ar: "ترفيه", en: "Entertainment", de: "Unterhaltung" },
  anime: { ar: "أنمي", en: "Anime", de: "Anime" },
  sports: { ar: "رياضة", en: "Sports", de: "Sport" },
  science: { ar: "علوم", en: "Science", de: "Wissenschaft" },
  languages: { ar: "لغات", en: "Languages", de: "Sprachen" },
  other: { ar: "أخرى", en: "Other", de: "Sonstiges" },
};

const LANGUAGE_NAMES = {
  ar: { ar: "العربية", en: "Arabic", de: "Arabisch" },
  en: { ar: "الإنجليزية", en: "English", de: "Englisch" },
  de: { ar: "الألمانية", en: "German", de: "Deutsch" },
};

const DESIGN_KINDS = {
  look: { ar: "مظهر الملف الشخصي", en: "Profile look", de: "Profil-Look" },
  decoration: { ar: "زينة الصورة", en: "Avatar decoration", de: "Avatar-Deko" },
  nameplate: { ar: "لوحة الاسم", en: "Nameplate", de: "Namensschild" },
  colours: {
    ar: "ألوان الملف الشخصي",
    en: "Profile colours",
    de: "Profilfarben",
  },
};

const TEXT = {
  ar: {
    discover: "اكتشف زرزور",
    designs: "تصاميم زرزور",
    discoverHome: "اعثر على مجتمعك — اكتشف زرزور",
    discoverAbout:
      "مجتمعات عامة على زرزور للألعاب والتعلّم والهوايات. تصفّح دون حساب، وانضم بضغطة.",
    designsHome: "زيّن ملفك الشخصي — تصاميم زرزور",
    designsAbout:
      "زينة للصورة ولوحات للاسم ومظاهر للملف الشخصي على زرزور. جرّب أي تصميم قبل أن تختاره.",
    topic: (topic) => `مجتمعات ${topic} على زرزور`,
    topicAbout: (topic) => `سيرفرات عامة عن ${topic} على زرزور. تصفّح وانضم.`,
    language: (name) => `مجتمعات باللغة ${name} على زرزور`,
    languageAbout: (name) => `سيرفرات عامة لغتها ${name} على زرزور.`,
    server: (name) => `${name} — اكتشف زرزور`,
    serverAbout: (name, members) =>
      `${name} مجتمع على زرزور يضم نحو ${members} عضو. انضم مجانًا.`,
    design: (name, kind) => `${name} — ${kind} من تصاميم زرزور`,
    designAbout: (name, kind) =>
      `${kind} «${name}» لملفك الشخصي على زرزور. جرّبه ثم استخدمه.`,
    missing: "الصفحة غير موجودة — زرزور",
  },
  en: {
    discover: "Zrzur Discover",
    designs: "Zrzur Designs",
    discoverHome: "Find your community — Zrzur Discover",
    discoverAbout:
      "Public communities on Zrzur for games, learning and hobbies. Browse without an account and join in one click.",
    designsHome: "Style your profile — Zrzur Designs",
    designsAbout:
      "Avatar decorations, nameplates and profile looks for Zrzur. Try any design on before you choose it.",
    topic: (topic) => `${topic} communities on Zrzur`,
    topicAbout: (topic) =>
      `Public ${topic.toLowerCase()} servers on Zrzur. Browse and join.`,
    language: (name) => `Communities in ${name} on Zrzur`,
    languageAbout: (name) =>
      `Public servers on Zrzur whose language is ${name}.`,
    server: (name) => `${name} — Zrzur Discover`,
    serverAbout: (name, members) =>
      `${name} is a community on Zrzur with about ${members} members. Join for free.`,
    design: (name, kind) => `${name} — ${kind} on Zrzur Designs`,
    designAbout: (name, kind) =>
      `The ${kind.toLowerCase()} “${name}” for your Zrzur profile. Try it on, then use it.`,
    missing: "Page not found — Zrzur",
  },
  de: {
    discover: "Zrzur entdecken",
    designs: "Zrzur Designs",
    discoverHome: "Finde deine Community — Zrzur entdecken",
    discoverAbout:
      "Öffentliche Communitys auf Zrzur für Spiele, Lernen und Hobbys. Ohne Konto stöbern, mit einem Klick beitreten.",
    designsHome: "Gestalte dein Profil — Zrzur Designs",
    designsAbout:
      "Avatar-Dekos, Namensschilder und Profil-Looks für Zrzur. Probier jedes Design an, bevor du es wählst.",
    topic: (topic) => `${topic}-Communitys auf Zrzur`,
    topicAbout: (topic) => `Öffentliche Server zum Thema ${topic} auf Zrzur.`,
    language: (name) => `Communitys auf ${name} bei Zrzur`,
    languageAbout: (name) => `Öffentliche Server auf Zrzur in ${name}.`,
    server: (name) => `${name} — Zrzur entdecken`,
    serverAbout: (name, members) =>
      `${name} ist eine Community auf Zrzur mit etwa ${members} Mitgliedern. Kostenlos beitreten.`,
    design: (name, kind) => `${name} — ${kind} bei Zrzur Designs`,
    designAbout: (name, kind) =>
      `${kind} „${name}“ für dein Zrzur-Profil. Anprobieren und verwenden.`,
    missing: "Seite nicht gefunden — Zrzur",
  },
};

const LOCALE_TAG = { ar: "ar_AR", en: "en_US", de: "de_DE" };

/** Rounded the way public pages show counts: never an exact figure */
export function roughCount(n) {
  if (n < 10) return String(n);
  const step = n < 100 ? 10 : n < 1000 ? 50 : n < 10000 ? 500 : 5000;
  return String(Math.round(n / step) * step);
}

/** "Night glow" from "night-glow", for built-in designs */
export function humanize(id) {
  const text = id.replace(/[-_]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const clip = (text, max = 160) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

/**
 * What a path on a site is. `site` is "discover" or "designs".
 */
export function routeOf(site, path) {
  const parts = path.split("/").filter(Boolean);
  if (!parts.length) return { kind: "home" };
  const [first, second] = parts;
  if (site === "discover") {
    if (first === "bots" || first === "servers")
      return second && first === "servers"
        ? { kind: "server", slug: second }
        : { kind: "home" };
    if (TOPICS[first]) return { kind: "topic", id: first };
    if (LANGUAGES.includes(first)) return { kind: "language", id: first };
    if (parts.length === 1 && /^[A-Za-z0-9_-]{1,64}$/.test(first))
      return { kind: "server", slug: first };
    return { kind: "other" };
  }
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/.test(first))
    return { kind: "design", ref: { kind: "community", id: first } };
  const match =
    /^(look|decoration|nameplate|colours)-([A-Za-z0-9_-]{1,40})$/.exec(first);
  if (match) return { kind: "design", ref: { kind: match[1], id: match[2] } };
  return { kind: "other" };
}

/**
 * The head of one page.
 * @param input.site "discover" | "designs"
 * @param input.origin e.g. "https://discover.zrzur.com"
 * @param input.path the path without query
 * @param input.lang the ?hl= language, if any
 * @param input.route from routeOf
 * @param input.data the server card or design, once fetched (null: missing)
 */
export function pageMeta({ site, origin, path, lang, route, data }) {
  const language = LANGUAGES.includes(lang) ? lang : "en";
  const text = TEXT[language];
  const base = `${origin}${path === "/" ? "/" : path}`;
  const url = (hl) => (hl ? `${base}?hl=${hl}` : base);

  let title = site === "discover" ? text.discoverHome : text.designsHome;
  let description =
    site === "discover" ? text.discoverAbout : text.designsAbout;
  let image = `${origin}/og/site.png`;
  let status = 200;
  let type = "website";
  let jsonLd;

  if (route.kind === "topic") {
    const topic = TOPICS[route.id][language];
    title = text.topic(topic);
    description = text.topicAbout(topic);
  } else if (route.kind === "language") {
    const name = LANGUAGE_NAMES[route.id][language];
    title = text.language(name);
    description = text.languageAbout(name);
  } else if (route.kind === "server" && data) {
    const members = roughCount(data.member_count ?? 0);
    title = text.server(data.name);
    description = clip(
      data.description?.trim() || text.serverAbout(data.name, members),
    );
    image = `${origin}/og/server/${encodeURIComponent(data.link ?? data._id)}.png`;
    jsonLd = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: data.name,
      description: data.description || undefined,
      url: base,
      ...(data.language ? { knowsLanguage: data.language } : {}),
    };
  } else if (route.kind === "design" && data) {
    const kind = DESIGN_KINDS[data.kind]?.[language] ?? data.kind;
    title = text.design(data.name, kind);
    description = clip(
      data.description?.trim() || text.designAbout(data.name, kind),
    );
    image = `${origin}/og/design/${encodeURIComponent(path.slice(1))}.png`;
    type = "article";
  } else if (route.kind !== "home") {
    title = text.missing;
    status = 404;
  }

  return {
    lang: language,
    dir: language === "ar" ? "rtl" : "ltr",
    title,
    description,
    canonical: url(lang && LANGUAGES.includes(lang) ? lang : undefined),
    alternates: [
      ...LANGUAGES.map((hl) => ({ hreflang: hl, href: url(hl) })),
      { hreflang: "x-default", href: url() },
    ],
    image,
    siteName: site === "discover" ? text.discover : text.designs,
    locale: LOCALE_TAG[language],
    type,
    status,
    jsonLd,
  };
}

const escape = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** The tags for <head> */
export function headTags(meta) {
  const tags = [
    `<meta name="description" content="${escape(meta.description)}">`,
    `<link rel="canonical" href="${escape(meta.canonical)}">`,
    ...meta.alternates.map(
      (alt) =>
        `<link rel="alternate" hreflang="${alt.hreflang}" href="${escape(alt.href)}">`,
    ),
    `<meta property="og:type" content="${meta.type}">`,
    `<meta property="og:site_name" content="${escape(meta.siteName)}">`,
    `<meta property="og:title" content="${escape(meta.title)}">`,
    `<meta property="og:description" content="${escape(meta.description)}">`,
    `<meta property="og:url" content="${escape(meta.canonical)}">`,
    `<meta property="og:image" content="${escape(meta.image)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:locale" content="${meta.locale}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escape(meta.title)}">`,
    `<meta name="twitter:description" content="${escape(meta.description)}">`,
    `<meta name="twitter:image" content="${escape(meta.image)}">`,
  ];
  if (meta.status === 404) tags.push(`<meta name="robots" content="noindex">`);
  if (meta.jsonLd)
    tags.push(
      `<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, "\\u003c")}</script>`,
    );
  return tags.join("\n    ");
}

/** The app's index.html with this page's head */
export function injectHead(html, meta) {
  return html
    .replace(/<html[^>]*>/i, `<html lang="${meta.lang}" dir="${meta.dir}">`)
    .replace(
      /<title>[\s\S]*?<\/title>/i,
      `<title>${escape(meta.title)}</title>`,
    )
    .replace(/<meta name="description"[^>]*>\s*/i, "")
    .replace(/<\/head>/i, `    ${headTags(meta)}\n  </head>`);
}
