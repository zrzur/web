/**
 * The developer documentation site (developers.zrzur.com): what the server
 * adds to the web app's page for each documentation page. The words come
 * from the build (dist/docs-pages, written by the client's
 * scripts/bot-api/prerender-docs.mjs from the same Markdown the app shows):
 * title, description, addresses in the three written languages, structured
 * data, and the text itself as plain HTML, which the app replaces when it
 * has loaded. Pure functions, no network.
 */

const escape = (text) =>
  String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const LOCALE_TAG = { en: "en_US", de: "de_DE", ar: "ar_AR" };

/** The language a link asks for (?hl=), if the pages are written in it */
export function docsLanguage(index, hl) {
  return index.languages.includes(hl) ? hl : undefined;
}

/**
 * What an address shows: a page, a move to the page's own address (the
 * front page is the overview; addresses copied from inside the app lose
 * /developers/docs), or nothing.
 */
export function docsRoute(index, path) {
  const clean = path.replace(/\/+$/, "") || "/";
  if (clean === "/") return { kind: "page", id: index.pages[0].id, home: true };
  const inApp = /^\/developers\/docs(\/.*)?$/.exec(clean);
  if (inApp) return { kind: "moved", to: inApp[1] ?? "/" };
  const id = /^\/([a-z0-9-]+)$/.exec(clean)?.[1];
  if (id === index.pages[0].id) return { kind: "moved", to: "/" };
  if (id && index.pages.some((page) => page.id === id))
    return path === clean
      ? { kind: "page", id, home: false }
      : { kind: "moved", to: clean };
  return { kind: "missing" };
}

/** The same page in each written language, and the one without a choice */
export function docsAlternates(index, base) {
  return [
    ...index.languages.map((hl) => ({
      hreflang: hl,
      href: `${base}?hl=${hl}`,
    })),
    { hreflang: "x-default", href: base },
  ];
}

/** Head of a documentation page, in the shape head.mjs's headTags reads */
export function docsMeta({ index, origin, route, lang }) {
  const asked = docsLanguage(index, lang);
  const language = asked ?? "en";
  const words = index.words[language];
  const common = {
    lang: language,
    dir: language === "ar" ? "rtl" : "ltr",
    image: `${origin}/og/site.png`,
    siteName: words.site,
    locale: LOCALE_TAG[language],
  };
  if (route.kind !== "page")
    return {
      ...common,
      title: words.site,
      description: words.about,
      canonical: `${origin}/`,
      alternates: [],
      type: "website",
      status: 404,
    };
  const page = index.text[language][route.id];
  const base = route.home ? `${origin}/` : `${origin}/${route.id}`;
  const canonical = asked ? `${base}?hl=${asked}` : base;
  return {
    ...common,
    title: `${page.title} · ${words.site}`,
    description: route.home ? words.about : page.description,
    canonical,
    alternates: docsAlternates(index, base),
    type: route.home ? "website" : "article",
    status: 200,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${origin}/#site`,
          name: words.site,
          url: `${origin}/`,
          inLanguage: index.languages,
          publisher: {
            "@type": "Organization",
            name: "Zrzur",
            alternateName: "زرزور",
            url: "https://zrzur.com",
          },
        },
        {
          "@type": "TechArticle",
          headline: page.title,
          description: page.description,
          inLanguage: language,
          url: canonical,
          mainEntityOfPage: canonical,
          isPartOf: { "@id": `${origin}/#site` },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: words.site,
              item: `${origin}/`,
            },
            ...(route.home
              ? []
              : [
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: page.title,
                    item: canonical,
                  },
                ]),
          ],
        },
      ],
    },
  };
}

/**
 * How the plain page looks until the app has loaded, and for readers
 * without JavaScript: the app's dark page, one text column. It lies over
 * the app's loading screen; the app removes it once the page is on screen.
 */
const STYLE = `#docs-static{position:fixed;inset:0;z-index:5;overflow:auto;background:#0d0e16;color:#d9dbe7;font:15px/1.6 "IBM Plex Sans","IBM Plex Sans Arabic",system-ui,sans-serif}
#docs-static header{height:64px;display:flex;align-items:center;gap:10px;padding-inline:24px;border-bottom:1px solid #242638;font-size:18px;font-weight:700}
#docs-static header a{color:#f4f5fa;text-decoration:none}
#docs-static header span{font-weight:400;color:#a9adc4}
#docs-static article,#docs-static nav{max-width:880px;margin-inline:auto;padding:24px 16px}
#docs-static h1{font-size:28px;line-height:1.25;margin:0 0 16px;color:#f4f5fa}
#docs-static h2{font-size:20px;margin:32px 0 12px;color:#f4f5fa}
#docs-static h3{font-size:16px;margin:24px 0 8px;color:#f4f5fa}
#docs-static h1,#docs-static h2,#docs-static h3{font-weight:700}
#docs-static p,#docs-static ul,#docs-static ol{margin:0 0 12px}
#docs-static article ul,#docs-static article ol{padding-inline-start:24px;list-style:revert}
#docs-static table,#docs-static pre,#docs-static aside{margin:0 0 16px}
#docs-static a{color:#7cb7ff}
#docs-static pre{overflow:auto;padding:12px 16px;border-radius:10px;background:#11121c;border:1px solid #242638;font:13px/1.55 "IBM Plex Mono",ui-monospace,monospace;text-align:left}
#docs-static code{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.9em}
#docs-static table{display:block;overflow:auto;border-collapse:collapse;font-size:14px}
#docs-static th,#docs-static td{padding:8px 12px;text-align:start;vertical-align:top;border-bottom:1px solid #242638}
#docs-static aside{padding:12px 16px;border-inline-start:3px solid #e0195f;background:#171925;border-radius:10px}
#docs-static nav ul{list-style:none;padding:0;columns:2;margin:0}
#docs-static nav li{padding:4px 0}
@media (max-width:600px){#docs-static header{height:56px;padding-inline:16px}#docs-static nav ul{columns:1}}`;

/** The plain page: its text, then the list of all pages */
export function docsBlock({ index, route, lang, body }) {
  const language = docsLanguage(index, lang) ?? "en";
  const words = index.words[language];
  const query = docsLanguage(index, lang) ? `?hl=${language}` : "";
  const link = (id) => (id === index.pages[0].id ? "/" : `/${id}`) + query;
  const contents = index.pages
    .map(
      (page) =>
        `<li><a href="${link(page.id)}"${route.kind === "page" && page.id === route.id ? ' aria-current="page"' : ""}>${escape(index.text[language][page.id].title)}</a></li>`,
    )
    .join("");
  return `<div id="docs-static"><header><a href="/${query}">Zrzur</a> <span>${escape(language === "ar" ? "المطوّرون" : language === "de" ? "Entwickler" : "Developers")}</span></header><article>${body ?? `<h1>${escape(words.site)}</h1><p>${escape(words.about)}</p>`}</article><nav aria-label="${escape(words.contents)}"><h2>${escape(words.contents)}</h2><ul>${contents}</ul></nav></div>`;
}

/** Put the plain page in front of the app's root */
export function injectDocs(html, block) {
  // a function: `$` in the page's code must not be read as a pattern
  return html
    .replace(/<\/head>/i, () => `    <style>${STYLE}</style>\n  </head>`)
    .replace(/<div id="root">/i, () => `${block}\n  <div id="root">`);
}

/** Every page, with the same page in each written language */
export function docsSitemap(index, origin) {
  const entry = (page, at) => {
    const base = at === 0 ? `${origin}/` : `${origin}/${page.id}`;
    const links = docsAlternates(index, base)
      .map(
        (alt) =>
          `<xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${alt.href}"/>`,
      )
      .join("");
    return `<url><loc>${base}</loc>${links}</url>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${index.pages.map(entry).join("\n")}\n</urlset>\n`;
}
