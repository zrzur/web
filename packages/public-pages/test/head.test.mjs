import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMUNITY_LANGUAGES,
  DISPLAY_LANGUAGES,
  TOPICS,
  alternateLinks,
  headTags,
  injectHead,
  pageMeta,
  roughCount,
  routeOf,
} from "../src/head.mjs";

const ORIGIN = "https://discover.zrzur.com";
const card = {
  _id: "01JC3V9X8Q2W5E7R4T6Y1Z0P9A",
  name: "ربع الحارة",
  description: "سهرات ألعاب كل خميس وجمعة.",
  member_count: 123,
  link: "rabea",
  language: "ar",
};

test("routes on the Discover site", () => {
  assert.deepEqual(routeOf("discover", "/"), { kind: "home" });
  assert.deepEqual(routeOf("discover", "/gaming"), {
    kind: "topic",
    id: "gaming",
  });
  assert.deepEqual(routeOf("discover", "/de"), { kind: "language", id: "de" });
  assert.deepEqual(routeOf("discover", "/rabea"), {
    kind: "server",
    slug: "rabea",
  });
  assert.deepEqual(routeOf("discover", "/servers/abc"), {
    kind: "server",
    slug: "abc",
  });
  assert.deepEqual(routeOf("discover", "/a/b/c"), { kind: "other" });
});

test("routes on the Designs site", () => {
  assert.deepEqual(routeOf("designs", "/look-night-glow"), {
    kind: "design",
    ref: { kind: "look", id: "night-glow" },
  });
  assert.equal(routeOf("designs", "/looks").kind, "other");
});

test("a server page has its own title, description, image and languages", () => {
  const meta = pageMeta({
    site: "discover",
    origin: ORIGIN,
    path: "/rabea",
    lang: "ar",
    route: { kind: "server", slug: "rabea" },
    data: card,
  });
  assert.equal(meta.title, "ربع الحارة — اكتشف زرزور");
  assert.equal(meta.description, card.description);
  assert.equal(meta.canonical, `${ORIGIN}/rabea?hl=ar`);
  assert.equal(meta.image, `${ORIGIN}/og/server/rabea.png`);
  assert.equal(meta.dir, "rtl");
  assert.deepEqual(
    meta.alternates.map((a) => a.hreflang),
    ["en", "de", "ar", "fr", "es", "ru", "zh-Hans", "x-default"],
  );
  assert.equal(meta.alternates.at(-1).href, `${ORIGIN}/rabea`);
});

test("no description: a short line with a rounded member count", () => {
  const meta = pageMeta({
    site: "discover",
    origin: ORIGIN,
    path: "/rabea",
    lang: "de",
    route: { kind: "server", slug: "rabea" },
    data: { ...card, description: "" },
  });
  assert.match(meta.description, /etwa 100 Mitgliedern/);
});

test("a page that is not there says so to search engines", () => {
  const meta = pageMeta({
    site: "discover",
    origin: ORIGIN,
    path: "/nothing",
    route: { kind: "server", slug: "nothing" },
    data: null,
  });
  assert.equal(meta.status, 404);
  assert.match(headTags(meta), /noindex/);
});

test("counts are never exact", () => {
  assert.equal(roughCount(7), "7");
  assert.equal(roughCount(123), "100");
  assert.equal(roughCount(3412), "3500");
});

test("the head goes into the page and text is escaped", () => {
  const html =
    '<!doctype html><html lang="en"><head><title>Zrzur</title><meta name="description" content="x"></head><body></body></html>';
  const meta = pageMeta({
    site: "discover",
    origin: ORIGIN,
    path: "/rabea",
    lang: "en",
    route: { kind: "server", slug: "rabea" },
    data: { ...card, name: 'A "quoted" <b>name</b>' },
  });
  const out = injectHead(html, meta);
  assert.match(out, /<html lang="en" dir="ltr">/);
  assert.match(
    out,
    /<title>A &quot;quoted&quot; &lt;b&gt;name&lt;\/b&gt; — Zrzur Discover<\/title>/,
  );
  assert.equal((out.match(/name="description"/g) ?? []).length, 1);
  assert.match(
    out,
    /og:image" content="https:\/\/discover\.zrzur\.com\/og\/server\/rabea\.png"/,
  );
  assert.doesNotMatch(out, /<b>name/);
});

// --- the seven display languages (?hl=) and the community routes ---

const SEVEN = ["en", "de", "ar", "fr", "es", "ru", "zh-Hans"];

test("pages are offered in the website's seven languages", () => {
  assert.deepEqual(DISPLAY_LANGUAGES, SEVEN);
});

test("community-language routes stay the ones they were", () => {
  assert.deepEqual(COMMUNITY_LANGUAGES, ["ar", "en", "de"]);
  for (const id of COMMUNITY_LANGUAGES)
    assert.deepEqual(routeOf("discover", `/${id}`), { kind: "language", id });
  // a display language is not a route: these stay server links as before
  for (const slug of ["fr", "es", "ru", "zh-Hans"])
    assert.deepEqual(routeOf("discover", `/${slug}`), { kind: "server", slug });
});

const home = (site, lang) =>
  pageMeta({
    site,
    origin: ORIGIN,
    path: "/",
    lang,
    route: { kind: "home" },
    data: undefined,
  });

const expected = {
  fr: {
    discover: "Découvrir Zrzur",
    designs: "Designs Zrzur",
    locale: "fr_FR",
    gaming: "jeu vidéo",
    arabic: "arabe",
    look: "Apparence du profil",
  },
  es: {
    discover: "Descubrir Zrzur",
    designs: "Diseños de Zrzur",
    locale: "es_ES",
    gaming: "videojuegos",
    arabic: "árabe",
    look: "Aspecto del perfil",
  },
  ru: {
    discover: "Обзор Zrzur",
    designs: "Дизайны Zrzur",
    locale: "ru_RU",
    gaming: "игры",
    arabic: "арабск",
    look: "Образ профиля",
  },
  "zh-Hans": {
    discover: "Zrzur 发现",
    designs: "Zrzur 设计",
    locale: "zh_CN",
    gaming: "游戏",
    arabic: "阿拉伯语",
    look: "个人资料造型",
  },
};

test("every page head is translated into each new language", () => {
  for (const [lang, want] of Object.entries(expected)) {
    const discover = home("discover", lang);
    assert.equal(discover.lang, lang);
    assert.equal(discover.dir, "ltr");
    assert.equal(discover.locale, want.locale);
    assert.equal(discover.siteName, want.discover);
    assert.ok(discover.title.includes(want.discover), discover.title);
    assert.notEqual(discover.description, home("discover", "en").description);

    const designs = home("designs", lang);
    assert.equal(designs.siteName, want.designs);
    assert.ok(designs.title.includes(want.designs), designs.title);
    assert.notEqual(designs.description, home("designs", "en").description);

    const topic = pageMeta({
      site: "discover",
      origin: ORIGIN,
      path: "/gaming",
      lang,
      route: { kind: "topic", id: "gaming" },
    });
    assert.ok(
      topic.title.toLowerCase().includes(want.gaming.toLowerCase()),
      topic.title,
    );

    const language = pageMeta({
      site: "discover",
      origin: ORIGIN,
      path: "/ar",
      lang,
      route: { kind: "language", id: "ar" },
    });
    assert.ok(
      language.title.toLowerCase().includes(want.arabic),
      language.title,
    );

    const design = pageMeta({
      site: "designs",
      origin: "https://designs.zrzur.com",
      path: "/look-night-glow",
      lang,
      route: { kind: "design", ref: { kind: "look", id: "night-glow" } },
      data: { kind: "look", name: "Night glow" },
    });
    assert.ok(design.title.includes(want.look), design.title);
    assert.match(design.description, /Night glow/);

    const missing = pageMeta({
      site: "discover",
      origin: ORIGIN,
      path: "/a/b",
      lang,
      route: { kind: "other" },
    });
    assert.equal(missing.status, 404);
    assert.notEqual(missing.title, "Page not found — Zrzur");
  }
});

test("every topic, language name and design kind exists in all seven", () => {
  for (const lang of SEVEN) {
    for (const topic of Object.keys(TOPICS))
      assert.ok(TOPICS[topic][lang], `${topic} in ${lang}`);
    for (const id of COMMUNITY_LANGUAGES) {
      const meta = pageMeta({
        site: "discover",
        origin: ORIGIN,
        path: `/${id}`,
        lang,
        route: { kind: "language", id },
      });
      assert.doesNotMatch(meta.title, /undefined/);
    }
    for (const kind of ["look", "decoration", "nameplate", "colours"]) {
      const meta = pageMeta({
        site: "designs",
        origin: ORIGIN,
        path: `/${kind}-x`,
        lang,
        route: { kind: "design", ref: { kind, id: "x" } },
        data: { kind, name: "X" },
      });
      assert.doesNotMatch(meta.title, new RegExp(`— ${kind} `));
      assert.doesNotMatch(meta.description, /undefined/);
    }
    const server = pageMeta({
      site: "discover",
      origin: ORIGIN,
      path: "/rabea",
      lang,
      route: { kind: "server", slug: "rabea" },
      data: { ...card, description: "" },
    });
    assert.match(server.description, /100/);
  }
});

test("hreflang lists all seven plus x-default, on every page", () => {
  const meta = home("discover", "fr");
  assert.deepEqual(
    meta.alternates.map((a) => a.hreflang),
    [...SEVEN, "x-default"],
  );
  assert.equal(
    meta.alternates.find((a) => a.hreflang === "zh-Hans").href,
    `${ORIGIN}/?hl=zh-Hans`,
  );
  assert.deepEqual(alternateLinks(`${ORIGIN}/gaming`), [
    ...SEVEN.map((hl) => ({ hreflang: hl, href: `${ORIGIN}/gaming?hl=${hl}` })),
    { hreflang: "x-default", href: `${ORIGIN}/gaming` },
  ]);
});

test("canonical: the page in its ?hl= language, the bare address otherwise", () => {
  assert.equal(home("discover", "ru").canonical, `${ORIGIN}/?hl=ru`);
  assert.equal(home("discover", "zh-Hans").canonical, `${ORIGIN}/?hl=zh-Hans`);
  assert.equal(home("discover", "ar").canonical, `${ORIGIN}/?hl=ar`);
  assert.equal(home("discover", undefined).canonical, `${ORIGIN}/`);
  const unknown = home("discover", "ja");
  assert.equal(unknown.canonical, `${ORIGIN}/`);
  assert.equal(unknown.lang, "en");
});

test("the website's short zh means Simplified Chinese", () => {
  const meta = home("discover", "zh");
  assert.equal(meta.lang, "zh-Hans");
  assert.equal(meta.canonical, `${ORIGIN}/?hl=zh-Hans`);
});

test("lang and dir in the page: rtl only for Arabic, zh-Hans as the tag", () => {
  const html =
    '<!doctype html><html lang="en"><head><title>x</title></head></html>';
  for (const lang of SEVEN) {
    const out = injectHead(html, home("designs", lang));
    const dir = lang === "ar" ? "rtl" : "ltr";
    assert.ok(out.includes(`<html lang="${lang}" dir="${dir}">`), lang);
    assert.ok(out.includes(`hreflang="zh-Hans"`));
  }
});
