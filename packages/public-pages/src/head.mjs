/**
 * What search engines and link previews see for a public page: title,
 * description, canonical address, the same page in each site language, the
 * preview image and structured data. Pure functions, no network.
 */

import { plainDescription } from "./plainText.mjs";

/**
 * The languages a page is shown in (?hl=): the website's seven, in its
 * order (packages/client/.../discover/siteLanguages.ts lists the same)
 */
export const DISPLAY_LANGUAGES = [
  "en",
  "de",
  "ar",
  "fr",
  "es",
  "ru",
  "zh-Hans",
];

/** The website's short code for a display language */
const DISPLAY_ALIASES = { zh: "zh-Hans" };

/**
 * The community-language pages of Discover (/ar = servers whose language
 * is Arabic). Not the same list as DISPLAY_LANGUAGES: changing it changes
 * which paths are servers.
 */
export const COMMUNITY_LANGUAGES = ["ar", "en", "de"];

export const TOPICS = {
  gaming: {
    ar: "ألعاب",
    en: "Gaming",
    de: "Gaming",
    fr: "Jeu vidéo",
    es: "Videojuegos",
    ru: "Игры",
    "zh-Hans": "游戏",
  },
  community: {
    ar: "مجتمعات",
    en: "Community",
    de: "Community",
    fr: "Communauté",
    es: "Comunidad",
    ru: "Сообщество",
    "zh-Hans": "社区",
  },
  education: {
    ar: "تعليم",
    en: "Education",
    de: "Bildung",
    fr: "Éducation",
    es: "Educación",
    ru: "Образование",
    "zh-Hans": "教育",
  },
  technology: {
    ar: "تقنية",
    en: "Technology",
    de: "Technik",
    fr: "Technologie",
    es: "Tecnología",
    ru: "Технологии",
    "zh-Hans": "科技",
  },
  art: {
    ar: "فن",
    en: "Art",
    de: "Kunst",
    fr: "Art",
    es: "Arte",
    ru: "Искусство",
    "zh-Hans": "艺术",
  },
  music: {
    ar: "موسيقى",
    en: "Music",
    de: "Musik",
    fr: "Musique",
    es: "Música",
    ru: "Музыка",
    "zh-Hans": "音乐",
  },
  entertainment: {
    ar: "ترفيه",
    en: "Entertainment",
    de: "Unterhaltung",
    fr: "Divertissement",
    es: "Entretenimiento",
    ru: "Развлечения",
    "zh-Hans": "娱乐",
  },
  anime: {
    ar: "أنمي",
    en: "Anime",
    de: "Anime",
    fr: "Anime",
    es: "Anime",
    ru: "Аниме",
    "zh-Hans": "动漫",
  },
  sports: {
    ar: "رياضة",
    en: "Sports",
    de: "Sport",
    fr: "Sport",
    es: "Deportes",
    ru: "Спорт",
    "zh-Hans": "体育",
  },
  science: {
    ar: "علوم",
    en: "Science",
    de: "Wissenschaft",
    fr: "Science",
    es: "Ciencia",
    ru: "Наука",
    "zh-Hans": "科学",
  },
  languages: {
    ar: "لغات",
    en: "Languages",
    de: "Sprachen",
    fr: "Langues",
    es: "Idiomas",
    ru: "Языки",
    "zh-Hans": "语言",
  },
  other: {
    ar: "أخرى",
    en: "Other",
    de: "Sonstiges",
    fr: "Autre",
    es: "Otro",
    ru: "Другое",
    "zh-Hans": "其他",
  },
};

/**
 * Names of the community languages, as each page language says them in
 * TEXT.language (Russian: the form after «на … языке»)
 */
const LANGUAGE_NAMES = {
  ar: {
    ar: "العربية",
    en: "Arabic",
    de: "Arabisch",
    fr: "arabe",
    es: "árabe",
    ru: "арабском",
    "zh-Hans": "阿拉伯语",
  },
  en: {
    ar: "الإنجليزية",
    en: "English",
    de: "Englisch",
    fr: "anglais",
    es: "inglés",
    ru: "английском",
    "zh-Hans": "英语",
  },
  de: {
    ar: "الألمانية",
    en: "German",
    de: "Deutsch",
    fr: "allemand",
    es: "alemán",
    ru: "немецком",
    "zh-Hans": "德语",
  },
};

const DESIGN_KINDS = {
  look: {
    ar: "مظهر الملف الشخصي",
    en: "Profile look",
    de: "Profil-Look",
    fr: "Apparence du profil",
    es: "Aspecto del perfil",
    ru: "Образ профиля",
    "zh-Hans": "个人资料造型",
  },
  decoration: {
    ar: "زينة الصورة",
    en: "Avatar decoration",
    de: "Avatar-Deko",
    fr: "Décoration d’avatar",
    es: "Decoración de avatar",
    ru: "Украшение аватара",
    "zh-Hans": "头像装饰",
  },
  nameplate: {
    ar: "لوحة الاسم",
    en: "Nameplate",
    de: "Namensschild",
    fr: "Plaque de nom",
    es: "Placa de nombre",
    ru: "Шильдик",
    "zh-Hans": "铭牌",
  },
  colours: {
    ar: "ألوان الملف الشخصي",
    en: "Profile colours",
    de: "Profilfarben",
    fr: "Couleurs du profil",
    es: "Colores del perfil",
    ru: "Цвета профиля",
    "zh-Hans": "个人资料颜色",
  },
};

/** French quotes with the no-break spaces French typography wants */
const guillemets = (text) => `«\u00a0${text}\u00a0»`;

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
  fr: {
    discover: "Découvrir Zrzur",
    designs: "Designs Zrzur",
    discoverHome: "Trouve ta communauté — Découvrir Zrzur",
    discoverAbout:
      "Des communautés publiques sur Zrzur pour les jeux, l’apprentissage et les loisirs. Parcours-les sans compte et rejoins-les en un clic.",
    designsHome: "Personnalise ton profil — Designs Zrzur",
    designsAbout:
      "Décorations d’avatar, plaques de nom et apparences de profil pour Zrzur. Essaie chaque design avant de le choisir.",
    topic: (topic) => `${topic} : communautés sur Zrzur`,
    topicAbout: (topic) =>
      `Serveurs publics sur le thème ${guillemets(topic)} sur Zrzur. Parcours et rejoins.`,
    language: (name) => `Communautés en ${name} sur Zrzur`,
    languageAbout: (name) => `Serveurs publics en ${name} sur Zrzur.`,
    server: (name) => `${name} — Découvrir Zrzur`,
    serverAbout: (name, members) =>
      `${name} est une communauté sur Zrzur d’environ ${members} membres. Rejoins-la gratuitement.`,
    design: (name, kind) => `${name} — ${kind} sur Designs Zrzur`,
    designAbout: (name, kind) =>
      `${kind} ${guillemets(name)} pour ton profil Zrzur. À essayer, puis à utiliser.`,
    missing: "Page introuvable — Zrzur",
  },
  es: {
    discover: "Descubrir Zrzur",
    designs: "Diseños de Zrzur",
    discoverHome: "Encuentra tu comunidad — Descubrir Zrzur",
    discoverAbout:
      "Comunidades públicas en Zrzur para juegos, aprendizaje y aficiones. Explora sin cuenta y únete con un clic.",
    designsHome: "Dale estilo a tu perfil — Diseños de Zrzur",
    designsAbout:
      "Decoraciones de avatar, placas de nombre y aspectos de perfil para Zrzur. Prueba cualquier diseño antes de elegirlo.",
    topic: (topic) => `${topic}: comunidades en Zrzur`,
    topicAbout: (topic) =>
      `Servidores públicos sobre «${topic}» en Zrzur. Explora y únete.`,
    language: (name) => `Comunidades en ${name} en Zrzur`,
    languageAbout: (name) =>
      `Servidores públicos en Zrzur cuyo idioma es el ${name}.`,
    server: (name) => `${name} — Descubrir Zrzur`,
    serverAbout: (name, members) =>
      `${name} es una comunidad en Zrzur con unos ${members} miembros. Únete gratis.`,
    design: (name, kind) => `${name} — ${kind} en Diseños de Zrzur`,
    designAbout: (name, kind) =>
      `${kind} «${name}» para tu perfil de Zrzur. Pruébalo antes de usarlo.`,
    missing: "Página no encontrada — Zrzur",
  },
  ru: {
    discover: "Обзор Zrzur",
    designs: "Дизайны Zrzur",
    discoverHome: "Найдите своё сообщество — Обзор Zrzur",
    discoverAbout:
      "Публичные сообщества в Zrzur для игр, учёбы и хобби. Смотрите без аккаунта и вступайте в один клик.",
    designsHome: "Оформите свой профиль — Дизайны Zrzur",
    designsAbout:
      "Украшения аватара, шильдики и образы профиля для Zrzur. Примерьте любой дизайн, прежде чем выбрать.",
    topic: (topic) => `${topic}: сообщества в Zrzur`,
    topicAbout: (topic) =>
      `Публичные серверы на тему «${topic}» в Zrzur. Смотрите и вступайте.`,
    language: (name) => `Сообщества на ${name} языке в Zrzur`,
    languageAbout: (name) => `Публичные серверы в Zrzur на ${name} языке.`,
    server: (name) => `${name} — Обзор Zrzur`,
    serverAbout: (name, members) =>
      `${name} — сообщество в Zrzur, в котором около ${members} участников. Вступить можно бесплатно.`,
    design: (name, kind) => `${kind} «${name}» — Дизайны Zrzur`,
    designAbout: (name, kind) =>
      `${kind} «${name}» для вашего профиля в Zrzur. Примерьте, затем используйте.`,
    missing: "Страница не найдена — Zrzur",
  },
  "zh-Hans": {
    discover: "Zrzur 发现",
    designs: "Zrzur 设计",
    discoverHome: "找到你的社区 — Zrzur 发现",
    discoverAbout:
      "Zrzur 上的公开社区，涵盖游戏、学习和兴趣爱好。无需账号即可浏览，一键加入。",
    designsHome: "装扮你的个人资料 — Zrzur 设计",
    designsAbout:
      "Zrzur 的头像装饰、铭牌和个人资料造型。选择之前，可先试用任何设计。",
    topic: (topic) => `Zrzur 上的${topic}社区`,
    topicAbout: (topic) => `Zrzur 上关于“${topic}”的公开服务器。浏览并加入。`,
    language: (name) => `Zrzur 上的${name}社区`,
    languageAbout: (name) => `Zrzur 上使用${name}的公开服务器。`,
    server: (name) => `${name} — Zrzur 发现`,
    serverAbout: (name, members) =>
      `${name} 是 Zrzur 上的一个社区，约有 ${members} 名成员。免费加入。`,
    design: (name, kind) => `${name} — Zrzur 设计中的${kind}`,
    designAbout: (name, kind) =>
      `适用于你的 Zrzur 个人资料的${kind}“${name}”。先试用，再使用。`,
    missing: "页面未找到 — Zrzur",
  },
};

const LOCALE_TAG = {
  ar: "ar_AR",
  en: "en_US",
  de: "de_DE",
  fr: "fr_FR",
  es: "es_ES",
  ru: "ru_RU",
  "zh-Hans": "zh_CN",
};

/** The display language a ?hl= value names, if it names one */
export function displayLanguage(hl) {
  if (!hl) return undefined;
  if (DISPLAY_LANGUAGES.includes(hl)) return hl;
  return DISPLAY_ALIASES[hl];
}

/**
 * The same page in every display language, plus x-default (the bare
 * address), for <link rel="alternate"> and the sitemap
 */
export function alternateLinks(base) {
  return [
    ...DISPLAY_LANGUAGES.map((hl) => ({
      hreflang: hl,
      href: `${base}?hl=${hl}`,
    })),
    { hreflang: "x-default", href: base },
  ];
}

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
    if (COMMUNITY_LANGUAGES.includes(first))
      return { kind: "language", id: first };
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
  const asked = displayLanguage(lang);
  const language = asked ?? "en";
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
    const about = plainDescription(data.description);
    description = clip(about || text.serverAbout(data.name, members));
    image = `${origin}/og/server/${encodeURIComponent(data.link ?? data._id)}.png`;
    jsonLd = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: data.name,
      description: about || undefined,
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
    canonical: url(asked),
    alternates: alternateLinks(base),
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
